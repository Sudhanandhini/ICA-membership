import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './config/database.js';
import memberRoutes from './routes/members.js';
import paymentRoutes from './routes/payments.js';
import adminRoutes from './routes/admin.js';

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
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/members', memberRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('❌ Failed to connect to database. Please check your configuration.');
      process.exit(1);
    }
    
    app.listen(PORT, () => {
      console.log('='.repeat(50));
      console.log('🚀 Membership Payment System Server');
      console.log('='.repeat(50));
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`✅ Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
      console.log(`✅ Database: ${process.env.DB_NAME || 'membership_payment_db'}`);
      console.log('='.repeat(50));
      console.log('📚 API Endpoints:');
      console.log(`   POST   /api/members/search`);
      console.log(`   GET    /api/members/:id`);
      console.log(`   GET    /api/payments/history/:memberId`);
      console.log(`   POST   /api/payments/calculate`);
      console.log(`   POST   /api/payments/initiate`);
      console.log(`   POST   /api/payments/verify`);
      console.log(`   GET    /api/payments/status/:memberId`);
      console.log('📊 Admin Endpoints:');
      console.log(`   POST   /api/admin/import-excel`);
      console.log(`   GET    /api/admin/import-history`);
      console.log(`   GET    /api/admin/members`);
      console.log(`   PUT    /api/admin/members/:id/soft-delete`);
      console.log(`   PUT    /api/admin/members/:id/restore`);
      console.log(`   GET    /api/admin/stats`);
      console.log('='.repeat(50));
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
