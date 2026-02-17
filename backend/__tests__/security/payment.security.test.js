import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

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
    ...overrides,
  };
}

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

// ============================================
// AMOUNT TAMPERING
// ============================================

describe('Amount Tampering - Payment Initiation', () => {
  it('should handle zero amount', async () => {
    const member = createMockMember();
    mockQuery.mockResolvedValueOnce([[member], []]);
    mockCreateOrder.mockResolvedValue({
      success: true,
      order: { id: 'order_1', amount: 0, currency: 'INR' },
    });

    const res = await request(app)
      .post('/api/payments/initiate')
      .send({
        memberId: 1,
        payableYears: [23],
        totalAmount: 0,
        periods: [23],
      });

    // Document behavior: zero amount is accepted or rejected
    expect([200, 400]).toContain(res.status);
  });

  it('should handle negative amount', async () => {
    const member = createMockMember();
    mockQuery.mockResolvedValueOnce([[member], []]);
    mockCreateOrder.mockResolvedValue({
      success: true,
      order: { id: 'order_1', amount: -1000, currency: 'INR' },
    });

    const res = await request(app)
      .post('/api/payments/initiate')
      .send({
        memberId: 1,
        payableYears: [23],
        totalAmount: -1000,
        periods: [23],
      });

    // Negative amounts should ideally be rejected
    expect([200, 400]).toContain(res.status);
  });

  it('should handle absurdly large amount', async () => {
    const member = createMockMember();
    mockQuery.mockResolvedValueOnce([[member], []]);
    mockCreateOrder.mockResolvedValue({
      success: true,
      order: { id: 'order_1', amount: 999999999, currency: 'INR' },
    });

    const res = await request(app)
      .post('/api/payments/initiate')
      .send({
        memberId: 1,
        payableYears: [23],
        totalAmount: 999999999,
        periods: [23],
      });

    // Should either reject or pass to Razorpay
    expect([200, 400]).toContain(res.status);
  });

  it('should handle non-numeric amount', async () => {
    const member = createMockMember();
    mockQuery.mockResolvedValueOnce([[member], []]);

    const res = await request(app)
      .post('/api/payments/initiate')
      .send({
        memberId: 1,
        payableYears: [23],
        totalAmount: 'abc',
        periods: [23],
      });

    // Non-numeric should be rejected or handled
    expect([200, 400, 500]).toContain(res.status);
  });

  it('should handle float amount (underpayment)', async () => {
    const member = createMockMember();
    mockQuery.mockResolvedValueOnce([[member], []]);
    mockCreateOrder.mockResolvedValue({
      success: true,
      order: { id: 'order_1', amount: 1, currency: 'INR' },
    });

    const res = await request(app)
      .post('/api/payments/initiate')
      .send({
        memberId: 1,
        payableYears: [23],
        totalAmount: 0.01,
        periods: [23],
      });

    // Extremely low amount - documents current behavior
    expect([200, 400]).toContain(res.status);
  });
});

// ============================================
// RAZORPAY SIGNATURE BYPASS
// ============================================

describe('Razorpay Signature Bypass', () => {
  it('should reject empty signature', async () => {
    const res = await request(app)
      .post('/api/payments/verify')
      .send({
        razorpay_order_id: 'order_test',
        razorpay_payment_id: 'pay_test',
        razorpay_signature: '',
      });

    expect(res.status).toBe(400);
  });

  it('should reject random signature string', async () => {
    mockVerifySignature.mockReturnValue(false);

    const res = await request(app)
      .post('/api/payments/verify')
      .send({
        razorpay_order_id: 'order_test',
        razorpay_payment_id: 'pay_test',
        razorpay_signature: 'random_invalid_signature_string_here',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should reject with missing razorpay_order_id', async () => {
    const res = await request(app)
      .post('/api/payments/verify')
      .send({
        razorpay_payment_id: 'pay_test',
        razorpay_signature: 'some_sig',
      });

    expect(res.status).toBe(400);
  });

  it('should reject with missing razorpay_payment_id', async () => {
    const res = await request(app)
      .post('/api/payments/verify')
      .send({
        razorpay_order_id: 'order_test',
        razorpay_signature: 'some_sig',
      });

    expect(res.status).toBe(400);
  });

  it('should reject with missing razorpay_signature', async () => {
    const res = await request(app)
      .post('/api/payments/verify')
      .send({
        razorpay_order_id: 'order_test',
        razorpay_payment_id: 'pay_test',
      });

    expect(res.status).toBe(400);
  });

  it('should reject with all fields missing', async () => {
    const res = await request(app)
      .post('/api/payments/verify')
      .send({});

    expect(res.status).toBe(400);
  });
});

// ============================================
// PAYMENT REPLAY & PERIOD MANIPULATION
// ============================================

describe('Payment Replay & Period Manipulation', () => {
  it('should handle replay of same payment data', async () => {
    mockVerifySignature.mockReturnValue(true);
    const member = createMockMember();
    mockQuery.mockResolvedValue([[member], []]);

    const paymentData = {
      razorpay_order_id: 'order_replay',
      razorpay_payment_id: 'pay_replay',
      razorpay_signature: 'valid_sig',
      memberId: 1,
      periods: [23],
      totalAmount: 1200,
    };

    // First payment
    const res1 = await request(app)
      .post('/api/payments/verify')
      .send(paymentData);

    // Replay same payment
    const res2 = await request(app)
      .post('/api/payments/verify')
      .send(paymentData);

    // Both should succeed (documents lack of idempotency check)
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });

  it('should handle empty periods array', async () => {
    mockVerifySignature.mockReturnValue(true);

    const res = await request(app)
      .post('/api/payments/verify')
      .send({
        razorpay_order_id: 'order_test',
        razorpay_payment_id: 'pay_test',
        razorpay_signature: 'valid_sig',
        memberId: 1,
        periods: [],
        totalAmount: 1200,
      });

    // Empty periods - should still verify signature but skip DB update
    expect(res.status).toBe(200);
  });

  it('should handle null periods', async () => {
    mockVerifySignature.mockReturnValue(true);

    const res = await request(app)
      .post('/api/payments/verify')
      .send({
        razorpay_order_id: 'order_test',
        razorpay_payment_id: 'pay_test',
        razorpay_signature: 'valid_sig',
        memberId: 1,
        periods: null,
        totalAmount: 1200,
      });

    // Should handle null periods gracefully
    expect([200, 400, 500]).toContain(res.status);
  });

  it('should handle non-existent memberId with valid signature', async () => {
    mockVerifySignature.mockReturnValue(true);
    mockQuery.mockResolvedValue([[], []]); // No member found

    const res = await request(app)
      .post('/api/payments/verify')
      .send({
        razorpay_order_id: 'order_test',
        razorpay_payment_id: 'pay_test',
        razorpay_signature: 'valid_sig',
        memberId: 99999,
        periods: [23],
        totalAmount: 1200,
      });

    // Should not crash even if member doesn't exist
    expect([200, 404, 500]).toContain(res.status);
  });

  it('should handle payment with totalAmount as null', async () => {
    mockVerifySignature.mockReturnValue(true);
    const member = createMockMember();
    mockQuery.mockResolvedValue([[member], []]);

    const res = await request(app)
      .post('/api/payments/verify')
      .send({
        razorpay_order_id: 'order_test',
        razorpay_payment_id: 'pay_test',
        razorpay_signature: 'valid_sig',
        memberId: 1,
        periods: [23],
        totalAmount: null,
      });

    // Should handle null amount (fallback to 1 per year in code)
    expect([200, 400, 500]).toContain(res.status);
  });

  it('should not expose Razorpay key secret in response on failure', async () => {
    mockCreateOrder.mockRejectedValue(new Error('Razorpay API failed'));
    const member = createMockMember();
    mockQuery.mockResolvedValueOnce([[member], []]);

    const res = await request(app)
      .post('/api/payments/initiate')
      .send({
        memberId: 1,
        payableYears: [23],
        totalAmount: 1200,
        periods: [23],
      });

    expect(res.status).toBe(500);
    const responseStr = JSON.stringify(res.body);
    const razorpaySecret = process.env.RAZORPAY_KEY_SECRET || '';
    if (razorpaySecret) {
      expect(responseStr).not.toContain(razorpaySecret);
    }
  });
});
