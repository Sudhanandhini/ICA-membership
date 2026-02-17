import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const mockQuery = vi.fn();
vi.mock('../../config/database.js', () => ({
  default: { query: mockQuery },
  testConnection: vi.fn().mockResolvedValue(true),
}));

const mockCreateOrder = vi.fn();
const mockVerifySignature = vi.fn();
vi.mock('../../config/razorpay.js', () => ({
  default: {},
  createRazorpayOrder: mockCreateOrder,
  verifyRazorpaySignature: mockVerifySignature,
  fetchPaymentDetails: vi.fn(),
  processRefund: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue(true),
    })),
  },
}));

vi.mock('../../utils/otpService.js', () => ({
  generateOTP: vi.fn().mockReturnValue('123456'),
  maskEmail: vi.fn().mockReturnValue('t***t@example.com'),
  storeOTP: vi.fn(),
  verifyOTP: vi.fn(),
  sendOTPEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../database/migrations.js', () => ({
  runMigrations: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../utils/birthdayService.js', () => ({
  checkAndSendBirthdayEmails: vi.fn(),
}));

vi.mock('node-cron', () => ({
  default: { schedule: vi.fn() },
}));

vi.mock('razorpay', () => ({
  default: vi.fn(() => ({
    orders: { create: vi.fn() },
    payments: { fetch: vi.fn(), refund: vi.fn() },
  })),
}));

let request, app;

beforeAll(async () => {
  const supertest = await import('supertest');
  request = supertest.default;
  const appModule = await import('../../server.js');
  app = appModule.default;
});

beforeEach(() => {
  vi.clearAllMocks();
  mockQuery.mockResolvedValue([[{ 1: 1 }], []]);
});

// Helper: create a mock member with payment period data
function createMockMember(overrides = {}) {
  return {
    id: 1,
    name: 'Test Member',
    email: 'test@example.com',
    phone: '9876543210',
    folio_number: 'FOL001',
    status: 'active',
    starting_period: 21,
    period_21: '2021-22', amount_21: 1200, payment_id_21: 'pay_1', payment_date_21: '2021-04-15',
    period_22: '2022-23', amount_22: 1200, payment_id_22: 'pay_2', payment_date_22: '2022-04-15',
    period_23: '2023-24', amount_23: null, payment_id_23: null, payment_date_23: null,
    period_24: '2024-25', amount_24: null, payment_id_24: null, payment_date_24: null,
    period_25: '2025-26', amount_25: null, payment_id_25: null, payment_date_25: null,
    period_26: '2026-27', amount_26: null, payment_id_26: null, payment_date_26: null,
    period_27: '2027-28', amount_27: null, payment_id_27: null, payment_date_27: null,
    period_28: '2028-29', amount_28: null, payment_id_28: null, payment_date_28: null,
    ...overrides,
  };
}

describe('GET /api/payments/history/:memberId', () => {
  it('should return payment history for all periods', async () => {
    mockQuery.mockResolvedValueOnce([[createMockMember()], []]);

    const res = await request(app).get('/api/payments/history/1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.payments).toHaveLength(8); // periods 21-28
    expect(res.body.payments[0].status).toBe('paid');
    expect(res.body.payments[2].status).toBe('unpaid');
  });

  it('should return 404 for non-existent member', async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app).get('/api/payments/history/999');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/payments/calculate', () => {
  it('should return payment calculation with options', async () => {
    mockQuery.mockResolvedValueOnce([[createMockMember()], []]);

    const res = await request(app)
      .post('/api/payments/calculate')
      .send({ memberId: 1 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.calculation).toBeDefined();
    expect(res.body.calculation.memberName).toBe('Test Member');
    expect(res.body.calculation.unpaidPeriods.length).toBeGreaterThan(0);
    expect(res.body.calculation.canPay).toBe(true);
    expect(res.body.calculation.paymentOptions).toBeDefined();
  });

  it('should return 400 when memberId is missing', async () => {
    const res = await request(app)
      .post('/api/payments/calculate')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 404 for non-existent member', async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .post('/api/payments/calculate')
      .send({ memberId: 999 });

    expect(res.status).toBe(404);
  });

  it('should return canPay false when all periods are paid', async () => {
    const allPaidMember = createMockMember({
      amount_23: 1200, payment_id_23: 'pay_3', payment_date_23: '2023-04-15',
      amount_24: 1200, payment_id_24: 'pay_4', payment_date_24: '2024-04-15',
      amount_25: 1200, payment_id_25: 'pay_5', payment_date_25: '2025-04-15',
      amount_26: 1200, payment_id_26: 'pay_6', payment_date_26: '2026-04-15',
      amount_27: 1200, payment_id_27: 'pay_7', payment_date_27: '2027-04-15',
      amount_28: 1200, payment_id_28: 'pay_8', payment_date_28: '2028-04-15',
    });
    mockQuery.mockResolvedValueOnce([[allPaidMember], []]);

    const res = await request(app)
      .post('/api/payments/calculate')
      .send({ memberId: 1 });

    expect(res.status).toBe(200);
    expect(res.body.calculation.canPay).toBe(false);
    expect(res.body.calculation.unpaidPeriods).toHaveLength(0);
  });
});

describe('POST /api/payments/initiate', () => {
  it('should create Razorpay order on success', async () => {
    mockQuery.mockResolvedValueOnce([[createMockMember()], []]);
    mockCreateOrder.mockResolvedValueOnce({
      success: true,
      order: { id: 'order_123', amount: 120000, currency: 'INR' },
    });

    process.env.RAZORPAY_KEY_ID = 'rzp_test_key';

    const res = await request(app)
      .post('/api/payments/initiate')
      .send({
        memberId: 1,
        payableYears: [{ year: '2023-24', amount: 1200 }],
        totalAmount: 1200,
        optionId: 'option_1year',
        periods: ['2023'],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.order.id).toBe('order_123');
    expect(res.body.razorpayKeyId).toBeDefined();
  });

  it('should return 400 when required fields missing', async () => {
    const res = await request(app)
      .post('/api/payments/initiate')
      .send({ memberId: 1 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 404 for non-existent member', async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .post('/api/payments/initiate')
      .send({
        memberId: 999,
        payableYears: [{ year: '2023-24', amount: 1200 }],
        totalAmount: 1200,
      });

    expect(res.status).toBe(404);
  });

  it('should return 500 when Razorpay order creation fails', async () => {
    mockQuery.mockResolvedValueOnce([[createMockMember()], []]);
    mockCreateOrder.mockResolvedValueOnce({
      success: false,
      error: 'Razorpay error',
    });

    const res = await request(app)
      .post('/api/payments/initiate')
      .send({
        memberId: 1,
        payableYears: [{ year: '2023-24', amount: 1200 }],
        totalAmount: 1200,
        periods: ['2023'],
      });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/payments/verify', () => {
  it('should verify valid payment and update database', async () => {
    mockVerifySignature.mockReturnValueOnce(true);
    // First call: update query, second call: fetch member for email
    mockQuery
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockResolvedValueOnce([[{ name: 'Test', email: 'test@test.com', phone: '9876543210', folio_number: 'FOL001' }], []]);

    const res = await request(app)
      .post('/api/payments/verify')
      .send({
        razorpay_order_id: 'order_123',
        razorpay_payment_id: 'pay_456',
        razorpay_signature: 'valid_sig',
        memberId: 1,
        periods: ['2023'],
        totalAmount: 1200,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.payment.id).toBe('pay_456');
  });

  it('should return 400 for invalid signature', async () => {
    mockVerifySignature.mockReturnValueOnce(false);

    const res = await request(app)
      .post('/api/payments/verify')
      .send({
        razorpay_order_id: 'order_123',
        razorpay_payment_id: 'pay_456',
        razorpay_signature: 'invalid',
        memberId: 1,
        periods: ['2023'],
        totalAmount: 1200,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('invalid signature');
  });

  it('should return 400 when signature data is missing', async () => {
    const res = await request(app)
      .post('/api/payments/verify')
      .send({ memberId: 1 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
