import crypto from 'crypto';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// In-memory OTP store: email -> { otp, expiresAt, attempts }
const otpStore = new Map();

// Rate limit store: email -> { count, resetAt }
const rateLimitStore = new Map();

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_SENDS_PER_WINDOW = 3;
const MAX_VERIFY_ATTEMPTS = 5;

// Create nodemailer transporter
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT) || 587;
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: EMAIL_PORT,
  secure: EMAIL_PORT === 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  }
});

/**
 * Generate a 6-digit OTP
 */
export function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Mask email for display: sudha@gmail.com → s***a@gmail.com
 */
export function maskEmail(email) {
  const [name, domain] = email.split('@');
  if (name.length <= 2) {
    return `${name[0]}***@${domain}`;
  }
  return `${name[0]}${'*'.repeat(Math.min(name.length - 2, 4))}${name[name.length - 1]}@${domain}`;
}

/**
 * Check rate limit for email
 */
function checkRateLimit(email) {
  const now = Date.now();
  const record = rateLimitStore.get(email);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(email, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_SENDS_PER_WINDOW) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Store OTP for an email
 */
export function storeOTP(email, otp) {
  otpStore.set(email.toLowerCase(), {
    otp,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0
  });
}

/**
 * Verify OTP for an email
 * Returns: { valid: boolean, error?: string }
 */
export function verifyOTP(email, otp) {
  const key = email.toLowerCase();
  const record = otpStore.get(key);

  if (!record) {
    return { valid: false, error: 'OTP expired or not found. Please request a new OTP.' };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(key);
    return { valid: false, error: 'OTP has expired. Please request a new OTP.' };
  }

  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    otpStore.delete(key);
    return { valid: false, error: 'Too many failed attempts. Please request a new OTP.' };
  }

  if (record.otp !== otp) {
    record.attempts++;
    const remaining = MAX_VERIFY_ATTEMPTS - record.attempts;
    return { valid: false, error: `Invalid OTP. ${remaining} attempt(s) remaining.` };
  }

  // OTP is valid — delete it (one-time use)
  otpStore.delete(key);
  return { valid: true };
}

/**
 * Send OTP email to member
 */
export async function sendOTPEmail(email, memberName, otp) {
  // Check rate limit
  if (!checkRateLimit(email.toLowerCase())) {
    throw new Error('Too many OTP requests. Please try again after some time.');
  }

  const mailOptions = {
    from: `"Membership Portal" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your Verification Code - Membership Portal',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Membership Portal</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #374151; font-size: 16px;">Hello <strong>${memberName}</strong>,</p>
          <p style="color: #6b7280; font-size: 14px;">Your verification code is:</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1f2937;">${otp}</span>
          </div>
          <p style="color: #6b7280; font-size: 13px;">This code is valid for <strong>5 minutes</strong>.</p>
          <p style="color: #6b7280; font-size: 13px;">If you did not request this code, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            Do not share this code with anyone.
          </p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
}

// Cleanup expired OTPs every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of otpStore) {
    if (now > record.expiresAt) {
      otpStore.delete(key);
    }
  }
  for (const [key, record] of rateLimitStore) {
    if (now > record.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);
