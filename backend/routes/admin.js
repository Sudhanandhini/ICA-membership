import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import db from '../config/database.js';
import { parseExcelFile, importMembers } from '../utils/excelImportICA.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// PERIOD UTILITY FUNCTIONS
// ============================================

/**
 * Get period name - Fixed format
 * period_21 = "2021-22", period_22 = "2022-23", etc.
 */
function getPeriodName(periodNumber) {
  const startYear = 2000 + periodNumber;
  const endYear = startYear + 1;
  return `${startYear}-${endYear.toString().slice(-2)}`; // "2021-22"
}

/**
 * Calculate period number from date - Financial Year (April to March)
 * Period 25 = April 2025 to March 2026
 * Period 26 = April 2026 to March 2027
 * 
 * Examples:
 * - Feb 2026 → Period 25 (because Feb is before April)
 * - May 2026 → Period 26 (because May is after April)
 */
function calculatePeriodFromDate(date) {
  const dateObj = new Date(date);
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1; // 1-12
  
  // Financial year starts in April
  // If month is April (4) onwards, use current year
  // If month is Jan-Mar (1-3), use previous period
  if (month >= 4) {
    return year - 2000; // Apr 2026 onwards → period 26
  } else {
    return year - 2000 - 1; // Jan-Mar 2026 → period 25
  }
}

// ============================================
// FILE UPLOAD CONFIGURATION
// ============================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls, .csv) are allowed'));
    }
  }
});

/**
 * POST /api/admin/import-excel
 */
router.post('/import-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const filePath = req.file.path;
    const parseResult = parseExcelFile(filePath);
    
    if (!parseResult.success) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        error: parseResult.error
      });
    }

    const importResult = await importMembers(parseResult.data);
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      totalRows: importResult.total,
      membersAdded: importResult.added,
      membersUpdated: importResult.updated,
      paymentsAdded: importResult.paymentsAdded,
      errors: importResult.errors,
      errorDetails: importResult.errorDetails
    });

  } catch (error) {
    console.error('Import error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/members
 */
router.get('/members', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status || 'active';
    const search = req.query.search || '';

    let query = `SELECT * FROM members_with_payments WHERE status = ?`;
    const params = [status];

    if (search) {
      query += ` AND (name LIKE ? OR folio_number LIKE ? OR email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY name ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [members] = await db.query(query, params);

    let countQuery = `SELECT COUNT(*) as total FROM members_with_payments WHERE status = ?`;
    const countParams = [status];
    
    if (search) {
      countQuery += ` AND (name LIKE ? OR folio_number LIKE ? OR email LIKE ?)`;
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [countResult] = await db.query(countQuery, countParams);
    const totalMembers = countResult[0].total;

    res.json({
      success: true,
      members,
      pagination: {
        page,
        limit,
        totalMembers,
        totalPages: Math.ceil(totalMembers / limit)
      }
    });

  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin/members
 * Add new member - payment plan will be chosen by member during payment
 */
router.post('/members', async (req, res) => {
  try {
    const { 
      folio_number, 
      name, 
      email, 
      phone, 
      gender, 
      address, 
      pin_code, 
      state, 
      chapter, 
      member_class,
      join_date
    } = req.body;

    console.log('Received member data:', req.body);

    // Validate required fields
    if (!folio_number || !name || !email || !join_date) {
      return res.status(400).json({
        success: false,
        error: 'Folio number, name, email, and join date are required'
      });
    }

    // Calculate starting period
    const startingPeriod = calculatePeriodFromDate(join_date);
    console.log('Join Date:', join_date);
    console.log('Starting Period:', startingPeriod);

    // Check if folio/email exists
    const [existingMember] = await db.query(
      'SELECT id FROM members_with_payments WHERE folio_number = ? OR email = ?',
      [folio_number, email]
    );

    if (existingMember.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Folio number or email already exists'
      });
    }

    // Build period data
    // Payment plan will be chosen by member later
    const periodColumns = [];
    const periodValues = [];

    for (let periodNum = 21; periodNum <= 28; periodNum++) {
      periodColumns.push(`period_${periodNum}`);
      periodColumns.push(`amount_${periodNum}`);
      periodColumns.push(`payment_id_${periodNum}`);
      periodColumns.push(`payment_date_${periodNum}`);

      if (periodNum < startingPeriod) {
        // PAST PERIODS: amount = 0.00, payment_id = NULL
        periodValues.push(getPeriodName(periodNum)); // e.g., "2021-22"
        periodValues.push(0.00);                      // amount = 0.00
        periodValues.push(null);                      // payment_id = NULL
        periodValues.push(null);                      // payment_date = NULL
      } else {
        // APPLICABLE PERIODS: amount = NULL (will be set when member chooses plan)
        periodValues.push(getPeriodName(periodNum)); // e.g., "2026-27"
        periodValues.push(null);                      // amount = NULL
        periodValues.push(null);                      // payment_id = NULL
        periodValues.push(null);                      // payment_date = NULL
      }
    }

    const insertQuery = `
      INSERT INTO members_with_payments (
        folio_number, name, email, phone, gender, address, pin_code, state, chapter, 
        member_class, status, join_date, starting_period,
        ${periodColumns.join(', ')}
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?,
        ${periodValues.map(() => '?').join(', ')}
      )
    `;

    const insertParams = [
      folio_number,
      name,
      email,
      phone || '0000000000',
      gender || 'Male',
      address || null,
      pin_code || null,
      state || null,
      chapter || null,
      member_class || 'New',
      join_date,
      startingPeriod,
      ...periodValues
    ];

    const [result] = await db.query(insertQuery, insertParams);

    res.json({
      success: true,
      message: 'Member added successfully. Member can choose payment plan when making payment.',
      data: {
        memberId: result.insertId,
        folio_number,
        name,
        join_date,
        starting_period: startingPeriod
      }
    });

  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/members/:id/payments
 */
router.get('/members/:id/payments', async (req, res) => {
  try {
    const { id } = req.params;

    const [members] = await db.query(`SELECT * FROM members_with_payments WHERE id = ?`, [id]);

    if (members.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Member not found'
      });
    }

    const member = members[0];
    const payments = [];
    
    for (let yr = 21; yr <= 28; yr++) {
      const period = member[`period_${yr}`];
      const amount = member[`amount_${yr}`];
      const paymentId = member[`payment_id_${yr}`];
      const paymentDate = member[`payment_date_${yr}`];
      
      let status;
      let displayAmount;
      
      if (amount === 0 || amount === 0.00 || amount === '0.00') {
        // Past period - member hadn't joined
        status = 'not_applicable';
        displayAmount = 'N/A';
      } else if (paymentId && amount && parseFloat(amount) > 0) {
        // Paid
        status = 'paid';
        displayAmount = `₹${parseFloat(amount).toLocaleString()}`;
      } else if (amount && parseFloat(amount) > 0) {
        // Unpaid but has amount (needs to pay)
        status = 'unpaid';
        displayAmount = `₹${parseFloat(amount).toLocaleString()}`;
      } else {
        // Future period not yet applicable
        status = 'future';
        displayAmount = '-';
      }

      payments.push({
        periodNumber: yr,
        period: period || getPeriodName(yr),
        amount: amount ? parseFloat(amount) : null,
        paymentId: paymentId || null,
        paymentDate: paymentDate || null,
        status: status,
        displayAmount: displayAmount
      });
    }

    res.json({
      success: true,
      member: {
        id: member.id,
        name: member.name,
        folio_number: member.folio_number,
        email: member.email,
        phone: member.phone,
        join_date: member.join_date,
        starting_period: member.starting_period
      },
      payments: payments,
      summary: {
        totalPeriods: payments.length,
        paidPeriods: payments.filter(p => p.status === 'paid').length,
        unpaidPeriods: payments.filter(p => p.status === 'unpaid').length,
        notApplicablePeriods: payments.filter(p => p.status === 'not_applicable').length,
        totalRevenue: payments
          .filter(p => p.status === 'paid' && p.amount)
          .reduce((sum, p) => sum + p.amount, 0)
      }
    });

  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const [activeResult] = await db.query(`SELECT COUNT(*) as count FROM members_with_payments WHERE status = 'active'`);
    const [totalResult] = await db.query(`SELECT COUNT(*) as count FROM members_with_payments WHERE status != 'removed'`);

    const [paymentsResult] = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM members_with_payments WHERE amount_21 > 0 AND payment_id_21 IS NOT NULL) +
        (SELECT COUNT(*) FROM members_with_payments WHERE amount_22 > 0 AND payment_id_22 IS NOT NULL) +
        (SELECT COUNT(*) FROM members_with_payments WHERE amount_23 > 0 AND payment_id_23 IS NOT NULL) +
        (SELECT COUNT(*) FROM members_with_payments WHERE amount_24 > 0 AND payment_id_24 IS NOT NULL) +
        (SELECT COUNT(*) FROM members_with_payments WHERE amount_25 > 0 AND payment_id_25 IS NOT NULL) +
        (SELECT COUNT(*) FROM members_with_payments WHERE amount_26 > 0 AND payment_id_26 IS NOT NULL) +
        (SELECT COUNT(*) FROM members_with_payments WHERE amount_27 > 0 AND payment_id_27 IS NOT NULL) +
        (SELECT COUNT(*) FROM members_with_payments WHERE amount_28 > 0 AND payment_id_28 IS NOT NULL)
        as total_payments
    `);

    const [revenueResult] = await db.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN amount_21 > 0 THEN amount_21 ELSE 0 END), 0) +
        COALESCE(SUM(CASE WHEN amount_22 > 0 THEN amount_22 ELSE 0 END), 0) +
        COALESCE(SUM(CASE WHEN amount_23 > 0 THEN amount_23 ELSE 0 END), 0) +
        COALESCE(SUM(CASE WHEN amount_24 > 0 THEN amount_24 ELSE 0 END), 0) +
        COALESCE(SUM(CASE WHEN amount_25 > 0 THEN amount_25 ELSE 0 END), 0) +
        COALESCE(SUM(CASE WHEN amount_26 > 0 THEN amount_26 ELSE 0 END), 0) +
        COALESCE(SUM(CASE WHEN amount_27 > 0 THEN amount_27 ELSE 0 END), 0) +
        COALESCE(SUM(CASE WHEN amount_28 > 0 THEN amount_28 ELSE 0 END), 0)
        as total_revenue
      FROM members_with_payments
    `);

    res.json({
      success: true,
      stats: {
        activeMembers: activeResult[0].count,
        totalMembers: totalResult[0].count,
        successfulPayments: paymentsResult[0].total_payments,
        totalRevenue: parseFloat(revenueResult[0].total_revenue) || 0
      }
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/admin/members/:id
 */
router.put('/members/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, name, email, phone, join_date, starting_period } = req.body;

    const updates = [];
    const params = [];

    if (status) { updates.push('status = ?'); params.push(status); }
    if (name) { updates.push('name = ?'); params.push(name); }
    if (email) { updates.push('email = ?'); params.push(email); }
    if (phone) { updates.push('phone = ?'); params.push(phone); }
    if (join_date) { updates.push('join_date = ?'); params.push(join_date); }
    if (starting_period) { updates.push('starting_period = ?'); params.push(starting_period); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    await db.query(`UPDATE members_with_payments SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({ success: true, message: 'Member updated successfully' });

  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/monthly-report
 */
router.get('/monthly-report', async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = req.query.month ? parseInt(req.query.month) : null;

    const [members] = await db.query('SELECT * FROM members_with_payments WHERE status = "active"');

    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(year, i, 1).toLocaleString('default', { month: 'long' }),
      monthNumber: i + 1,
      payments: 0,
      revenue: 0
    }));

    let totalPayments = 0;
    let totalRevenue = 0;
    const transactions = [];

    members.forEach(member => {
      for (let yr = 21; yr <= 28; yr++) {
        const amount = member[`amount_${yr}`];
        const paymentDate = member[`payment_date_${yr}`];
        const paymentId = member[`payment_id_${yr}`];
        const period = member[`period_${yr}`];

        if (amount && amount > 0 && paymentDate && paymentId && period) {
          const pDate = new Date(paymentDate);
          const paymentYear = pDate.getFullYear();
          const paymentMonth = pDate.getMonth();

          if (paymentYear === year) {
            monthlyData[paymentMonth].payments += 1;
            monthlyData[paymentMonth].revenue += parseFloat(amount);
            totalPayments += 1;
            totalRevenue += parseFloat(amount);

            if (month === null || paymentMonth === (month - 1)) {
              transactions.push({
                id: `${member.id}-${yr}`,
                folio_number: member.folio_number,
                name: member.name,
                period: period,
                amount: parseFloat(amount),
                payment_id: paymentId,
                payment_date: paymentDate
              });
            }
          }
        }
      }
    });

    transactions.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));

    res.json({
      success: true,
      year: year,
      selectedMonth: month,
      monthlyData: monthlyData,
      transactions: transactions,
      summary: {
        totalPayments,
        totalRevenue
      }
    });

  } catch (error) {
    console.error('Monthly report error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/yearly-report
 */
router.get('/yearly-report', async (req, res) => {
  try {
    const [members] = await db.query('SELECT * FROM members_with_payments WHERE status = "active"');
    const yearlyData = {};

    members.forEach(member => {
      for (let yr = 21; yr <= 28; yr++) {
        const amount = member[`amount_${yr}`];
        const paymentDate = member[`payment_date_${yr}`];
        const paymentId = member[`payment_id_${yr}`];

        if (amount && amount > 0 && paymentDate && paymentId) {
          const year = new Date(paymentDate).getFullYear();

          if (!yearlyData[year]) {
            yearlyData[year] = { year: year, payments: 0, revenue: 0 };
          }

          yearlyData[year].payments += 1;
          yearlyData[year].revenue += parseFloat(amount);
        }
      }
    });

    const yearlyArray = Object.values(yearlyData).sort((a, b) => b.year - a.year);

    res.json({ success: true, yearlyData: yearlyArray });

  } catch (error) {
    console.error('Yearly report error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/members/payment-status
 */
/**
 * GET /api/admin/members/payment-status
 */
router.get('/members/payment-status', async (req, res) => {
  try {
    const { year, status, page = 1, limit = 20, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    // Convert year format: both "2021-2022" and "2021-22" should work
    let normalizedYear = year;
    if (year && year.includes('-')) {
      const parts = year.split('-');
      if (parts[1].length === 4) {
        // Convert "2021-2022" to "2021-22"
        normalizedYear = `${parts[0]}-${parts[1].slice(-2)}`;
      }
    }
    
    const yearToPeriod = {
      '2021-22': 21, '2022-23': 22, '2023-24': 23, '2024-25': 24,
      '2025-26': 25, '2026-27': 26, '2027-28': 27, '2028-29': 28
    };

    const periodNum = yearToPeriod[normalizedYear];
    
    if (!periodNum) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid year format. Expected format: 2021-22 or 2021-2022' 
      });
    }

    const amountCol = `amount_${periodNum}`;
    const paymentIdCol = `payment_id_${periodNum}`;

    let query = 'SELECT * FROM members_with_payments WHERE 1=1';
    const params = [];

    if (status === 'paid') {
      query += ` AND ${amountCol} > 0 AND ${paymentIdCol} IS NOT NULL`;
    } else if (status === 'unpaid') {
      query += ` AND ${amountCol} > 0 AND ${paymentIdCol} IS NULL`;
    }

    if (search) {
      query += ` AND (name LIKE ? OR folio_number LIKE ? OR email LIKE ?)`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    query += ` ORDER BY folio_number ASC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const [members] = await db.query(query, params);

    let countQuery = 'SELECT COUNT(*) as total FROM members_with_payments WHERE 1=1';
    const countParams = [];

    if (status === 'paid') {
      countQuery += ` AND ${amountCol} > 0 AND ${paymentIdCol} IS NOT NULL`;
    } else if (status === 'unpaid') {
      countQuery += ` AND ${amountCol} > 0 AND ${paymentIdCol} IS NULL`;
    }

    if (search) {
      countQuery += ` AND (name LIKE ? OR folio_number LIKE ? OR email LIKE ?)`;
      const searchParam = `%${search}%`;
      countParams.push(searchParam, searchParam, searchParam);
    }

    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      members: members,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalMembers: total,
        totalPages: Math.ceil(total / limit)
      },
      filters: { year: normalizedYear, status, search }
    });

  } catch (error) {
    console.error('Payment status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/members/update-status-by-payment
 */
/**
 * PUT /api/admin/members/update-status-by-payment
 */
router.put('/members/update-status-by-payment', async (req, res) => {
  try {
    const { year } = req.body;
    
    // Convert year format
    let normalizedYear = year;
    if (year && year.includes('-')) {
      const parts = year.split('-');
      if (parts[1].length === 4) {
        normalizedYear = `${parts[0]}-${parts[1].slice(-2)}`;
      }
    }
    
    const yearToPeriod = {
      '2021-22': 21, '2022-23': 22, '2023-24': 23, '2024-25': 24,
      '2025-26': 25, '2026-27': 26, '2027-28': 27, '2028-29': 28
    };

    const periodNum = yearToPeriod[normalizedYear];
    
    if (!periodNum) {
      return res.status(400).json({ success: false, error: 'Invalid year format' });
    }

    const amountCol = `amount_${periodNum}`;
    const paymentIdCol = `payment_id_${periodNum}`;

    const [inactiveResult] = await db.query(`
      UPDATE members_with_payments 
      SET status = 'inactive'
      WHERE ${amountCol} > 0 AND ${paymentIdCol} IS NULL
      AND status != 'removed'
    `);

    const [activeResult] = await db.query(`
      UPDATE members_with_payments 
      SET status = 'active'
      WHERE ${amountCol} > 0 AND ${paymentIdCol} IS NOT NULL
      AND status != 'removed'
    `);

    res.json({
      success: true,
      message: 'Member statuses updated',
      updated: {
        inactive: inactiveResult.affectedRows,
        active: activeResult.affectedRows
      }
    });

  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;