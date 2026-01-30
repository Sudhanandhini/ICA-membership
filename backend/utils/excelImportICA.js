import XLSX from 'xlsx';
import db from '../config/database.js';

/* ---------------------------------------------------
   1) READ EXCEL FILE
--------------------------------------------------- */
export const parseExcelFile = (filePath) => {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      raw: false,
      defval: null
    });

    return {
      success: true,
      data: jsonData,
      sheetName
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/* ---------------------------------------------------
   2) FIXED AMOUNT PARSER — NO NaN, NO ERRORS
--------------------------------------------------- */
const parseAmount = (value) => {
  if (value === null || value === undefined) return null;

  let val = String(value).trim();

  val = val.replace(/,/g, ""); // remove commas

  if (isNaN(val)) return null; // "New Member" → null

  const num = Number(val);
  return isNaN(num) ? null : num;
};

/* ---------------------------------------------------
   3) FIXED DATE PARSER — NO TIMEZONE SHIFT
--------------------------------------------------- */
const parseExcelDate = (value) => {
  if (!value) return null;

  try {
    // TEXT DATE (Ex: "24th Mar, 2022")
    if (typeof value === "string") {
      const cleaned = value
        .replace(/(\d+)(st|nd|rd|th)/g, "$1")
        .replace(",", "")
        .trim();

      const d = new Date(cleaned);
      if (isNaN(d.getTime())) return null;

      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    // NUMERIC DATE (Excel format)
    if (typeof value === "number") {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // 1899-12-30
      const date = new Date(excelEpoch.getTime() + value * 86400000);

      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    }

    return null;
  } catch {
    return null;
  }
};

/* ---------------------------------------------------
   4) MEMBER PARSER
--------------------------------------------------- */
export const parseMemberData = (row) => ({
  folioNumber: row['Folio No.'] || row['Folio No'] || null,
  gender: row['gender'] || row['Gender'] || 'Male',
  name: row['Name'] || null,
  email: row['Email ID'] || row['Email'] || null,
  phone: row['PHONE NUMBER'] || row['Phone'] || '0000000000',
  address: row['ADDRESS WITH PIN CODE'] || row['Address'] || null,
  pinCode: row['PIN CODE'] || row['Pin Code'] || null,
  state: row['STATE'] || row['State'] || null,
  chapter: row['SELECT CHAPTER'] || row['Chapter'] || null
});

/* ---------------------------------------------------
   5) PAYMENT PARSER — FIXED AMOUNTS & DATES
--------------------------------------------------- */
export const parsePaymentData = (row) => {
  const payments = {};

  const getColumn = (patterns) => {
    for (const key of patterns) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
        return row[key];
      }
    }
    return null;
  };

  const amountKeys = year => [`Amount${year}`, `Amount ${year}`, `amount${year}`];
  const idKeys = year => [
    `Payment ID${year}`, `Payment ID ${year}`, `PaymentID${year}`, `payment_id_${year}`
  ];
  const dateKeys = year => [
    `Date of Payment${year}`, `Date${year}`, `Payment Date${year}`, `payment_date_${year}`
  ];

  for (let yr = 21; yr <= 28; yr++) {
    payments[`period_${yr}`] = `20${yr}-20${yr + 1}`;
    payments[`amount_${yr}`] = parseAmount(getColumn(amountKeys(yr)));
    payments[`payment_id_${yr}`] = getColumn(idKeys(yr));
    payments[`payment_date_${yr}`] = parseExcelDate(getColumn(dateKeys(yr)));
  }

  return payments;
};

/* ---------------------------------------------------
   6) IMPORT MEMBERS + PAYMENTS
--------------------------------------------------- */
export const importMembers = async (excelData) => {
  const results = {
    total: 0,
    added: 0,
    updated: 0,
    paymentsAdded: 0,
    errors: 0,
    errorDetails: []
  };

  for (const row of excelData) {
    try {
      results.total++;

      const memberData = parseMemberData(row);

      if (!memberData.folioNumber || !memberData.name || !memberData.email) {
        results.errors++;
        results.errorDetails.push(`Row ${results.total}: Missing required fields`);
        continue;
      }

      let memberId;

      // Check if member exists
      const [existing] = await db.query(
        'SELECT id FROM members WHERE folio_number = ?',
        [memberData.folioNumber]
      );

      if (existing.length > 0) {
        // Update Member
        memberId = existing[0].id;

        await db.query(`
          UPDATE members 
          SET gender=?, name=?, email=?, phone=?, address=?, 
              pin_code=?, state=?, chapter=?, status='active', updated_at=NOW()
          WHERE id=?
        `, [
          memberData.gender, memberData.name, memberData.email, memberData.phone,
          memberData.address, memberData.pinCode, memberData.state, memberData.chapter, memberId
        ]);

        results.updated++;
      } else {
        // Insert New Member
        const [insertResult] = await db.query(`
          INSERT INTO members (folio_number, gender, name, email, phone, address, pin_code, state, chapter, member_class, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', 'active')
        `, [
          memberData.folioNumber, memberData.gender, memberData.name, memberData.email,
          memberData.phone, memberData.address, memberData.pinCode, memberData.state, memberData.chapter
        ]);

        memberId = insertResult.insertId;
        results.added++;
      }

      // PAYMENT DATA
      const payments = parsePaymentData(row);

      // Check if payment record exists
      const [existingPayment] = await db.query(
        'SELECT id FROM payments WHERE member_id=?',
        [memberId]
      );

      const paymentFields = [];
      const paymentValues = [];

      for (let yr = 21; yr <= 28; yr++) {
        paymentFields.push(
          `period_${yr}`, `amount_${yr}`, `payment_id_${yr}`, `payment_date_${yr}`
        );
        paymentValues.push(
          payments[`period_${yr}`],
          payments[`amount_${yr}`],
          payments[`payment_id_${yr}`],
          payments[`payment_date_${yr}`]
        );
      }

      if (existingPayment.length > 0) {
        // UPDATE PAYMENTS
        const updateFields = paymentFields.map(f => `${f}=?`).join(", ");

        await db.query(`
          UPDATE payments SET 
          folio_number=?, ${updateFields}, updated_at=NOW()
          WHERE member_id=?
        `, [memberData.folioNumber, ...paymentValues, memberId]);

      } else {
        // INSERT PAYMENTS
        await db.query(`
          INSERT INTO payments (
            member_id, folio_number,
            ${paymentFields.join(", ")}
          ) VALUES (
            ?, ?, ${paymentFields.map(() => "?").join(", ")}
          )
        `, [memberId, memberData.folioNumber, ...paymentValues]);

        results.paymentsAdded++;
      }

    } catch (error) {
      results.errors++;
      results.errorDetails.push(`Row ${results.total}: ${error.message}`);
      console.error(`Error importing row ${results.total}:`, error);
    }
  }

  return results;
};

export default {
  parseExcelFile,
  parseMemberData,
  parsePaymentData,
  importMembers
};
