import express from 'express';
import db from '../config/database.js';

const router = express.Router();

/**
 * POST /api/members/search
 * Search for members by name
 */
router.post('/search', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.json({ success: true, members: [] });
    }

    const [members] = await db.query(`
      SELECT * 
      FROM members_with_payments
      WHERE name LIKE ? 
      AND status = 'active'
      ORDER BY name
      LIMIT 10
    `, [`%${name}%`]);
    
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
    
    // Check if folio number exists
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
    
    const [result] = await db.query(`
      INSERT INTO members_with_payments (
        folio_number, gender, name, email, phone, address, 
        pin_code, state, chapter, member_class, status,
        period_21, period_22, period_23, period_24,
        period_25, period_26, period_27, period_28
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', 'active',
        '2021-2022', '2022-2023', '2023-2024', '2024-2025',
        '2025-2026', '2026-2027', '2027-2028', '2028-2029')
    `, [
      folio_number, gender || 'Male', name, email, phone || '0000000000',
      address, pin_code, state, chapter
    ]);
    
    res.status(201).json({
      success: true,
      message: 'Member created successfully',
      memberId: result.insertId
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

export default router;