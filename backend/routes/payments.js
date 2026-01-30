import express from 'express';
import db from '../config/database.js';

const router = express.Router();

/**
 * GET /api/payments/history/:memberId
 * Fetch complete payment history for a member
 */
router.get('/history/:memberId', async (req, res) => {
  try {
    const [members] = await db.query(`
      SELECT * FROM members_with_payments WHERE id = ?
    `, [req.params.memberId]);
    
    if (members.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Member not found' 
      });
    }
    
    const member = members[0];
    
    // Extract all payment periods
    const payments = [];
    for (let yr = 21; yr <= 28; yr++) {
      payments.push({
        period: member[`period_${yr}`],
        amount: member[`amount_${yr}`],
        paymentId: member[`payment_id_${yr}`],
        paymentDate: member[`payment_date_${yr}`],
        status: member[`amount_${yr}`] ? 'paid' : 'unpaid'
      });
    }
    
    res.json({ success: true, payments });
  } catch (error) {
    console.error('Payment history error:', error);
    res.status(500).json({ success: false, error: error.message });
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

    console.log('Calculating payment for memberId:', memberId);

    const [members] = await db.query(`
      SELECT * FROM members_with_payments WHERE id = ?
    `, [memberId]);

    if (members.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Member not found' 
      });
    }

    const member = members[0];

    // Calculate current period (April to March cycle)
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    let currentPeriod;
    if (currentMonth >= 4) {
      currentPeriod = `${currentYear}-${currentYear + 1}`;
    } else {
      currentPeriod = `${currentYear - 1}-${currentYear}`;
    }

    console.log('Current period:', currentPeriod);

    // Check all payment periods
    const paymentStatus = [];
    const unpaidPeriods = [];
    
    for (let yr = 21; yr <= 28; yr++) {
      const period = member[`period_${yr}`] || `20${yr}-20${yr + 1}`;
      const amount = member[`amount_${yr}`];
      const paymentId = member[`payment_id_${yr}`];
      const paymentDate = member[`payment_date_${yr}`];
      
      const isPaid = amount !== null && paymentId !== null;
      
      paymentStatus.push({
        period: period,
        year: `20${yr}`,
        amount: amount || 1200,
        paymentId: paymentId,
        paymentDate: paymentDate,
        status: isPaid ? 'paid' : 'unpaid'
      });
      
      // If unpaid and before/equal to current period
      if (!isPaid) {
        const periodYear = parseInt(`20${yr}`);
        const currentPeriodYear = parseInt(currentPeriod.split('-')[0]);
        
        if (periodYear <= currentPeriodYear) {
          unpaidPeriods.push({
            period: period,
            amount: 1200
          });
        }
      }
    }

    const totalDue = unpaidPeriods.length * 1200;

    console.log('Unpaid periods:', unpaidPeriods.length);
    console.log('Total due:', totalDue);

    res.json({
      success: true,
      calculation: {
        memberName: member.name,
        folioNumber: member.folio_number,
        currentPeriod: currentPeriod,
        paymentStatus: paymentStatus,
        unpaidPeriods: unpaidPeriods,
        yearsOwed: unpaidPeriods.length,
        amountPerYear: 1200,
        totalDue: totalDue,
        canPay: unpaidPeriods.length > 0
      }
    });

  } catch (error) {
    console.error('Payment calculation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/payments/initiate
 * Initiate Razorpay payment
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
    
    // Get member details
    const [members] = await db.query(`
      SELECT * FROM members_with_payments WHERE id = ?
    `, [memberId]);
    
    if (members.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }
    
    const member = members[0];
    
    // TODO: Create Razorpay order
    // For now, return mock data
    const orderId = 'order_' + Date.now();
    
    res.json({
      success: true,
      order: {
        id: orderId,
        amount: totalAmount * 100, // Razorpay expects paise
        currency: 'INR'
      },
      member: {
        name: member.name,
        email: member.email,
        folio_number: member.folio_number
      },
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_key'
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
 * Verify Razorpay payment callback
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
    
    // TODO: Verify Razorpay signature
    // For now, assume success
    
    res.json({
      success: true,
      message: 'Payment verified successfully',
      payment: {
        id: razorpay_payment_id,
        orderId: razorpay_order_id
      }
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
 * GET /api/payments/status/:memberId
 * Get current membership status
 */
router.get('/status/:memberId', async (req, res) => {
  try {
    const [members] = await db.query(`
      SELECT * FROM members_with_payments WHERE id = ?
    `, [req.params.memberId]);
    
    if (members.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Member not found' 
      });
    }
    
    res.json({ 
      success: true, 
      status: members[0].status || 'active' 
    });
  } catch (error) {
    console.error('Payment status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;