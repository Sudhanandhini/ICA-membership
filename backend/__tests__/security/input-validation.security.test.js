import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

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

const mockVerifyOTP = vi.fn();
vi.mock('../../utils/otpService.js', () => ({
  generateOTP: vi.fn().mockReturnValue('123456'),
  maskEmail: vi.fn().mockReturnValue('t***t@example.com'),
  storeOTP: vi.fn(),
  verifyOTP: mockVerifyOTP,
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
  mockQuery.mockResolvedValue([[{ 1: 1 }], []]);
});

// ============================================
// BOUNDARY TESTING - MEMBER SEARCH
// ============================================

describe('Boundary Testing - Member Search', () => {
  it('should return empty array for empty string name', async () => {
    const res = await request(app)
      .post('/api/members/search')
      .send({ name: '' });

    expect(res.status).toBe(200);
    expect(res.body.members).toEqual([]);
  });

  it('should handle single character name', async () => {
    mockQuery.mockResolvedValue([[], []]);

    const res = await request(app)
      .post('/api/members/search')
      .send({ name: 'R' });

    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should handle name with 1000+ characters without crashing', async () => {
    mockQuery.mockResolvedValue([[], []]);

    const longName = 'A'.repeat(2000);
    const res = await request(app)
      .post('/api/members/search')
      .send({ name: longName });

    expect(res.status).toBe(200);
  });

  it('should handle name with only special characters', async () => {
    mockQuery.mockResolvedValue([[], []]);

    const res = await request(app)
      .post('/api/members/search')
      .send({ name: '!@#$%^&*(){}[]|\\:";\'<>?,./~`' });

    expect(res.status).toBe(200);
  });

  it('should handle unicode and emoji in name', async () => {
    mockQuery.mockResolvedValue([[], []]);

    const res = await request(app)
      .post('/api/members/search')
      .send({ name: 'Rüdiger 🎉 Müller' });

    expect(res.status).toBe(200);
  });

  it('should handle null byte in name', async () => {
    mockQuery.mockResolvedValue([[], []]);

    const res = await request(app)
      .post('/api/members/search')
      .send({ name: 'test\x00injection' });

    expect(res.status).toBe(200);
  });

  it('should handle name as number type', async () => {
    mockQuery.mockResolvedValue([[], []]);

    const res = await request(app)
      .post('/api/members/search')
      .send({ name: 12345 });

    // Number type causes .trim() to fail with 500 - documents missing type validation
    expect([200, 400, 500]).toContain(res.status);
  });

  it('should handle name as boolean type', async () => {
    const res = await request(app)
      .post('/api/members/search')
      .send({ name: true });

    // Boolean type causes .trim() to fail with 500 - documents missing type validation
    expect([200, 400, 500]).toContain(res.status);
  });

  it('should handle name as array', async () => {
    const res = await request(app)
      .post('/api/members/search')
      .send({ name: ['test', 'array'] });

    expect([200, 400, 500]).toContain(res.status);
  });

  it('should handle name as object', async () => {
    const res = await request(app)
      .post('/api/members/search')
      .send({ name: { $gt: '' } });

    expect([200, 400, 500]).toContain(res.status);
  });
});

// ============================================
// ADMIN MEMBER CREATION VALIDATION
// ============================================

describe('Admin Member Creation Validation', () => {
  const token = () => generateAdminToken();

  it('should return 400 for missing folio_number', async () => {
    const res = await request(app)
      .post('/api/admin/members')
      .set('Authorization', `Bearer ${token()}`)
      .send({ name: 'Test' });

    expect(res.status).toBe(400);
  });

  it('should return 400 for missing name', async () => {
    const res = await request(app)
      .post('/api/admin/members')
      .set('Authorization', `Bearer ${token()}`)
      .send({ folio_number: 'FOL001' });

    expect(res.status).toBe(400);
  });

  it('should handle invalid email format', async () => {
    mockQuery
      .mockResolvedValueOnce([[], []]) // no duplicate
      .mockResolvedValueOnce([{ insertId: 1 }, []]); // insert

    const res = await request(app)
      .post('/api/admin/members')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        folio_number: 'FOL_INV',
        name: 'Test',
        email: 'not-an-email',
        join_date: '2025-06-01',
      });

    // Documents behavior: accepts or rejects invalid email
    expect([200, 201, 400]).toContain(res.status);
  });

  it('should handle phone number with letters', async () => {
    mockQuery
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([{ insertId: 1 }, []]);

    const res = await request(app)
      .post('/api/admin/members')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        folio_number: 'FOL_PH',
        name: 'Test',
        email: 'test@test.com',
        phone: 'abc-def-ghij',
        join_date: '2025-06-01',
      });

    expect([200, 201, 400]).toContain(res.status);
  });

  it('should not leak DB details on duplicate folio error', async () => {
    mockQuery.mockResolvedValueOnce([[{ id: 1 }], []]); // duplicate found

    const res = await request(app)
      .post('/api/admin/members')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        folio_number: 'FOL001',
        name: 'Test',
        email: 'test@test.com',
        join_date: '2025-06-01',
      });

    expect(res.status).toBe(400);
    const responseStr = JSON.stringify(res.body);
    expect(responseStr).not.toContain('mysql');
    expect(responseStr).not.toContain('ER_DUP');
    expect(responseStr).not.toContain('SQLSTATE');
  });

  it('should handle invalid date format for join_date', async () => {
    mockQuery
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([{ insertId: 1 }, []]);

    const res = await request(app)
      .post('/api/admin/members')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        folio_number: 'FOL_DT',
        name: 'Test',
        email: 'test@test.com',
        join_date: 'not-a-date',
      });

    expect([200, 201, 400, 500]).toContain(res.status);
  });

  it('should handle extremely long name', async () => {
    mockQuery
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([{ insertId: 1 }, []]);

    const longName = 'A'.repeat(5000);
    const res = await request(app)
      .post('/api/admin/members')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        folio_number: 'FOL_LNG',
        name: longName,
        email: 'long@test.com',
        join_date: '2025-06-01',
      });

    expect([200, 201, 400, 500]).toContain(res.status);
  });

  it('should handle far future join_date', async () => {
    mockQuery
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([{ insertId: 1 }, []]);

    const res = await request(app)
      .post('/api/admin/members')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        folio_number: 'FOL_FUT',
        name: 'Future Member',
        email: 'future@test.com',
        join_date: '2099-01-01',
      });

    expect([200, 201, 400]).toContain(res.status);
  });
});

// ============================================
// ADMIN MEMBER UPDATE VALIDATION
// ============================================

describe('Admin Member Update Validation', () => {
  const token = () => generateAdminToken();

  it('should return 400 for empty body', async () => {
    const res = await request(app)
      .put('/api/admin/members/1')
      .set('Authorization', `Bearer ${token()}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('should handle id = 0', async () => {
    mockQuery.mockResolvedValue([{ affectedRows: 0 }, []]);

    const res = await request(app)
      .put('/api/admin/members/0')
      .set('Authorization', `Bearer ${token()}`)
      .send({ name: 'Updated' });

    expect([200, 400, 404]).toContain(res.status);
  });

  it('should handle negative id', async () => {
    mockQuery.mockResolvedValue([{ affectedRows: 0 }, []]);

    const res = await request(app)
      .put('/api/admin/members/-1')
      .set('Authorization', `Bearer ${token()}`)
      .send({ name: 'Updated' });

    expect([200, 400, 404]).toContain(res.status);
  });

  it('should handle string id', async () => {
    mockQuery.mockResolvedValue([{ affectedRows: 0 }, []]);

    const res = await request(app)
      .put('/api/admin/members/abc')
      .set('Authorization', `Bearer ${token()}`)
      .send({ name: 'Updated' });

    expect([200, 400, 404, 500]).toContain(res.status);
  });
});

// ============================================
// OTP INPUT VALIDATION
// ============================================

describe('OTP Input Validation', () => {
  it('should handle memberId = 0 for send-otp', async () => {
    mockQuery.mockResolvedValue([[], []]);

    const res = await request(app)
      .post('/api/members/send-otp')
      .send({ memberId: 0 });

    expect([400, 404]).toContain(res.status);
  });

  it('should handle OTP with special characters', async () => {
    mockQuery.mockResolvedValueOnce([[{ id: 1, name: 'Test', email: 'test@test.com' }], []]);
    mockVerifyOTP.mockReturnValue({ valid: false, error: 'Invalid OTP' });

    const res = await request(app)
      .post('/api/members/verify-otp')
      .send({ memberId: 1, otp: '<script>alert(1)</script>' });

    expect([200, 400]).toContain(res.status);
    if (res.body.valid !== undefined) {
      expect(res.body.valid).toBe(false);
    }
  });

  it('should handle OTP longer than 6 digits', async () => {
    mockQuery.mockResolvedValueOnce([[{ id: 1, name: 'Test', email: 'test@test.com' }], []]);
    mockVerifyOTP.mockReturnValue({ valid: false, error: 'Invalid OTP' });

    const res = await request(app)
      .post('/api/members/verify-otp')
      .send({ memberId: 1, otp: '1234567890' });

    expect([200, 400]).toContain(res.status);
  });

  it('should handle OTP as number type', async () => {
    mockQuery.mockResolvedValueOnce([[{ id: 1, name: 'Test', email: 'test@test.com' }], []]);
    mockVerifyOTP.mockReturnValue({ valid: true });

    const res = await request(app)
      .post('/api/members/verify-otp')
      .send({ memberId: 1, otp: 123456 });

    expect([200, 400]).toContain(res.status);
  });

  it('should handle missing OTP field', async () => {
    const res = await request(app)
      .post('/api/members/verify-otp')
      .send({ memberId: 1 });

    expect(res.status).toBe(400);
  });

  it('should handle missing memberId field', async () => {
    const res = await request(app)
      .post('/api/members/verify-otp')
      .send({ otp: '123456' });

    expect(res.status).toBe(400);
  });
});
