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

// Configure multer for file uploads
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
 * Import members from Excel file
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
    
    // Parse Excel file
    const parseResult = parseExcelFile(filePath);
    
    if (!parseResult.success) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        error: parseResult.error
      });
    }

    // Import members
    const importResult = await importMembers(parseResult.data);
    
    // Clean up uploaded file
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
 * Get all members with pagination and filters
 */
router.get('/members', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status || 'active';
    const search = req.query.search || '';

    let query = `
      SELECT * FROM members_with_payments
      WHERE status = ?
    `;
    const params = [status];

    if (search) {
      query += ` AND (name LIKE ? OR folio_number LIKE ? OR email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY name ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [members] = await db.query(query, params);

    // Get total count
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
 * GET /api/admin/members/:id/payments
 * Get payment history for a specific member
 */
/**
 * POST /api/admin/members
 * Add a new member
 */
router.post('/members', async (req, res) => {
  try {
    const { folio_number, name, email, phone, gender, address, pin_code, state, chapter, member_class } = req.body;

    // Validate required fields
    if (!folio_number || !name || !email) {
      return res.status(400).json({
        success: false,
        error: 'Folio number, name, and email are required'
      });
    }

    // Check if folio number already exists
    const [existingMember] = await db.query(
      'SELECT id FROM members_with_payments WHERE folio_number = ?',
      [folio_number]
    );

    if (existingMember.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Folio number already exists'
      });
    }

    // Insert new member with all payment periods initialized as NULL
    const [result] = await db.query(`
      INSERT INTO members_with_payments (
        folio_number, name, email, phone, gender, address, pin_code, state, chapter, member_class, status,
        period_21, amount_21, payment_id_21, payment_date_21,
        period_22, amount_22, payment_id_22, payment_date_22,
        period_23, amount_23, payment_id_23, payment_date_23,
        period_24, amount_24, payment_id_24, payment_date_24,
        period_25, amount_25, payment_id_25, payment_date_25,
        period_26, amount_26, payment_id_26, payment_date_26,
        period_27, amount_27, payment_id_27, payment_date_27,
        period_28, amount_28, payment_id_28, payment_date_28
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active',
        '2021-2022', NULL, NULL, NULL,
        '2022-2023', NULL, NULL, NULL,
        '2023-2024', NULL, NULL, NULL,
        '2024-2025', NULL, NULL, NULL,
        '2025-2026', NULL, NULL, NULL,
        '2026-2027', NULL, NULL, NULL,
        '2027-2028', NULL, NULL, NULL,
        '2028-2029', NULL, NULL, NULL
      )
    `, [
      folio_number,
      name,
      email,
      phone || '0000000000',
      gender || 'Male',
      address || null,
      pin_code || null,
      state || null,
      chapter || null,
      member_class || 'New'
    ]);

    res.json({
      success: true,
      message: 'Member added successfully',
      memberId: result.insertId
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
 * Get payment history for a specific member
 */
router.get('/members/:id/payments', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('Fetching payment history for member ID:', id);

    const [members] = await db.query(`
      SELECT * FROM members_with_payments WHERE id = ?
    `, [id]);

    if (members.length === 0) {
      console.log('Member not found:', id);
      return res.status(404).json({
        success: false,
        error: 'Member not found'
      });
    }

    const member = members[0];
    console.log('Found member:', member.name, member.folio_number);

    // Extract payment history
    const payments = [];
    
    for (let yr = 21; yr <= 28; yr++) {
      const period = member[`period_${yr}`] || `20${yr}-20${yr + 1}`;
      const amount = member[`amount_${yr}`];
      const paymentId = member[`payment_id_${yr}`];
      const paymentDate = member[`payment_date_${yr}`];
      
      // ✅ FIXED: Status is "paid" ONLY if payment_id exists (not just amount)
      const isPaid = paymentId !== null && paymentId !== undefined && paymentId !== '';

      payments.push({
        period: period,
        yearStart: `20${yr}`,
        yearEnd: `20${yr + 1}`,
        amount: amount ? parseFloat(amount) : null,
        paymentId: paymentId || null,
        paymentDate: paymentDate || null,
        status: isPaid ? 'paid' : 'unpaid',
        displayAmount: amount ? `₹${parseFloat(amount).toLocaleString()}` : '-'
      });
    }

    console.log(`Found ${payments.filter(p => p.status === 'paid').length} paid periods`);

    res.json({
      success: true,
      member: {
        id: member.id,
        name: member.name,
        folio_number: member.folio_number,
        email: member.email,
        phone: member.phone,
        gender: member.gender,
        address: member.address,
        state: member.state,
        chapter: member.chapter,
        member_class: member.member_class,
        status: member.status
      },
      payments: payments,
      summary: {
        totalPeriods: payments.length,
        paidPeriods: payments.filter(p => p.status === 'paid').length,
        unpaidPeriods: payments.filter(p => p.status === 'unpaid').length,
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
 * Get dashboard statistics
 */
router.get('/stats', async (req, res) => {
  try {
    // Active members
    const [activeResult] = await db.query(`
      SELECT COUNT(*) as count FROM members_with_payments WHERE status = 'active'
    `);

    // Total members (excluding removed)
    const [totalResult] = await db.query(`
      SELECT COUNT(*) as count FROM members_with_payments WHERE status != 'removed'
    `);

    // Count successful payments across all periods
    const [paymentsResult] = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM members_with_payments WHERE amount_21 IS NOT NULL) +
        (SELECT COUNT(*) FROM members_with_payments WHERE amount_22 IS NOT NULL) +
        (SELECT COUNT(*) FROM members_with_payments WHERE amount_23 IS NOT NULL) +
        (SELECT COUNT(*) FROM members_with_payments WHERE amount_24 IS NOT NULL) +
        (SELECT COUNT(*) FROM members_with_payments WHERE amount_25 IS NOT NULL) +
        (SELECT COUNT(*) FROM members_with_payments WHERE amount_26 IS NOT NULL) +
        (SELECT COUNT(*) FROM members_with_payments WHERE amount_27 IS NOT NULL) +
        (SELECT COUNT(*) FROM members_with_payments WHERE amount_28 IS NOT NULL)
        as total_payments
    `);

    // Calculate total revenue
    const [revenueResult] = await db.query(`
      SELECT 
        COALESCE(SUM(amount_21), 0) + COALESCE(SUM(amount_22), 0) + 
        COALESCE(SUM(amount_23), 0) + COALESCE(SUM(amount_24), 0) +
        COALESCE(SUM(amount_25), 0) + COALESCE(SUM(amount_26), 0) +
        COALESCE(SUM(amount_27), 0) + COALESCE(SUM(amount_28), 0)
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
 * Update member status or details
 */
router.put('/members/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, name, email, phone } = req.body;

    const updates = [];
    const params = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (name) {
      updates.push('name = ?');
      params.push(name);
    }
    if (email) {
      updates.push('email = ?');
      params.push(email);
    }
    if (phone) {
      updates.push('phone = ?');
      params.push(phone);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    await db.query(`
      UPDATE members_with_payments 
      SET ${updates.join(', ')}
      WHERE id = ?
    `, params);

    res.json({
      success: true,
      message: 'Member updated successfully'
    });

  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/**
 * GET /api/admin/monthly-report
 * Get monthly payment report for a specific year
 */
// router.get('/monthly-report', async (req, res) => {
//   try {
//     const year = parseInt(req.query.year) || new Date().getFullYear();

//     console.log('Generating monthly report for year:', year);

//     // Get all payments for the specified year
//     const [members] = await db.query('SELECT * FROM members_with_payments WHERE status = "active"');

//     // Initialize monthly data
//     const monthlyData = Array.from({ length: 12 }, (_, i) => ({
//       month: new Date(year, i, 1).toLocaleString('default', { month: 'long' }),
//       monthNumber: i + 1,
//       payments: 0,
//       revenue: 0
//     }));

//     let totalPayments = 0;
//     let totalRevenue = 0;

//     // Process each member's payments
//     members.forEach(member => {
//       // Check all 8 payment periods
//       for (let yr = 21; yr <= 28; yr++) {
//         const amount = member[`amount_${yr}`];
//         const paymentDate = member[`payment_date_${yr}`];
//         const paymentId = member[`payment_id_${yr}`];

//         // Only count if payment is complete (has amount, date, and ID)
//         if (amount && paymentDate && paymentId) {
//           const pDate = new Date(paymentDate);
//           const paymentYear = pDate.getFullYear();
//           const paymentMonth = pDate.getMonth(); // 0-11

//           // If payment was made in the requested year
//           if (paymentYear === year) {
//             monthlyData[paymentMonth].payments += 1;
//             monthlyData[paymentMonth].revenue += parseFloat(amount);
//             totalPayments += 1;
//             totalRevenue += parseFloat(amount);
//           }
//         }
//       }
//     });

//     res.json({
//       success: true,
//       year: year,
//       monthlyData: monthlyData,
//       summary: {
//         totalPayments,
//         totalRevenue
//       }
//     });

//   } catch (error) {
//     console.error('Monthly report error:', error);
//     res.status(500).json({
//       success: false,
//       error: error.message
//     });
//   }
// });


/**
 * GET /api/admin/monthly-report
 * Get monthly payment report for a specific year with detailed transactions
 */
/**
 * GET /api/admin/monthly-report
 * Get monthly payment report with filters
 */
router.get('/monthly-report', async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = req.query.month ? parseInt(req.query.month) : null;
    
    // Filter parameters
    const filters = {
      search: req.query.search || '', // Search in name, folio, email
      dateFrom: req.query.dateFrom || null,
      dateTo: req.query.dateTo || null,
      period: req.query.period || null,
      amountMin: req.query.amountMin ? parseFloat(req.query.amountMin) : null,
      amountMax: req.query.amountMax ? parseFloat(req.query.amountMax) : null,
      chapter: req.query.chapter || null
    };

    console.log('Generating monthly report with filters:', { year, month, filters });

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

        if (amount && paymentDate && paymentId) {
          const pDate = new Date(paymentDate);
          const paymentYear = pDate.getFullYear();
          const paymentMonth = pDate.getMonth();

          if (paymentYear === year) {
            monthlyData[paymentMonth].payments += 1;
            monthlyData[paymentMonth].revenue += parseFloat(amount);
            totalPayments += 1;
            totalRevenue += parseFloat(amount);

            if (month === null || paymentMonth === (month - 1)) {
              const transaction = {
                id: `${member.id}-${yr}`,
                folio_number: member.folio_number,
                name: member.name,
                email: member.email,
                phone: member.phone,
                chapter: member.chapter || 'N/A',
                period: period || `20${yr}-20${yr + 1}`,
                amount: parseFloat(amount),
                payment_id: paymentId,
                payment_date: paymentDate,
                month: new Date(paymentDate).toLocaleString('default', { month: 'long' }),
                monthNumber: paymentMonth + 1,
                year: paymentYear
              };

              // Apply filters
              let includeTransaction = true;

              // Search filter (name, folio, email)
              if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                includeTransaction = 
                  transaction.name.toLowerCase().includes(searchLower) ||
                  transaction.folio_number.toLowerCase().includes(searchLower) ||
                  transaction.email.toLowerCase().includes(searchLower);
              }

              // Date range filter
              if (includeTransaction && filters.dateFrom) {
                includeTransaction = new Date(transaction.payment_date) >= new Date(filters.dateFrom);
              }
              if (includeTransaction && filters.dateTo) {
                includeTransaction = new Date(transaction.payment_date) <= new Date(filters.dateTo);
              }

              // Period filter
              if (includeTransaction && filters.period) {
                includeTransaction = transaction.period === filters.period;
              }

              // Amount range filter
              if (includeTransaction && filters.amountMin !== null) {
                includeTransaction = transaction.amount >= filters.amountMin;
              }
              if (includeTransaction && filters.amountMax !== null) {
                includeTransaction = transaction.amount <= filters.amountMax;
              }

              // Chapter filter
              if (includeTransaction && filters.chapter) {
                includeTransaction = transaction.chapter === filters.chapter;
              }

              if (includeTransaction) {
                transactions.push(transaction);
              }
            }
          }
        }
      }
    });

    transactions.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));

    // Calculate filtered totals
    const filteredTotalPayments = transactions.length;
    const filteredTotalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);

    res.json({
      success: true,
      year: year,
      selectedMonth: month,
      filters: filters,
      monthlyData: monthlyData,
      transactions: transactions,
      summary: {
        totalPayments,
        totalRevenue,
        filteredPayments: filteredTotalPayments,
        filteredRevenue: filteredTotalRevenue
      }
    });

  } catch (error) {
    console.error('Monthly report error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
/**
 * GET /api/admin/yearly-report
 * Get yearly payment summary
 */
router.get('/yearly-report', async (req, res) => {
  try {
    console.log('Generating yearly report');

    const [members] = await db.query('SELECT * FROM members_with_payments WHERE status = "active"');

    // Group payments by year
    const yearlyData = {};

    members.forEach(member => {
      for (let yr = 21; yr <= 28; yr++) {
        const amount = member[`amount_${yr}`];
        const paymentDate = member[`payment_date_${yr}`];
        const paymentId = member[`payment_id_${yr}`];

        if (amount && paymentDate && paymentId) {
          const pDate = new Date(paymentDate);
          const year = pDate.getFullYear();

          if (!yearlyData[year]) {
            yearlyData[year] = {
              year: year,
              payments: 0,
              revenue: 0
            };
          }

          yearlyData[year].payments += 1;
          yearlyData[year].revenue += parseFloat(amount);
        }
      }
    });

    // Convert to array and sort by year
    const yearlyArray = Object.values(yearlyData).sort((a, b) => b.year - a.year);

    res.json({
      success: true,
      yearlyData: yearlyArray
    });

  } catch (error) {
    console.error('Yearly report error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/**
 * GET /api/admin/members/payment-status
 * Get members filtered by payment status for specific year
 */


/**
 * GET /api/admin/members/payment-status
 * Get members filtered by payment status for specific year WITH SEARCH
 */
router.get('/members/payment-status', async (req, res) => {
  try {
    const { year, status, page = 1, limit = 20, search = '' } = req.query;
    
    console.log('Fetching payment status:', { year, status, page, limit, search });

    const offset = (page - 1) * limit;
    
    // Map year to period column
    const yearToPeriod = {
      '2021-2022': 21, '2022-2023': 22, '2023-2024': 23, '2024-2025': 24,
      '2025-2026': 25, '2026-2027': 26, '2027-2028': 27, '2028-2029': 28
    };

    const periodNum = yearToPeriod[year];
    
    if (!periodNum) {
      return res.status(400).json({
        success: false,
        error: 'Invalid year format. Use format: 2021-2022'
      });
    }

    const amountCol = `amount_${periodNum}`;
    const paymentIdCol = `payment_id_${periodNum}`;
    const paymentDateCol = `payment_date_${periodNum}`;

    let query = 'SELECT * FROM members_with_payments WHERE 1=1';
    const params = [];

    // Filter by payment status for specific year
    if (status === 'paid') {
      query += ` AND ${amountCol} IS NOT NULL AND ${paymentIdCol} IS NOT NULL AND ${paymentDateCol} IS NOT NULL`;
    } else if (status === 'unpaid') {
      query += ` AND (${amountCol} IS NULL OR ${paymentIdCol} IS NULL OR ${paymentDateCol} IS NULL)`;
    }

    // Add search filter (works with payment filter)
    if (search) {
      query += ` AND (
        name LIKE ? OR 
        folio_number LIKE ? OR 
        email LIKE ? OR 
        phone LIKE ? OR 
        address LIKE ? OR 
        state LIKE ? OR 
        chapter LIKE ?
      )`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
    }

    // Add pagination
    query += ` ORDER BY folio_number ASC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const [members] = await db.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM members_with_payments WHERE 1=1';
    const countParams = [];

    if (status === 'paid') {
      countQuery += ` AND ${amountCol} IS NOT NULL AND ${paymentIdCol} IS NOT NULL AND ${paymentDateCol} IS NOT NULL`;
    } else if (status === 'unpaid') {
      countQuery += ` AND (${amountCol} IS NULL OR ${paymentIdCol} IS NULL OR ${paymentDateCol} IS NULL)`;
    }

    // Add search to count query
    if (search) {
      countQuery += ` AND (
        name LIKE ? OR 
        folio_number LIKE ? OR 
        email LIKE ? OR 
        phone LIKE ? OR 
        address LIKE ? OR 
        state LIKE ? OR 
        chapter LIKE ?
      )`;
      const searchParam = `%${search}%`;
      countParams.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
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
      filters: {
        year,
        status,
        search
      }
    });

  } catch (error) {
    console.error('Payment status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/admin/members/update-status-by-payment
 * Auto-update member status based on payment for current period
 */
router.put('/members/update-status-by-payment', async (req, res) => {
  try {
    const { year } = req.body;
    
    const yearToPeriod = {
      '2021-2022': 21, '2022-2023': 22, '2023-2024': 23, '2024-2025': 24,
      '2025-2026': 25, '2026-2027': 26, '2027-2028': 27, '2028-2029': 28
    };

    const periodNum = yearToPeriod[year];
    
    if (!periodNum) {
      return res.status(400).json({
        success: false,
        error: 'Invalid year format'
      });
    }

    const amountCol = `amount_${periodNum}`;
    const paymentIdCol = `payment_id_${periodNum}`;

    // Mark as INACTIVE if haven't paid for this period
    const [inactiveResult] = await db.query(`
      UPDATE members_with_payments 
      SET status = 'inactive'
      WHERE (${amountCol} IS NULL OR ${paymentIdCol} IS NULL)
      AND status != 'removed'
    `);

    // Mark as ACTIVE if paid for this period
    const [activeResult] = await db.query(`
      UPDATE members_with_payments 
      SET status = 'active'
      WHERE ${amountCol} IS NOT NULL AND ${paymentIdCol} IS NOT NULL
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
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});



export default router;
