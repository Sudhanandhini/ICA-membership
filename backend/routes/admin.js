import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../config/database.js';
import { parseExcelFile, importMembers } from '../utils/excelImportICA.js';

const router = express.Router();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'import-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// const upload = multer({
//   storage: storage,
//   limits: { fileSize: 10 * 1024 * 1024 },
//   fileFilter: (req, file, cb) => {
//     const allowedTypes = /xlsx|xls|csv/;
//     const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
//     const mimetype = allowedTypes.test(file.mimetype);
    
//     if (extname && mimetype) {
//       cb(null, true);
//     } else {
//       cb(new Error('Only Excel files (.xlsx, .xls, .csv) are allowed'));
//     }
//   }
// });

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls, .csv) are allowed'));
    }
  }
});

router.post('/import-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const filePath = req.file.path;
    const parseResult = parseExcelFile(filePath);
    
    if (!parseResult.success) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message: 'Failed to parse Excel file',
        error: parseResult.error
      });
    }

    const importResults = await importMembers(parseResult.data);
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: 'Import completed successfully',
      results: importResults
    });

  } catch (error) {
    console.error('Import error:', error);
    
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      message: 'Import failed',
      error: error.message
    });
  }
});

router.get('/members', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const includeRemoved = req.query.includeDeleted === 'true';

    let query = 'SELECT * FROM members WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }

    if (!includeRemoved) {
      query += ' AND status != ?';
      params.push('removed');
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [members] = await db.query(query, params);

    let countQuery = 'SELECT COUNT(*) as total FROM members WHERE 1=1';
    const countParams = [];
    
    if (status && status !== 'all') {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    
    if (!includeRemoved) {
      countQuery += ' AND status != ?';
      countParams.push('removed');
    }

    const [[{ total }]] = await db.query(countQuery, countParams);

    res.json({
      success: true,
      members,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch members',
      error: error.message
    });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const [[activeMembers]] = await db.query(`
      SELECT COUNT(*) as count FROM members 
      WHERE status = 'active'
    `);

    const [[totalMembers]] = await db.query(`
      SELECT COUNT(*) as count FROM members WHERE status != 'removed'
    `);

    const [[removedMembers]] = await db.query(`
      SELECT COUNT(*) as count FROM members WHERE status = 'removed'
    `);

    const [[totalPayments]] = await db.query(`
      SELECT 
        (COUNT(CASE WHEN payment_id_21 IS NOT NULL THEN 1 END) +
         COUNT(CASE WHEN payment_id_22 IS NOT NULL THEN 1 END) +
         COUNT(CASE WHEN payment_id_23 IS NOT NULL THEN 1 END) +
         COUNT(CASE WHEN payment_id_24 IS NOT NULL THEN 1 END) +
         COUNT(CASE WHEN payment_id_25 IS NOT NULL THEN 1 END) +
         COUNT(CASE WHEN payment_id_26 IS NOT NULL THEN 1 END) +
         COUNT(CASE WHEN payment_id_27 IS NOT NULL THEN 1 END) +
         COUNT(CASE WHEN payment_id_28 IS NOT NULL THEN 1 END)) as count,
        (COALESCE(SUM(amount_21), 0) + COALESCE(SUM(amount_22), 0) +
         COALESCE(SUM(amount_23), 0) + COALESCE(SUM(amount_24), 0) +
         COALESCE(SUM(amount_25), 0) + COALESCE(SUM(amount_26), 0) +
         COALESCE(SUM(amount_27), 0) + COALESCE(SUM(amount_28), 0)) as total
      FROM payments
    `);

    res.json({
      success: true,
      stats: {
        activeMembers: activeMembers.count,
        totalMembers: totalMembers.count,
        removedMembers: removedMembers.count,
        successfulPayments: totalPayments.count || 0,
        totalRevenue: totalPayments.total || 0
      }
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
});

export default router;