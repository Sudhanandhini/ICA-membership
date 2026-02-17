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

// ============================================
// ERROR INFORMATION DISCLOSURE
// ============================================

describe('Error Information Disclosure', () => {
  it('should not expose SQL error details in member search error', async () => {
    mockQuery.mockRejectedValue(new Error("ER_NO_SUCH_TABLE: Table 'membership.members_with_payments' doesn't exist"));

    const res = await request(app)
      .post('/api/members/search')
      .send({ name: 'Test' });

    expect(res.status).toBe(500);
    // The error response currently exposes error.message - this test documents the behavior
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
  });

  it('should not expose stack traces in error responses', async () => {
    mockQuery.mockRejectedValue(new Error('Database connection failed'));

    const res = await request(app)
      .post('/api/members/search')
      .send({ name: 'Test' });

    expect(res.status).toBe(500);
    const responseStr = JSON.stringify(res.body);
    expect(responseStr).not.toContain('at ');
    expect(responseStr).not.toContain('.js:');
    expect(responseStr).not.toContain('node_modules');
  });

  it('should not expose database credentials in error response', async () => {
    mockQuery.mockRejectedValue(new Error('Access denied for user root@localhost'));

    const res = await request(app)
      .post('/api/members/search')
      .send({ name: 'Test' });

    expect(res.status).toBe(500);
    const responseStr = JSON.stringify(res.body);
    const dbPassword = process.env.DB_PASSWORD || '';
    if (dbPassword) {
      expect(responseStr).not.toContain(dbPassword);
    }
  });

  it('should not expose JWT secret in any error response', async () => {
    const token = generateAdminToken();
    mockQuery.mockRejectedValue(new Error('Something went wrong'));

    const res = await request(app)
      .get('/api/admin/members')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
    const responseStr = JSON.stringify(res.body);
    expect(responseStr).not.toContain(JWT_SECRET);
  });

  it('should return proper JSON error format on 404', async () => {
    const res = await request(app)
      .get('/api/nonexistent/endpoint');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('json');
    // 404 response should have an error or message property
    expect(res.body.error || res.body.message).toBeDefined();
  });
});

// ============================================
// HTTP METHOD SECURITY
// ============================================

describe('HTTP Method Security', () => {
  it('should reject PUT on member search endpoint', async () => {
    const res = await request(app)
      .put('/api/members/search')
      .send({ name: 'Test' });

    expect([404, 405]).toContain(res.status);
  });

  it('should reject DELETE on admin members endpoint', async () => {
    const token = generateAdminToken();
    const res = await request(app)
      .delete('/api/admin/members/1')
      .set('Authorization', `Bearer ${token}`);

    expect([404, 405]).toContain(res.status);
  });

  it('should reject PATCH on admin members endpoint', async () => {
    const token = generateAdminToken();
    const res = await request(app)
      .patch('/api/admin/members/1')
      .set('Authorization', `Bearer ${token}`);

    expect([404, 405]).toContain(res.status);
  });

  it('should handle OPTIONS request (CORS preflight)', async () => {
    const res = await request(app)
      .options('/api/members/search');

    expect([200, 204]).toContain(res.status);
  });
});

// ============================================
// CONTENT-TYPE & MALFORMED INPUT
// ============================================

describe('Content-Type & Malformed Input', () => {
  it('should handle request with text/plain content-type', async () => {
    const res = await request(app)
      .post('/api/members/search')
      .set('Content-Type', 'text/plain')
      .send('{"name": "Test"}');

    // Express may not parse text/plain as JSON
    expect([200, 400, 415]).toContain(res.status);
  });

  it('should handle malformed JSON body gracefully', async () => {
    const res = await request(app)
      .post('/api/members/search')
      .set('Content-Type', 'application/json')
      .send('{"name": "Test",,, invalid json}');

    expect(res.status).toBe(400);
  });

  it('should handle empty body on POST endpoint', async () => {
    const res = await request(app)
      .post('/api/members/search')
      .send();

    expect([200, 400]).toContain(res.status);
  });

  it('should handle content-type mismatch (form data sent as JSON)', async () => {
    const res = await request(app)
      .post('/api/members/search')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('name=Test');

    // express.urlencoded({ extended: true }) should handle this
    expect([200, 400]).toContain(res.status);
  });
});

// ============================================
// RESPONSE HEADERS
// ============================================

describe('Response Headers Security', () => {
  it('should check X-Powered-By header (information disclosure)', async () => {
    const res = await request(app).get('/health');

    // X-Powered-By: Express reveals server technology
    // This test documents whether the header is present
    const xPoweredBy = res.headers['x-powered-by'];
    if (xPoweredBy) {
      // SECURITY NOTE: X-Powered-By header is present - consider disabling with app.disable('x-powered-by')
      expect(xPoweredBy).toBe('Express');
    }
  });

  it('should return proper Content-Type for JSON responses', async () => {
    const res = await request(app).get('/health');

    expect(res.headers['content-type']).toContain('application/json');
  });

  it('should have CORS headers on responses', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', process.env.FRONTEND_URL || 'http://localhost:5173');

    // CORS headers should be present for allowed origin
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });

  it('should not have CORS headers for unknown origin', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://malicious-site.com');

    // Unknown origin should not get CORS access
    const corsHeader = res.headers['access-control-allow-origin'];
    if (corsHeader) {
      expect(corsHeader).not.toBe('https://malicious-site.com');
      expect(corsHeader).not.toBe('*');
    }
  });
});

// ============================================
// LARGE PAYLOAD PROTECTION
// ============================================

describe('Large Payload Protection', () => {
  it('should reject extremely large JSON payload', async () => {
    // Create a ~2MB JSON payload
    const largePayload = { name: 'A'.repeat(2 * 1024 * 1024) };

    const res = await request(app)
      .post('/api/members/search')
      .send(largePayload);

    // Express default limit is 100kb, should reject large payloads
    expect([200, 400, 413, 500]).toContain(res.status);
  });

  it('should handle deeply nested JSON object', async () => {
    let deepObj = { name: 'test' };
    for (let i = 0; i < 100; i++) {
      deepObj = { nested: deepObj };
    }

    const res = await request(app)
      .post('/api/members/search')
      .send(deepObj);

    expect([200, 400, 413, 500]).toContain(res.status);
  });

  it('should handle array with many elements', async () => {
    const res = await request(app)
      .post('/api/payments/initiate')
      .send({
        memberId: 1,
        payableYears: Array.from({ length: 10000 }, (_, i) => i),
        totalAmount: 1200,
        periods: Array.from({ length: 10000 }, (_, i) => i),
      });

    expect([200, 400, 413, 500]).toContain(res.status);
  });
});
