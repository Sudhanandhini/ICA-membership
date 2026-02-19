import express from 'express';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import db from '../config/database.js';
import { createRazorpayOrder, verifyRazorpaySignature } from '../config/razorpay.js';

dotenv.config();

const router = express.Router();

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
 * Send payment confirmation emails to member and admin
 */
async function sendPaymentEmails(member, paymentDetails) {
  const { paymentId, amount, periods, paymentDate } = paymentDetails;
  const periodsList = periods.join(', ');

  // Email to member
  const memberMail = {
    from: `"Membership Portal" <${process.env.EMAIL_USER}>`,
    to: member.email,
    subject: 'Payment Confirmation - Membership Portal',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 25px; border-radius: 12px 12px 0 0; text-align: center;">
          <div style="font-size: 40px; margin-bottom: 8px;">&#9989;</div>
          <h1 style="color: white; margin: 0; font-size: 22px;">Payment Successful</h1>
        </div>
        <div style="background: #ffffff; padding: 25px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #374151; font-size: 16px;">Dear <strong>${member.name}</strong>,</p>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
            Your membership payment has been received successfully. Here are the details:
          </p>
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Folio Number</td><td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${member.folio_number}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Amount Paid</td><td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">&#8377;${amount}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Period(s)</td><td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${periodsList}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Payment Date</td><td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${paymentDate}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Transaction ID</td><td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${paymentId}</td></tr>
          </table>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;" />
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            Thank you for your payment.<br/>Membership Portal Team
          </p>
        </div>
      </div>
    `
  };

  // Email to admin
  const adminMail = {
    from: `"Membership Portal" <${process.env.EMAIL_USER}>`,
    to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
    subject: `Payment Received - ${member.name} (${member.folio_number})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e46c9 0%, #2563eb 100%); padding: 25px; border-radius: 12px 12px 0 0; text-align: center;">
          <div style="font-size: 40px; margin-bottom: 8px;">&#128176;</div>
          <h1 style="color: white; margin: 0; font-size: 22px;">New Payment Received</h1>
        </div>
        <div style="background: #ffffff; padding: 25px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Member Name</td><td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${member.name}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Folio Number</td><td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${member.folio_number}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email</td><td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${member.email}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Phone</td><td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${member.phone || '-'}</td></tr>
            <tr style="background: #f0fdf4;"><td style="padding: 8px; color: #6b7280; font-size: 14px;">Amount Paid</td><td style="padding: 8px; color: #059669; font-size: 16px; font-weight: 700; text-align: right;">&#8377;${amount}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Period(s)</td><td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${periodsList}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Payment Date</td><td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${paymentDate}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Transaction ID</td><td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${paymentId}</td></tr>
          </table>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(memberMail);
    console.log(`[Payment Email] Confirmation sent to member: ${member.email}`);
  } catch (err) {
    console.error(`[Payment Email] Failed to send to member: ${err.message}`);
  }

  try {
    await transporter.sendMail(adminMail);
    console.log(`[Payment Email] Notification sent to admin: ${adminMail.to}`);
  } catch (err) {
    console.error(`[Payment Email] Failed to send to admin: ${err.message}`);
  }
}

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
    
    // Find earliest period with payment data
    let earliestPaidPeriod = null;
    for (let yr = 21; yr <= 28; yr++) {
      if (member[`amount_${yr}`] !== null && member[`payment_id_${yr}`] !== null) {
        earliestPaidPeriod = yr;
        break;
      }
    }

    // Use the earlier of starting_period or earliest paid period
    const storedStarting = member.starting_period || 21;
    const effectiveStarting = earliestPaidPeriod !== null
      ? Math.min(storedStarting, earliestPaidPeriod)
      : storedStarting;

    for (let yr = 21; yr <= 28; yr++) {
      const period = member[`period_${yr}`] || `20${yr}-20${yr + 1}`;
      const amount = member[`amount_${yr}`];
      const paymentId = member[`payment_id_${yr}`];
      const paymentDate = member[`payment_date_${yr}`];

      const isPaid = amount !== null && paymentId !== null;

      // Before effective starting period: mark as N/A
      if (yr < effectiveStarting) {
        paymentStatus.push({
          period: period,
          year: `20${yr}`,
          amount: null,
          paymentId: null,
          paymentDate: null,
          status: 'na'
        });
        continue;
      }

      paymentStatus.push({
        period: period,
        year: `20${yr}`,
        amount: amount || 1,
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
            year: `20${yr}`,
            amount: 1
          });
        }
      }
    }

    const totalDue = unpaidPeriods.length * 1;

    console.log('Unpaid periods:', unpaidPeriods.length);
    console.log('Total due:', totalDue);

    // Generate payment options
    let paymentOptions = null;

    if (unpaidPeriods.length > 0) {
      // Member has outstanding dues - offer flexible payment options
      paymentOptions = {
        type: 'outstanding',
        available: true,
        allUnpaidPeriods: unpaidPeriods,
        options: []
      };

      // Option 1: Pay whole amount at once
      paymentOptions.options.push({
        id: 'option_all',
        name: 'Pay All Outstanding',
        description: `Pay all ${unpaidPeriods.length} year(s) at once`,
        yearsCount: unpaidPeriods.length,
        periods: unpaidPeriods.map(p => p.year),
        totalAmount: unpaidPeriods.length * 1,
        years: unpaidPeriods.map(p => p.period)
      });

      // Generate options for 1, 2, 3, 4, 5 years (if applicable)
      for (let yearsCount = 1; yearsCount <= 5 && yearsCount < unpaidPeriods.length; yearsCount++) {
        const selectedPeriods = unpaidPeriods.slice(0, yearsCount);
        paymentOptions.options.push({
          id: `option_${yearsCount}year`,
          name: `Pay ${yearsCount} Year${yearsCount > 1 ? 's' : ''}`,
          description: `First ${yearsCount} year(s): ${selectedPeriods.map(p => p.period).join(', ')}`,
          yearsCount: yearsCount,
          periods: selectedPeriods.map(p => p.year),
          totalAmount: yearsCount * 1,
          years: selectedPeriods.map(p => p.period),
          remaining: unpaidPeriods.length - yearsCount
        });
      }
    } else {
      // Member has no outstanding dues - no payment needed
      paymentOptions = null;
    }

    res.json({
      success: true,
      calculation: {
        memberName: member.name,
        folioNumber: member.folio_number,
        currentPeriod: currentPeriod,
        paymentStatus: paymentStatus,
        unpaidPeriods: unpaidPeriods,
        yearsOwed: unpaidPeriods.length,
        amountPerYear: 1,
        totalDue: totalDue,
        canPay: unpaidPeriods.length > 0,
        paymentOptions: paymentOptions
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
    const { memberId, payableYears, totalAmount, optionId, periods } = req.body;
    
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
    
    // Create actual Razorpay order
    const receipt = `receipt_${memberId}_${Date.now()}`;
    const notes = {
      memberId: memberId,
      folioNumber: member.folio_number,
      memberName: member.name,
      periods: periods ? periods.join(',') : 'N/A',
      optionId: optionId || 'N/A',
      yearsCount: payableYears.length
    };
    
    const orderResult = await createRazorpayOrder(totalAmount, receipt, notes);
    
    if (!orderResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create Razorpay order',
        error: orderResult.error
      });
    }
    
    res.json({
      success: true,
      order: {
        id: orderResult.order.id,
        amount: orderResult.order.amount,
        currency: orderResult.order.currency
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
 * Verify Razorpay payment callback and update member payment records
 */
router.post('/verify', async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      memberId,
      periods,
      totalAmount
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification data'
      });
    }

    // Verify Razorpay signature
    const isValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed - invalid signature'
      });
    }

    // Update payment records in database if memberId and periods provided
    if (memberId && periods && periods.length > 0) {
      const paymentDate = new Date().toISOString().split('T')[0];
      const amountPerYear = totalAmount ? totalAmount / periods.length : 1;

      // Normalize periods to DB column numbers (e.g., "2024" → 24, 26 → 26)
      const periodNums = periods.map(p => {
        const str = p.toString();
        return str.length === 4 ? parseInt(str.slice(-2)) : parseInt(str);
      });

      const updates = [];
      const params = [];

      periodNums.forEach(num => {
        updates.push(`amount_${num} = ?`);
        params.push(amountPerYear);
        updates.push(`payment_id_${num} = ?`);
        params.push(razorpay_payment_id);
        updates.push(`payment_date_${num} = ?`);
        params.push(paymentDate);
      });

      updates.push('updated_at = NOW()');
      params.push(memberId);

      await db.query(
        `UPDATE members_with_payments SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      console.log(`[Payment] Updated periods [${periodNums.join(',')}] for member ${memberId}`);

      // Fetch member details and send emails
      const [members] = await db.query('SELECT name, email, phone, folio_number FROM members_with_payments WHERE id = ?', [memberId]);
      if (members.length > 0) {
        const periodNames = periodNums.map(n => `20${n}-${n + 1}`);
        sendPaymentEmails(members[0], {
          paymentId: razorpay_payment_id,
          amount: totalAmount,
          periods: periodNames,
          paymentDate
        });

        // Build activated years for receipt
        const activatedYears = periodNums.map(n => ({
          start: `20${n}-04-01`,
          end: `20${n + 1}-03-31`
        }));

        return res.json({
          success: true,
          message: 'Payment verified successfully',
          payment: {
            id: razorpay_payment_id,
            orderId: razorpay_order_id,
            amount: totalAmount,
            date: new Date().toISOString(),
            method: 'Online',
            status: 'Success'
          },
          member: {
            name: members[0].name,
            email: members[0].email,
            folio_number: members[0].folio_number
          },
          activatedYears
        });
      }
    }

    res.json({
      success: true,
      message: 'Payment verified successfully',
      payment: {
        id: razorpay_payment_id,
        orderId: razorpay_order_id,
        amount: totalAmount,
        date: new Date().toISOString(),
        method: 'Online',
        status: 'Success'
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