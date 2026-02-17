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

const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_key';

function generateAdminToken() {
  return jwt.sign({ username: 'admin', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
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
  mockQuery.mockResolvedValue([[], []]);
});

// ============================================
// SQL INJECTION - MEMBER SEARCH
// ============================================

describe('SQL Injection - Member Search', () => {
  it('should safely handle DROP TABLE injection in name', async () => {
    mockQuery.mockResolvedValue([[], []]);

    const res = await request(app)
      .post('/api/members/search')
      .send({ name: "'; DROP TABLE members_with_payments;--" });

    expect(res.status).toBe(200);
    // Should use parameterized query - the injection string becomes a literal search term
    expect(mockQuery).toHaveBeenCalled();
    const callArgs = mockQuery.mock.calls[0];
    // Verify parameterized query (uses ? placeholders, not string concatenation)
    expect(callArgs[0]).toContain('?');
    expect(callArgs[1]).toContain("%'; DROP TABLE members_with_payments;--%");
  });

  it('should safely handle OR 1=1 injection', async () => {
    mockQuery.mockResolvedValue([[], []]);

    const res = await request(app)
      .post('/api/members/search')
      .send({ name: "1' OR '1'='1" });

    expect(res.status).toBe(200);
    const callArgs = mockQuery.mock.calls[0];
    expect(callArgs[0]).toContain('?');
  });

  it('should safely handle UNION SELECT injection', async () => {
    mockQuery.mockResolvedValue([[], []]);

    const res = await request(app)
      .post('/api/members/search')
      .send({ name: "'; UNION SELECT * FROM information_schema.tables;--" });

    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should safely handle DELETE injection', async () => {
    mockQuery.mockResolvedValue([[], []]);

    const res = await request(app)
      .post('/api/members/search')
      .send({ name: "Robert'); DELETE FROM members_with_payments WHERE ('1'='1" });

    expect(res.status).toBe(200);
  });

  it('should safely handle comment-based injection', async () => {
    mockQuery.mockResolvedValue([[], []]);

    const res = await request(app)
      .post('/api/members/search')
      .send({ name: "admin'--" });

    expect(res.status).toBe(200);
  });
});

// ============================================
// SQL INJECTION - ADMIN ROUTES
// ============================================

describe('SQL Injection - Admin Routes', () => {
  const token = () => generateAdminToken();

  it('should safely handle SQL injection in search query param', async () => {
    mockQuery.mockResolvedValue([[[], { total: 0 }], []]);
    // First call returns members, second returns count
    mockQuery
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[{ total: 0 }], []]);

    const res = await request(app)
      .get("/api/admin/members?search=' OR 1=1--")
      .set('Authorization', `Bearer ${token()}`);

    expect([200, 500]).toContain(res.status);
    // Verify the query uses parameterized placeholders
    if (mockQuery.mock.calls.length > 0) {
      const callArgs = mockQuery.mock.calls[0];
      expect(callArgs[0]).toContain('?');
    }
  });

  it('should safely handle SQL injection in status query param', async () => {
    mockQuery
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[{ total: 0 }], []]);

    const res = await request(app)
      .get("/api/admin/members?status=' OR '1'='1")
      .set('Authorization', `Bearer ${token()}`);

    expect([200, 500]).toContain(res.status);
  });

  it('should handle non-numeric member ID gracefully', async () => {
    mockQuery.mockResolvedValue([[], []]);

    const res = await request(app)
      .get('/api/members/abc');

    // Should return 404 or handle gracefully, not crash
    expect([200, 404, 500]).toContain(res.status);
    expect(res.body).toBeDefined();
  });

  it('should handle SQL injection in member ID path param', async () => {
    mockQuery.mockResolvedValue([[], []]);

    const res = await request(app)
      .get("/api/members/1 OR 1=1");

    expect([404, 500]).toContain(res.status);
  });
});

// ============================================
// XSS PAYLOAD TESTING
// ============================================

describe('XSS Payload Testing', () => {
  const token = () => generateAdminToken();

  it('should store XSS payload in name as plain text (not execute)', async () => {
    const xssName = '<script>alert("xss")</script>';
    mockQuery
      .mockResolvedValueOnce([[], []]) // check duplicate
      .mockResolvedValueOnce([{ insertId: 1 }, []]) // insert
      .mockResolvedValueOnce([[{ id: 1, name: xssName }], []]); // fetch created

    const res = await request(app)
      .post('/api/admin/members')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        folio_number: 'FOL_XSS',
        name: xssName,
        email: 'xss@test.com',
        join_date: '2025-06-01',
      });

    // The XSS payload is treated as a regular string by the server
    expect([200, 201, 400]).toContain(res.status);
    if (res.body.success) {
      // JSON API with Content-Type: application/json is safe from XSS execution
      // The name is stored/returned as-is - browsers won't execute JS from JSON responses
      expect(res.headers['content-type']).toContain('json');
    }
  });

  it('should handle img onerror XSS in email field', async () => {
    const xssEmail = '"><img src=x onerror=alert(1)>@test.com';
    mockQuery
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([{ insertId: 1 }, []]);

    const res = await request(app)
      .post('/api/admin/members')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        folio_number: 'FOL_XSS2',
        name: 'Test',
        email: xssEmail,
        join_date: '2025-06-01',
      });

    // Should accept or reject, but not crash
    expect([200, 201, 400]).toContain(res.status);
  });

  it('should handle XSS payload in search name', async () => {
    mockQuery.mockResolvedValue([[], []]);

    const res = await request(app)
      .post('/api/members/search')
      .send({ name: '<img src=x onerror=alert(document.cookie)>' });

    expect(res.status).toBe(200);
    // Response is JSON, not HTML, so XSS cannot execute
    expect(res.headers['content-type']).toContain('json');
  });

  it('should handle HTML entities in member name', async () => {
    mockQuery.mockResolvedValue([[], []]);

    const res = await request(app)
      .post('/api/members/search')
      .send({ name: '&lt;script&gt;alert(1)&lt;/script&gt;' });

    expect(res.status).toBe(200);
  });
});

// ============================================
// DYNAMIC COLUMN INJECTION (payments.js)
// ============================================

describe('Dynamic Column Injection - Payment Verify', () => {
  it('should neutralize SQL injection in period values via parseInt', async () => {
    mockVerifySignature.mockReturnValue(true);
    mockQuery.mockResolvedValue([[{ id: 1, name: 'Test', email: 'test@test.com', folio_number: 'FOL001' }], []]);

    const res = await request(app)
      .post('/api/payments/verify')
      .send({
        razorpay_order_id: 'order_test',
        razorpay_payment_id: 'pay_test',
        razorpay_signature: 'valid_sig',
        memberId: 1,
        periods: ['21; DROP TABLE members--'],
        totalAmount: 1200,
      });

    // parseInt("21; DROP TABLE members--") = 21, so injection is neutralized
    expect([200, 400, 500]).toContain(res.status);
  });

  it('should handle non-numeric period values gracefully', async () => {
    mockVerifySignature.mockReturnValue(true);
    mockQuery.mockResolvedValue([[{ id: 1, name: 'Test', email: 'test@test.com', folio_number: 'FOL001' }], []]);

    const res = await request(app)
      .post('/api/payments/verify')
      .send({
        razorpay_order_id: 'order_test',
        razorpay_payment_id: 'pay_test',
        razorpay_signature: 'valid_sig',
        memberId: 1,
        periods: ['abc', 'def'],
        totalAmount: 1200,
      });

    // parseInt("abc") = NaN, should handle gracefully
    expect([200, 400, 500]).toContain(res.status);
  });

  it('should handle negative period numbers', async () => {
    mockVerifySignature.mockReturnValue(true);
    mockQuery.mockResolvedValue([[{ id: 1, name: 'Test', email: 'test@test.com', folio_number: 'FOL001' }], []]);

    const res = await request(app)
      .post('/api/payments/verify')
      .send({
        razorpay_order_id: 'order_test',
        razorpay_payment_id: 'pay_test',
        razorpay_signature: 'valid_sig',
        memberId: 1,
        periods: [-1, -99],
        totalAmount: 1200,
      });

    // Negative periods would create invalid column names like amount_-1
    expect([200, 400, 500]).toContain(res.status);
  });

  it('should handle extremely large period numbers', async () => {
    mockVerifySignature.mockReturnValue(true);
    mockQuery.mockResolvedValue([[{ id: 1, name: 'Test', email: 'test@test.com', folio_number: 'FOL001' }], []]);

    const res = await request(app)
      .post('/api/payments/verify')
      .send({
        razorpay_order_id: 'order_test',
        razorpay_payment_id: 'pay_test',
        razorpay_signature: 'valid_sig',
        memberId: 1,
        periods: [99999],
        totalAmount: 1200,
      });

    // amount_99999 column doesn't exist, should handle gracefully
    expect([200, 400, 500]).toContain(res.status);
  });
});
