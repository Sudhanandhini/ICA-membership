import Razorpay from 'razorpay';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/**
 * Create Razorpay order
 */
export const createRazorpayOrder = async (amount, receipt, notes = {}) => {
  try {
    const options = {
      amount: amount * 100, // Amount in paise (1 INR = 100 paise)
      currency: 'INR',
      receipt: receipt,
      notes: notes
    };
    
    const order = await razorpay.orders.create(options);
    return {
      success: true,
      order
    };
  } catch (error) {
    console.error('Razorpay order creation failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Verify Razorpay payment signature
 */
export const verifyRazorpaySignature = (orderId, paymentId, signature) => {
  try {
    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');
    
    return expectedSignature === signature;
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
};

/**
 * Fetch payment details from Razorpay
 */
export const fetchPaymentDetails = async (paymentId) => {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return {
      success: true,
      payment
    };
  } catch (error) {
    console.error('Failed to fetch payment details:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Process refund (if needed)
 */
export const processRefund = async (paymentId, amount) => {
  try {
    const refund = await razorpay.payments.refund(paymentId, {
      amount: amount * 100, // Amount in paise
      speed: 'normal'
    });
    return {
      success: true,
      refund
    };
  } catch (error) {
    console.error('Refund processing failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default razorpay;
