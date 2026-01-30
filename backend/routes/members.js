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
    
    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Please enter at least 2 characters to search'
      });
    }
    
    const searchTerm = `%${name.trim()}%`;
    const query = `
      SELECT id, name, phone, email, folio_number, created_at
      FROM members
      WHERE name LIKE ?
      ORDER BY name ASC
      LIMIT 20
    `;
    
    const [members] = await db.query(query, [searchTerm]);
    
    if (members.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No members found matching your search'
      });
    }
    
    res.json({
      success: true,
      count: members.length,
      members
    });
    
  } catch (error) {
    console.error('Member search error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search members',
      error: error.message
    });
  }
});

/**
 * GET /api/members/:id
 * Get member details by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT id, name, phone, email, folio_number, created_at
      FROM members
      WHERE id = ?
    `;
    
    const [members] = await db.query(query, [id]);
    
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
 * GET /api/members/folio/:folioNumber
 * Get member details by folio number
 */
router.get('/folio/:folioNumber', async (req, res) => {
  try {
    const { folioNumber } = req.params;
    
    const query = `
      SELECT id, name, phone, email, folio_number, created_at
      FROM members
      WHERE folio_number = ?
    `;
    
    const [members] = await db.query(query, [folioNumber]);
    
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
    const { name, phone, email, folio_number } = req.body;
    
    // Validation
    if (!name || !phone || !email || !folio_number) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
    
    // Check if folio number already exists
    const checkQuery = 'SELECT id FROM members WHERE folio_number = ?';
    const [existing] = await db.query(checkQuery, [folio_number]);
    
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Folio number already exists'
      });
    }
    
    const insertQuery = `
      INSERT INTO members (name, phone, email, folio_number)
      VALUES (?, ?, ?, ?)
    `;
    
    const [result] = await db.query(insertQuery, [name, phone, email, folio_number]);
    
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
