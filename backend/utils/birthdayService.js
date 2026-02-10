import db from '../config/database.js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

/**
 * Send birthday email to a member
 */
async function sendBirthdayEmail(member) {
  const mailOptions = {
    from: `"Membership Portal" <${process.env.EMAIL_USER}>`,
    to: member.email,
    subject: 'Happy Birthday! - Membership Portal',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e46c9 0%, #2c48c5 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 10px;">&#127874;</div>
          <h1 style="color: white; margin: 0; font-size: 28px;">Happy Birthday!</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #374151; font-size: 18px; text-align: center;">
            Dear <strong>${member.name}</strong>,
          </p>
          <p style="color: #6b7280; font-size: 15px; text-align: center; line-height: 1.6;">
            Wishing you a very Happy Birthday! May this special day bring you happiness, good health, and wonderful memories.
          </p>
          <div style="text-align: center; margin: 25px 0;">
            <div style="font-size: 36px;">&#127881; &#127880; &#127874; &#127880; &#127881;</div>
          </div>
          <p style="color: #6b7280; font-size: 14px; text-align: center;">
            Thank you for being a valued member of our community.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            Warm regards,<br/>Membership Portal Team
          </p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
}

// Track last sent date to avoid duplicate sends on server restarts
let lastSentDate = null;

/**
 * Check for today's birthdays and send emails (once per day only)
 */
export async function checkAndSendBirthdayEmails() {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // "2026-02-10"

    if (lastSentDate === todayStr) {
      console.log('[Birthday] Already sent today, skipping');
      return;
    }

    const month = today.getMonth() + 1;
    const day = today.getDate();

    // Find active members whose birthday is today
    const [members] = await db.query(
      `SELECT id, name, email, dob
       FROM members_with_payments
       WHERE status = 'active'
         AND dob IS NOT NULL
         AND email IS NOT NULL
         AND MONTH(dob) = ?
         AND DAY(dob) = ?`,
      [month, day]
    );

    if (members.length === 0) {
      console.log(`[Birthday] No birthdays today (${month}/${day})`);
      lastSentDate = todayStr;
      return;
    }

    console.log(`[Birthday] Found ${members.length} birthday(s) today!`);

    let sent = 0;
    let failed = 0;

    for (const member of members) {
      try {
        await sendBirthdayEmail(member);
        sent++;
        console.log(`[Birthday] Sent to ${member.name} (${member.email})`);
      } catch (err) {
        failed++;
        console.error(`[Birthday] Failed for ${member.name}: ${err.message}`);
      }
    }

    console.log(`[Birthday] Done: ${sent} sent, ${failed} failed`);
    lastSentDate = todayStr;
  } catch (error) {
    console.error('[Birthday] Error checking birthdays:', error.message);
  }
}
