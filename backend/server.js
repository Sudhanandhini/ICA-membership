import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import db from './config/database.js';
import memberRoutes from './routes/members.js';
import paymentRoutes from './routes/payments.js';
import adminRoutes from './routes/admin.js';
import { runMigrations } from './database/migrations.js';
import { checkAndSendBirthdayEmails } from './utils/birthdayService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Test database connection
const testDatabaseConnection = async () => {
  try {
    await db.query('SELECT 1');
    console.log('✅ Database connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

// Health check endpoint
app.get('/health', async (req, res) => {
  const dbConnected = await testDatabaseConnection();
  res.json({
    success: true,
    message: 'Server is running',
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Membership Payment System API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      members: '/api/members',
      payments: '/api/payments',
      admin: '/api/admin'
    }
  });
});

// ✅ API Routes - MUST BE BEFORE 404 HANDLER
app.use('/api/members', memberRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler - MUST BE AFTER ALL ROUTES
app.use((req, res) => {
  console.log(`⚠️  404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Global error handler:', err);
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File size too large. Maximum 10MB allowed.'
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start server
const startServer = async () => {
  try {
    const dbConnected = await testDatabaseConnection();
    
    if (!dbConnected) {
      console.error('❌ Failed to connect to database');
      process.exit(1);
    }

    // Run database migrations
    await runMigrations();

    // Schedule birthday emails - runs daily at 8:00 AM
    cron.schedule('0 8 * * *', () => {
      console.log('[Cron] Checking for birthdays...');
      checkAndSendBirthdayEmails();
    });
    console.log('🎂 Birthday email cron scheduled (daily at 8:00 AM)');

    // Also check birthdays on server startup
    checkAndSendBirthdayEmails();

    app.listen(PORT, () => {
      console.log('\n' + '='.repeat(60));
      console.log('🚀 MEMBERSHIP PAYMENT SYSTEM - SERVER STARTED');
      console.log('='.repeat(60));
      console.log(`📍 Server URL:        http://localhost:${PORT}`);
      console.log(`🌐 Frontend URL:      ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
      console.log(`🗄️  Database:          ${process.env.DB_NAME || 'membership_payment_db'}`);
      console.log('='.repeat(60));
      console.log('\n📚 MEMBER PORTAL ENDPOINTS:');
      console.log('   POST   /api/members/search');
      console.log('   GET    /api/members/:id');
      console.log('\n💳 PAYMENT ENDPOINTS:');
      console.log('   GET    /api/payments/history/:memberId');
      console.log('   POST   /api/payments/calculate');
      console.log('\n👨‍💼 ADMIN PANEL ENDPOINTS:');
      console.log('   POST   /api/admin/import-excel');
      console.log('   GET    /api/admin/members');
      console.log('   GET    /api/admin/members/:id/payments');
      console.log('   POST   /api/admin/members');
      console.log('   PUT    /api/admin/members/:id');
      console.log('   GET    /api/admin/stats');
      console.log('='.repeat(60) + '\n');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;