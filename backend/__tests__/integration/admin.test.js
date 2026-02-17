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
  mockQuery.mockResolvedValue([[{ 1: 1 }], []]);
});

describe('POST /api/admin/login', () => {
  it('should return token for valid credentials', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ username: 'admin', password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    // Verify token is valid JWT
    const decoded = jwt.verify(res.body.token, JWT_SECRET);
    expect(decoded.username).toBe('admin');
    expect(decoded.role).toBe('admin');
  });

  it('should return 401 for invalid credentials', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ username: 'admin', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should return 401 for empty credentials', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({});

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/admin/verify-token', () => {
  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/admin/verify-token');
    expect(res.status).toBe(401);
  });

  it('should return 401 with invalid token', async () => {
    const res = await request(app)
      .get('/api/admin/verify-token')
      .set('Authorization', 'Bearer invalid_token');

    expect(res.status).toBe(401);
  });

  it('should return success with valid token', async () => {
    const token = generateAdminToken();
    const res = await request(app)
      .get('/api/admin/verify-token')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.admin.username).toBe('admin');
  });
});

describe('GET /api/admin/members', () => {
  const token = generateAdminToken();

  it('should return 401 without auth header', async () => {
    const res = await request(app).get('/api/admin/members');
    expect(res.status).toBe(401);
  });

  it('should return paginated member list', async () => {
    const members = [
      { id: 1, name: 'Rajesh', folio_number: 'FOL001', status: 'active' },
      { id: 2, name: 'Priya', folio_number: 'FOL002', status: 'active' },
    ];
    mockQuery
      .mockResolvedValueOnce([members, []])           // members query
      .mockResolvedValueOnce([[{ total: 2 }], []]);   // count query

    const res = await request(app)
      .get('/api/admin/members')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.members).toHaveLength(2);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.totalMembers).toBe(2);
  });

  it('should support search parameter', async () => {
    mockQuery
      .mockResolvedValueOnce([[{ id: 1, name: 'Rajesh', folio_number: 'FOL001' }], []])
      .mockResolvedValueOnce([[{ total: 1 }], []]);

    const res = await request(app)
      .get('/api/admin/members?search=Rajesh')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.members).toHaveLength(1);
  });

  it('should support status filter', async () => {
    mockQuery
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[{ total: 0 }], []]);

    const res = await request(app)
      .get('/api/admin/members?status=inactive')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /api/admin/members', () => {
  const token = generateAdminToken();

  it('should return 400 for missing required fields', async () => {
    const res = await request(app)
      .post('/api/admin/members')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 for duplicate folio/email', async () => {
    mockQuery.mockResolvedValueOnce([[{ id: 1 }], []]); // existing check

    const res = await request(app)
      .post('/api/admin/members')
      .set('Authorization', `Bearer ${token}`)
      .send({
        folio_number: 'FOL001',
        name: 'Test',
        email: 'test@test.com',
        join_date: '2025-06-01',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('already exists');
  });

  it('should create member successfully', async () => {
    mockQuery
      .mockResolvedValueOnce([[], []])                           // no duplicate
      .mockResolvedValueOnce([{ insertId: 10 }, []]);            // insert

    const res = await request(app)
      .post('/api/admin/members')
      .set('Authorization', `Bearer ${token}`)
      .send({
        folio_number: 'FOL_NEW',
        name: 'New Member',
        email: 'new@test.com',
        join_date: '2025-06-01',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.memberId).toBe(10);
    expect(res.body.data.starting_period).toBe(25); // June 2025 → period 25
  });

  it('should calculate starting_period correctly for Jan-Mar join', async () => {
    mockQuery
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([{ insertId: 11 }, []]);

    const res = await request(app)
      .post('/api/admin/members')
      .set('Authorization', `Bearer ${token}`)
      .send({
        folio_number: 'FOL_JAN',
        name: 'Jan Member',
        email: 'jan@test.com',
        join_date: '2026-02-15',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.starting_period).toBe(25); // Feb 2026 → period 25 (before April)
  });
});

describe('PUT /api/admin/members/:id', () => {
  const token = generateAdminToken();

  it('should update member fields', async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const res = await request(app)
      .put('/api/admin/members/1')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name', email: 'updated@test.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('updated');
  });

  it('should return 400 when no fields to update', async () => {
    const res = await request(app)
      .put('/api/admin/members/1')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('No fields');
  });

  it('should handle payment data updates', async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const res = await request(app)
      .put('/api/admin/members/1')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount_23: 1200, payment_id_23: 'pay_manual', payment_date_23: '2023-05-01' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/admin/stats', () => {
  const token = generateAdminToken();

  it('should return dashboard statistics', async () => {
    mockQuery
      .mockResolvedValueOnce([[{ count: 100 }], []])          // active members
      .mockResolvedValueOnce([[{ count: 120 }], []])           // total members
      .mockResolvedValueOnce([[{ total_payments: 500 }], []])  // payments
      .mockResolvedValueOnce([[{ total_revenue: 600000 }], []]); // revenue

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stats.activeMembers).toBe(100);
    expect(res.body.stats.totalMembers).toBe(120);
    expect(res.body.stats.successfulPayments).toBe(500);
    expect(res.body.stats.totalRevenue).toBe(600000);
  });
});
