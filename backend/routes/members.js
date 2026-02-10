import express from 'express';
import db from '../config/database.js';
import { generateOTP, maskEmail, storeOTP, verifyOTP, sendOTPEmail } from '../utils/otpService.js';

const router = express.Router();

/**
 * Get period name from period number
 */
function getPeriodName(periodNumber) {
  const startYear = 2000 + periodNumber;
  const endYear = startYear + 1;
  return `${startYear}-${endYear.toString().slice(-2)}`; // "2021-22"
}

/**
 * POST /api/members/search
 * Search for members by name - prioritizes exact matches
 */
router.post('/search', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.json({ success: true, members: [] });
    }

    // Search with prioritization:
    // 1. Exact match (case-insensitive)
    // 2. Starts with search term
    // 3. Contains search term
    const [members] = await db.query(`
      SELECT * 
      FROM members_with_payments
      WHERE name LIKE ? 
      AND status = 'active'
      ORDER BY 
        CASE 
          WHEN LOWER(name) = LOWER(?) THEN 1
          WHEN LOWER(name) LIKE LOWER(?) THEN 2
          ELSE 3
        END,
        name
      LIMIT 20
    `, [`%${name}%`, name, `${name}%`]);
    
    res.json({ success: true, members });
  } catch (error) {
    console.error('Member search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/members/:id
 * Get member details by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const [members] = await db.query(`
      SELECT * 
      FROM members_with_payments
      WHERE id = ?
    `, [req.params.id]);
    
    if (members.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Member not found' 
      });
    }
    
    res.json({ success: true, member: members[0] });
  } catch (error) {
    console.error('Get member error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/members/folio/:folioNumber
 * Get member details by folio number
 */
router.get('/folio/:folioNumber', async (req, res) => {
  try {
    const { folioNumber } = req.params;
    
    const [members] = await db.query(`
      SELECT * 
      FROM members_with_payments
      WHERE folio_number = ?
    `, [folioNumber]);
    
    if (members.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }
    
    res.json({
      success: true,
      member: members[0]
    });
    
  } catch (error) {
    console.error('Member fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch member details',
      error: error.message
    });
  }
});

/**
 * GET /api/members/:id/payment-calculation
 * Calculate payment for a specific member - FIXED VERSION
 * Only shows periods from member's starting_period onwards
 */
router.get('/:id/payment-calculation', async (req, res) => {
  try {
    const { id } = req.params;

    const [members] = await db.query(
      'SELECT * FROM members_with_payments WHERE id = ?',
      [id]
    );

    if (members.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Member not found'
      });
    }

    const member = members[0];

    // -----------------------------
    // Determine starting period
    // -----------------------------
    let startingPeriod = member.starting_period;

    if (!startingPeriod) {
      if (member.join_date) {
        const joinYear = new Date(member.join_date).getFullYear();
        startingPeriod = joinYear - 2000;
      } else {
        startingPeriod = new Date().getFullYear() - 2000;
      }
    }

    console.log(`Starting Period: ${startingPeriod}`);

    const paymentStatus = [];
    const unpaidPeriods = [];

    for (let periodNum = startingPeriod; periodNum <= 28; periodNum++) {
      const periodName = member[`period_${periodNum}`];
      const amount = member[`amount_${periodNum}`];
      const paymentId = member[`payment_id_${periodNum}`];
      const paymentDate = member[`payment_date_${periodNum}`];

      // Generate period name if missing
      const defaultPeriod = getPeriodName(periodNum);
      const finalPeriod = periodName || defaultPeriod;

      let status = "unpaid";

      if (amount === 0) {
        continue; // skip past exempt years
      }

      if (paymentId && amount > 0) {
        status = "paid";
      } else if (amount === null || paymentId == null) {
        status = "unpaid";
        unpaidPeriods.push({
          periodNumber: periodNum,
          period: finalPeriod,
          amount: 1200
        });
      }

      paymentStatus.push({
        periodNumber: periodNum,
        period: finalPeriod,
        amount: amount,
        paymentId,
        paymentDate,
        status
      });
    }

    const totalDue = unpaidPeriods.length * 1200;

    res.json({
      success: true,
      calculation: {
        memberId: member.id,
        memberName: member.name,
        startingPeriod,
        paymentStatus,
        unpaidPeriods,
        totalDue,
        yearsOwed: unpaidPeriods.length
      }
    });

  } catch (error) {
    console.error('Payment calculation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate payment'
    });
  }
});


/**
 * POST /api/members/:id/select-plan
 * Member selects payment plan (1-year or 3-year)
 */
router.post('/:id/select-plan', async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_plan } = req.body; // "1_year" or "3_year"

    if (!payment_plan || (payment_plan !== '1_year' && payment_plan !== '3_year')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment plan. Must be "1_year" or "3_year"'
      });
    }

    // Get member details
    const [members] = await db.query(
      'SELECT * FROM members_with_payments WHERE id = ?',
      [id]
    );

    if (members.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Member not found'
      });
    }

    const member = members[0];
    const startingPeriod = member.starting_period;

    if (!startingPeriod) {
      return res.status(400).json({
        success: false,
        error: 'Member starting period not set'
      });
    }

    console.log(`Member ${member.folio_number} selecting plan: ${payment_plan}`);

    // Find first unpaid period (sequential payment enforcement)
    let firstUnpaidPeriod = null;
    for (let periodNum = startingPeriod; periodNum <= 28; periodNum++) {
      const amount = member[`amount_${periodNum}`];
      const paymentId = member[`payment_id_${periodNum}`];
      
      // Find first period that is unpaid (either amount is NULL or no payment_id)
      if (!paymentId && (amount === null || amount === 0 || !amount)) {
        firstUnpaidPeriod = periodNum;
        break;
      }
    }

    if (!firstUnpaidPeriod) {
      return res.status(400).json({
        success: false,
        error: 'No unpaid periods found or all periods are already paid'
      });
    }

    console.log(`First unpaid period: ${firstUnpaidPeriod}`);

    // Update database based on plan
    const updateFields = [];
    const updateValues = [];

    if (payment_plan === '1_year') {
      // 1-year plan: Set amount for first unpaid period only
      updateFields.push(`amount_${firstUnpaidPeriod} = ?`);
      updateValues.push(1200);
      
    } else if (payment_plan === '3_year') {
      // 3-year plan: Set amount and period name for 3 consecutive periods
      const multiYearPeriodName = `20${firstUnpaidPeriod}-${firstUnpaidPeriod + 3}`;
      
      for (let i = 0; i < 3; i++) {
        const periodNum = firstUnpaidPeriod + i;
        if (periodNum <= 28) {
          updateFields.push(`period_${periodNum} = ?`);
          updateValues.push(multiYearPeriodName);
          updateFields.push(`amount_${periodNum} = ?`);
          updateValues.push(1133.33);
        }
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No periods to update'
      });
    }

    updateValues.push(id);

    const updateQuery = `
      UPDATE members_with_payments 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;

    console.log('Update Query:', updateQuery);
    console.log('Update Values:', updateValues);

    await db.query(updateQuery, updateValues);

    // Calculate new total amount
    const totalAmount = payment_plan === '1_year' ? 1200 : 3400;
    const years = payment_plan === '1_year' ? 1 : 3;

    res.json({
      success: true,
      message: 'Payment plan selected successfully',
      data: {
        payment_plan: payment_plan,
        totalAmount: totalAmount,
        years: years,
        firstUnpaidPeriod: firstUnpaidPeriod
      }
    });

  } catch (error) {
    console.error('Select plan error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to select payment plan'
    });
  }
});

/**
 * POST /api/members/create
 * Create new member (for admin use)
 */
router.post('/create', async (req, res) => {
  try {
    const { name, phone, email, folio_number, gender, address, pin_code, state, chapter } = req.body;

    if (!name || !email || !folio_number) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and folio number are required'
      });
    }

    // Check duplicate
    const [existing] = await db.query(
      'SELECT id FROM members_with_payments WHERE folio_number = ?',
      [folio_number]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Folio number already exists'
      });
    }

    // Get joining year → starting period
    const joinDate = new Date();
    const joinYear = joinDate.getFullYear();
    const startingPeriod = joinYear - 2000; // For example: 2026 → 26

    const [result] = await db.query(`
      INSERT INTO members_with_payments (
        folio_number, gender, name, email, phone, address,
        pin_code, state, chapter, member_class, status,
        
        period_21, amount_21,
        period_22, amount_22,
        period_23, amount_23,
        period_24, amount_24,
        period_25, amount_25,

        period_26, amount_26,
        period_27, amount_27,
        period_28, amount_28,

        join_date, starting_period
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', 'active',

        '2021-22', 0,
        '2022-23', 0,
        '2023-24', 0,
        '2024-25', 0,
        '2025-26', 0,

        '2026-27', NULL,
        '2027-28', NULL,
        '2028-29', NULL,

        ?, ?
      )
    `, [
      folio_number, gender || 'Male', name, email, phone || '0000000000',
      address, pin_code, state, chapter,

      joinDate, startingPeriod
    ]);

    res.status(201).json({
      success: true,
      message: 'Member created successfully',
      memberId: result.insertId,
      startingPeriod
    });

  } catch (error) {
    console.error('Member creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create member',
      error: error.message
    });
  }
});

/**
 * POST /api/members/send-otp
 * Send OTP to member's registered email
 */
router.post('/send-otp', async (req, res) => {
  try {
    const { memberId } = req.body;

    if (!memberId) {
      return res.status(400).json({ success: false, error: 'Member ID is required' });
    }

    const [members] = await db.query(
      'SELECT id, name, email FROM members_with_payments WHERE id = ? AND status = "active"',
      [memberId]
    );

    if (members.length === 0) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }

    const member = members[0];

    if (!member.email) {
      return res.status(400).json({ success: false, error: 'No email address found for this member' });
    }

    const otp = generateOTP();
    storeOTP(member.email, otp);

    await sendOTPEmail(member.email, member.name, otp);

    console.log(`OTP sent to ${maskEmail(member.email)} for member ${member.name}`);

    res.json({
      success: true,
      message: 'OTP sent successfully',
      email: maskEmail(member.email)
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send OTP'
    });
  }
});

/**
 * POST /api/members/verify-otp
 * Verify OTP and return member data
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { memberId, otp } = req.body;

    if (!memberId || !otp) {
      return res.status(400).json({ success: false, error: 'Member ID and OTP are required' });
    }

    const [members] = await db.query(
      'SELECT * FROM members_with_payments WHERE id = ? AND status = "active"',
      [memberId]
    );

    if (members.length === 0) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }

    const member = members[0];
    const result = verifyOTP(member.email, otp);

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      verified: true,
      member: member
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify OTP'
    });
  }
});

export default router;