import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// Mock database
const mockQuery = vi.fn();
vi.mock('../../config/database.js', () => ({
  default: { query: mockQuery },
  testConnection: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../config/razorpay.js', () => ({
  default: {},
  createRazorpayOrder: vi.fn(),
  verifyRazorpaySignature: vi.fn(),
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

const mockGenerateOTP = vi.fn().mockReturnValue('123456');
const mockMaskEmail = vi.fn().mockReturnValue('t***t@example.com');
const mockStoreOTP = vi.fn();
const mockVerifyOTP = vi.fn();
const mockSendOTPEmail = vi.fn().mockResolvedValue(true);

vi.mock('../../utils/otpService.js', () => ({
  generateOTP: mockGenerateOTP,
  maskEmail: mockMaskEmail,
  storeOTP: mockStoreOTP,
  verifyOTP: mockVerifyOTP,
  sendOTPEmail: mockSendOTPEmail,
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
  // Default: db connection test passes
  mockQuery.mockResolvedValue([[{ 1: 1 }], []]);
});

describe('POST /api/members/search', () => {
  it('should return matching members', async () => {
    const members = [
      { id: 1, name: 'Rajesh Kumar', folio_number: 'FOL001', status: 'active' },
    ];
    mockQuery.mockResolvedValueOnce([members, []]);

    const res = await request(app)
      .post('/api/members/search')
      .send({ name: 'Rajesh' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.members).toHaveLength(1);
    expect(res.body.members[0].name).toBe('Rajesh Kumar');
  });

  it('should return empty array for empty name', async () => {
    const res = await request(app)
      .post('/api/members/search')
      .send({ name: '' });

    expect(res.status).toBe(200);
    expect(res.body.members).toEqual([]);
  });

  it('should return empty array for missing name', async () => {
    const res = await request(app)
      .post('/api/members/search')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.members).toEqual([]);
  });

  it('should return 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));

    const res = await request(app)
      .post('/api/members/search')
      .send({ name: 'Test' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/members/:id', () => {
  it('should return member when found', async () => {
    const member = { id: 1, name: 'Rajesh Kumar', folio_number: 'FOL001' };
    mockQuery.mockResolvedValueOnce([[member], []]);

    const res = await request(app).get('/api/members/1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.member.name).toBe('Rajesh Kumar');
  });

  it('should return 404 when member not found', async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app).get('/api/members/999');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/members/:id/payment-calculation', () => {
  it('should return payment calculation for member', async () => {
    const member = {
      id: 1,
      name: 'Rajesh Kumar',
      starting_period: 24,
      period_24: '2024-25',
      amount_24: 1200,
      payment_id_24: 'pay_123',
      payment_date_24: '2024-04-15',
      period_25: '2025-26',
      amount_25: null,
      payment_id_25: null,
      payment_date_25: null,
      period_26: '2026-27',
      amount_26: null,
      payment_id_26: null,
      payment_date_26: null,
      period_27: '2027-28',
      amount_27: null,
      payment_id_27: null,
      payment_date_27: null,
      period_28: '2028-29',
      amount_28: null,
      payment_id_28: null,
      payment_date_28: null,
    };
    mockQuery.mockResolvedValueOnce([[member], []]);

    const res = await request(app).get('/api/members/1/payment-calculation');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.calculation).toBeDefined();
    expect(res.body.calculation.memberId).toBe(1);
    expect(res.body.calculation.unpaidPeriods.length).toBeGreaterThan(0);
    expect(res.body.calculation.totalDue).toBe(res.body.calculation.unpaidPeriods.length * 1200);
  });

  it('should return 404 for non-existent member', async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app).get('/api/members/999/payment-calculation');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should skip exempt periods (amount === 0)', async () => {
    const member = {
      id: 1,
      name: 'New Member',
      starting_period: 21,
      period_21: '2021-22', amount_21: 0, payment_id_21: null, payment_date_21: null,
      period_22: '2022-23', amount_22: 0, payment_id_22: null, payment_date_22: null,
      period_23: '2023-24', amount_23: 0, payment_id_23: null, payment_date_23: null,
      period_24: '2024-25', amount_24: 0, payment_id_24: null, payment_date_24: null,
      period_25: '2025-26', amount_25: null, payment_id_25: null, payment_date_25: null,
      period_26: '2026-27', amount_26: null, payment_id_26: null, payment_date_26: null,
      period_27: '2027-28', amount_27: null, payment_id_27: null, payment_date_27: null,
      period_28: '2028-29', amount_28: null, payment_id_28: null, payment_date_28: null,
    };
    mockQuery.mockResolvedValueOnce([[member], []]);

    const res = await request(app).get('/api/members/1/payment-calculation');

    expect(res.status).toBe(200);
    // Exempt periods (amount === 0) should not appear in paymentStatus
    const exemptInStatus = res.body.calculation.paymentStatus.filter(
      p => p.amount === 0
    );
    expect(exemptInStatus).toHaveLength(0);
  });
});

describe('POST /api/members/send-otp', () => {
  it('should send OTP and return masked email', async () => {
    const member = { id: 1, name: 'Rajesh', email: 'rajesh@test.com' };
    mockQuery.mockResolvedValueOnce([[member], []]);

    const res = await request(app)
      .post('/api/members/send-otp')
      .send({ memberId: 1 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.email).toBeDefined();
    expect(mockStoreOTP).toHaveBeenCalled();
    expect(mockSendOTPEmail).toHaveBeenCalled();
  });

  it('should return 400 when memberId is missing', async () => {
    const res = await request(app)
      .post('/api/members/send-otp')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 404 for non-existent member', async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .post('/api/members/send-otp')
      .send({ memberId: 999 });

    expect(res.status).toBe(404);
  });

  it('should return 400 when member has no email', async () => {
    const member = { id: 1, name: 'Rajesh', email: null };
    mockQuery.mockResolvedValueOnce([[member], []]);

    const res = await request(app)
      .post('/api/members/send-otp')
      .send({ memberId: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('No email');
  });
});

describe('POST /api/members/verify-otp', () => {
  it('should verify OTP successfully', async () => {
    const member = { id: 1, name: 'Rajesh', email: 'rajesh@test.com', status: 'active' };
    mockQuery.mockResolvedValueOnce([[member], []]);
    mockVerifyOTP.mockReturnValueOnce({ valid: true });

    const res = await request(app)
      .post('/api/members/verify-otp')
      .send({ memberId: 1, otp: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.verified).toBe(true);
    expect(res.body.member).toBeDefined();
  });

  it('should return 400 for invalid OTP', async () => {
    const member = { id: 1, name: 'Rajesh', email: 'rajesh@test.com', status: 'active' };
    mockQuery.mockResolvedValueOnce([[member], []]);
    mockVerifyOTP.mockReturnValueOnce({ valid: false, error: 'Invalid OTP' });

    const res = await request(app)
      .post('/api/members/verify-otp')
      .send({ memberId: 1, otp: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 when memberId or otp missing', async () => {
    const res = await request(app)
      .post('/api/members/verify-otp')
      .send({ memberId: 1 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 404 for non-existent member', async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const res = await request(app)
      .post('/api/members/verify-otp')
      .send({ memberId: 999, otp: '123456' });

    expect(res.status).toBe(404);
  });
});
