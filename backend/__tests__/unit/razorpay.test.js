import { describe, it, expect, vi } from 'vitest';
import crypto from 'crypto';

// Mock Razorpay as a class constructor
class MockRazorpay {
  constructor() {
    this.orders = { create: vi.fn() };
    this.payments = { fetch: vi.fn(), refund: vi.fn() };
  }
}

vi.mock('razorpay', () => ({
  default: MockRazorpay,
}));

// Set test secret before importing
process.env.RAZORPAY_KEY_SECRET = 'test_secret_key_12345';

const { verifyRazorpaySignature } = await import('../../config/razorpay.js');

describe('Razorpay Signature Verification', () => {
  const orderId = 'order_test123';
  const paymentId = 'pay_test456';

  function generateValidSignature(oId, pId) {
    const body = oId + '|' + pId;
    return crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');
  }

  it('should return true for valid signature', () => {
    const signature = generateValidSignature(orderId, paymentId);
    const result = verifyRazorpaySignature(orderId, paymentId, signature);
    expect(result).toBe(true);
  });

  it('should return false for tampered signature', () => {
    const result = verifyRazorpaySignature(orderId, paymentId, 'invalid_signature');
    expect(result).toBe(false);
  });

  it('should return false for wrong orderId', () => {
    const signature = generateValidSignature(orderId, paymentId);
    const result = verifyRazorpaySignature('wrong_order', paymentId, signature);
    expect(result).toBe(false);
  });

  it('should return false for wrong paymentId', () => {
    const signature = generateValidSignature(orderId, paymentId);
    const result = verifyRazorpaySignature(orderId, 'wrong_payment', signature);
    expect(result).toBe(false);
  });
});
