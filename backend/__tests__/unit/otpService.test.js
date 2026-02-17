import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock nodemailer before importing otpService
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue(true),
    })),
  },
}));

const { generateOTP, maskEmail, storeOTP, verifyOTP } = await import('../../utils/otpService.js');

describe('OTP Service', () => {
  describe('generateOTP', () => {
    it('should return a 6-digit string', () => {
      const otp = generateOTP();
      expect(otp).toMatch(/^\d{6}$/);
    });

    it('should return different OTPs on multiple calls', () => {
      const otps = new Set(Array.from({ length: 10 }, () => generateOTP()));
      expect(otps.size).toBeGreaterThan(1);
    });
  });

  describe('maskEmail', () => {
    it('should mask email with long name', () => {
      const masked = maskEmail('sudha@gmail.com');
      expect(masked).toBe('s***a@gmail.com');
    });

    it('should mask email with 3-char name', () => {
      const masked = maskEmail('abc@gmail.com');
      expect(masked).toBe('a*c@gmail.com');
    });

    it('should mask email with 2-char name', () => {
      const masked = maskEmail('ab@x.com');
      expect(masked).toBe('a***@x.com');
    });

    it('should mask email with 1-char name', () => {
      const masked = maskEmail('a@x.com');
      expect(masked).toBe('a***@x.com');
    });

    it('should preserve domain', () => {
      const masked = maskEmail('test@example.org');
      expect(masked).toContain('@example.org');
    });
  });

  describe('storeOTP + verifyOTP', () => {
    beforeEach(() => {
      // Each test uses a unique email to avoid interference
    });

    it('should verify correct OTP successfully', () => {
      const email = 'test-valid@example.com';
      const otp = '123456';
      storeOTP(email, otp);
      const result = verifyOTP(email, otp);
      expect(result).toEqual({ valid: true });
    });

    it('should be case-insensitive for email', () => {
      const otp = '654321';
      storeOTP('Test@Example.com', otp);
      const result = verifyOTP('test@example.com', otp);
      expect(result).toEqual({ valid: true });
    });

    it('should reject wrong OTP and show remaining attempts', () => {
      const email = 'test-wrong@example.com';
      storeOTP(email, '111111');
      const result = verifyOTP(email, '000000');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid OTP');
      expect(result.error).toContain('4 attempt(s) remaining');
    });

    it('should reject after max verification attempts', () => {
      const email = 'test-maxattempts@example.com';
      storeOTP(email, '111111');
      for (let i = 0; i < 5; i++) {
        verifyOTP(email, '000000');
      }
      const result = verifyOTP(email, '111111');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Too many failed attempts');
    });

    it('should reject non-existent email', () => {
      const result = verifyOTP('nonexistent@example.com', '123456');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired or not found');
    });

    it('should reject expired OTP', () => {
      const email = 'test-expired@example.com';
      storeOTP(email, '111111');
      // Manually expire by mocking Date.now
      const originalDateNow = Date.now;
      Date.now = () => originalDateNow() + 6 * 60 * 1000; // 6 minutes later
      const result = verifyOTP(email, '111111');
      Date.now = originalDateNow;
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should delete OTP after successful verification (one-time use)', () => {
      const email = 'test-onetime@example.com';
      storeOTP(email, '999999');
      verifyOTP(email, '999999'); // first use
      const result = verifyOTP(email, '999999'); // second use
      expect(result.valid).toBe(false);
    });
  });
});
