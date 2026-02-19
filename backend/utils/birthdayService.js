import db from '../config/database.js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const EMAIL_PORT = parseInt(process.env.EMAIL_PORT) || 587;
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: EMAIL_PORT,
  secure: EMAIL_PORT === 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
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

/**
 * Check for today's birthdays and send emails (only once per member per year)
 */
export async function checkAndSendBirthdayEmails() {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const month = today.getMonth() + 1;
    const day = today.getDate();

    // Find active members whose birthday is today AND haven't been emailed today
    const [members] = await db.query(
      `SELECT m.id, m.name, m.email, m.dob
       FROM members_with_payments m
       LEFT JOIN birthday_emails_log b
         ON m.id = b.member_id AND b.sent_date = ?
       WHERE m.status = 'active'
         AND m.dob IS NOT NULL
         AND m.email IS NOT NULL
         AND MONTH(m.dob) = ?
         AND DAY(m.dob) = ?
         AND b.id IS NULL`,
      [todayStr, month, day]
    );

    if (members.length === 0) {
      console.log(`[Birthday] No pending birthday emails for today (${month}/${day})`);
      return;
    }

    console.log(`[Birthday] Found ${members.length} birthday(s) to email today!`);

    let sent = 0;
    let failed = 0;

    for (const member of members) {
      try {
        await sendBirthdayEmail(member);
        // Log to database so this member won't get emailed again today
        await db.query(
          'INSERT INTO birthday_emails_log (member_id, sent_date) VALUES (?, ?)',
          [member.id, todayStr]
        );
        sent++;
        console.log(`[Birthday] Sent to ${member.name} (${member.email})`);
      } catch (err) {
        failed++;
        console.error(`[Birthday] Failed for ${member.name}: ${err.message}`);
      }
    }

    console.log(`[Birthday] Done: ${sent} sent, ${failed} failed`);
  } catch (error) {
    console.error('[Birthday] Error checking birthdays:', error.message);
  }
}
