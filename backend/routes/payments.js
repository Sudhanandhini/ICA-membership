import express from 'express';
import db from '../config/database.js';
import { createRazorpayOrder, verifyRazorpaySignature, fetchPaymentDetails } from '../config/razorpay.js';
import { calculatePayableYears, formatAmount } from '../utils/paymentUtils.js';

const router = express.Router();

/**
 * GET /api/payments/history/:memberId
 * Fetch complete payment history for a member
 */
router.get('/history/:memberId', async (req, res) => {
  try {
    const { memberId } = req.params;
    
    const query = `
      SELECT 
        id,
        membership_year_start,
        membership_year_end,
        amount,
        payment_status,
        payment_date,
        transaction_id,
        razorpay_order_id,
        razorpay_payment_id,
        created_at
      FROM membership_payments
      WHERE member_id = ?
      ORDER BY membership_year_start ASC
    `;
    
    const [payments] = await db.query(query, [memberId]);
    
    res.json({
      success: true,
      count: payments.length,
      payments
    });
    
  } catch (error) {
    console.error('Payment history fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history',
      error: error.message
    });
  }
});

/**
 * POST /api/payments/calculate
 * Calculate payable years and total amount based on payment history
 */
router.post('/calculate', async (req, res) => {
  try {
    const { memberId } = req.body;
    
    if (!memberId) {
      return res.status(400).json({
        success: false,
        message: 'Member ID is required'
      });
    }
    
    // Fetch payment history
    const query = `
      SELECT 
        membership_year_start,
        membership_year_end,
        payment_status
      FROM membership_payments
      WHERE member_id = ? AND payment_status = 'success'
      ORDER BY membership_year_start ASC
    `;
    
    const [payments] = await db.query(query, [memberId]);
    
    // Calculate payable years using utility function
    const calculation = calculatePayableYears(payments);
    
    res.json({
      success: true,
      ...calculation,
      formattedAmount: formatAmount(calculation.totalAmount)
    });
    
  } catch (error) {
    console.error('Payment calculation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate payment',
      error: error.message
    });
  }
});

/**
 * POST /api/payments/initiate
 * Initiate payment gateway transaction
 */
router.post('/initiate', async (req, res) => {
  try {
    const { memberId, payableYears, totalAmount } = req.body;
    
    if (!memberId || !payableYears || !totalAmount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    // Verify member exists
    const memberQuery = 'SELECT id, name, email, folio_number FROM members WHERE id = ?';
    const [members] = await db.query(memberQuery, [memberId]);
    
    if (members.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }
    
    const member = members[0];
    
    // Create receipt ID
    const receiptId = `RCPT_${member.folio_number}_${Date.now()}`;
    
    // Create Razorpay order
    const orderResult = await createRazorpayOrder(
      totalAmount,
      receiptId,
      {
        member_id: memberId,
        member_name: member.name,
        folio_number: member.folio_number,
        years_count: payableYears.length
      }
    );
    
    if (!orderResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create payment order',
        error: orderResult.error
      });
    }
    
    const order = orderResult.order;
    
    // Create pending payment records for each year
    const insertPromises = payableYears.map(year => {
      const insertQuery = `
        INSERT INTO membership_payments 
        (member_id, membership_year_start, membership_year_end, amount, payment_status, razorpay_order_id)
        VALUES (?, ?, ?, ?, 'pending', ?)
        ON DUPLICATE KEY UPDATE 
        razorpay_order_id = VALUES(razorpay_order_id),
        payment_status = 'pending'
      `;
      return db.query(insertQuery, [
        memberId,
        year.start,
        year.end,
        totalAmount / payableYears.length,
        order.id
      ]);
    });
    
    await Promise.all(insertPromises);
    
    // Return order details for frontend
    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt
      },
      member: {
        name: member.name,
        email: member.email,
        folio_number: member.folio_number
      },
      razorpayKeyId: process.env.RAZORPAY_KEY_ID
    });
    
  } catch (error) {
    console.error('Payment initiation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate payment',
      error: error.message
    });
  }
});

/**
 * POST /api/payments/verify
 * Verify payment callback from Razorpay
 */
router.post('/verify', async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;
    
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification data'
      });
    }
    
    // Verify signature
    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );
    
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }
    
    // Fetch payment details from Razorpay
    const paymentResult = await fetchPaymentDetails(razorpay_payment_id);
    
    if (!paymentResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch payment details'
      });
    }
    
    const payment = paymentResult.payment;
    
    // Update payment records in database
    const updateQuery = `
      UPDATE membership_payments
      SET 
        payment_status = 'success',
        payment_date = NOW(),
        razorpay_payment_id = ?,
        razorpay_signature = ?,
        transaction_id = ?
      WHERE razorpay_order_id = ?
    `;
    
    await db.query(updateQuery, [
      razorpay_payment_id,
      razorpay_signature,
      payment.id,
      razorpay_order_id
    ]);
    
    // Get updated payment records
    const selectQuery = `
      SELECT 
        m.name, m.email, m.folio_number,
        mp.membership_year_start, mp.membership_year_end
      FROM membership_payments mp
      JOIN members m ON mp.member_id = m.id
      WHERE mp.razorpay_order_id = ?
    `;
    
    const [records] = await db.query(selectQuery, [razorpay_order_id]);
    
    res.json({
      success: true,
      message: 'Payment verified successfully',
      payment: {
        id: payment.id,
        amount: payment.amount / 100,
        status: payment.status,
        method: payment.method
      },
      activatedYears: records.map(r => ({
        start: r.membership_year_start,
        end: r.membership_year_end
      })),
      member: records.length > 0 ? {
        name: records[0].name,
        email: records[0].email,
        folio_number: records[0].folio_number
      } : null
    });
    
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error.message
    });
  }
});

/**
 * POST /api/payments/webhook
 * Handle Razorpay webhooks
 */
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    
    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }
    
    const event = req.body.event;
    const payload = req.body.payload.payment.entity;
    
    // Handle different webhook events
    if (event === 'payment.captured') {
      // Payment was captured successfully
      console.log('Payment captured:', payload.id);
    } else if (event === 'payment.failed') {
      // Payment failed
      const updateQuery = `
        UPDATE membership_payments
        SET payment_status = 'failed'
        WHERE razorpay_order_id = ?
      `;
      await db.query(updateQuery, [payload.order_id]);
    }
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/payments/status/:memberId
 * Get current membership status
 */
router.get('/status/:memberId', async (req, res) => {
  try {
    const { memberId } = req.params;
    
    const query = `
      SELECT 
        mp.*,
        m.name, m.folio_number
      FROM membership_payments mp
      JOIN members m ON mp.member_id = m.id
      WHERE mp.member_id = ? AND mp.payment_status = 'success'
      ORDER BY mp.membership_year_end DESC
      LIMIT 1
    `;
    
    const [payments] = await db.query(query, [memberId]);
    
    if (payments.length === 0) {
      return res.json({
        success: true,
        status: 'inactive',
        message: 'No active membership'
      });
    }
    
    const latestPayment = payments[0];
    const endDate = new Date(latestPayment.membership_year_end);
    const today = new Date();
    
    res.json({
      success: true,
      status: endDate >= today ? 'active' : 'expired',
      latestPaidYear: {
        start: latestPayment.membership_year_start,
        end: latestPayment.membership_year_end
      },
      member: {
        name: latestPayment.name,
        folio_number: latestPayment.folio_number
      }
    });
    
  } catch (error) {
    console.error('Status fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch membership status',
      error: error.message
    });
  }
});

export default router;
