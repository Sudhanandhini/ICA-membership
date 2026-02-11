import db from '../config/database.js';

/**
 * Run database migrations
 */
export async function runMigrations() {
  try {
    // Create birthday_emails_log table to track sent birthday emails
    await db.query(`
      CREATE TABLE IF NOT EXISTS birthday_emails_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        member_id INT NOT NULL,
        sent_date DATE NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_member_date (member_id, sent_date)
      )
    `);

    console.log('✅ Database migrations check complete');
  } catch (error) {
    console.error('❌ Migration error:', error.message);
  }
}
