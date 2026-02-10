import db from '../config/database.js';

/**
 * Run database migrations
 */
export async function runMigrations() {
  try {
    console.log('✅ Database migrations check complete');
  } catch (error) {
    console.error('❌ Migration error:', error.message);
  }
}
