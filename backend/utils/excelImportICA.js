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

      // Parse payment data
      const payments = parsePaymentData(row);

      // Check if member exists
      const [existing] = await db.query(
        'SELECT id FROM members_with_payments WHERE folio_number = ?',
        [memberData.folioNumber]
      );

      if (existing.length > 0) {
        // UPDATE existing member with all data
        await db.query(`
          UPDATE members_with_payments SET
            gender=?, name=?, email=?, phone=?, address=?, pin_code=?, state=?, chapter=?,
            period_21=?, amount_21=?, payment_id_21=?, payment_date_21=?,
            period_22=?, amount_22=?, payment_id_22=?, payment_date_22=?,
            period_23=?, amount_23=?, payment_id_23=?, payment_date_23=?,
            period_24=?, amount_24=?, payment_id_24=?, payment_date_24=?,
            period_25=?, amount_25=?, payment_id_25=?, payment_date_25=?,
            period_26=?, amount_26=?, payment_id_26=?, payment_date_26=?,
            period_27=?, amount_27=?, payment_id_27=?, payment_date_27=?,
            period_28=?, amount_28=?, payment_id_28=?, payment_date_28=?,
            status='active', updated_at=NOW()
          WHERE folio_number=?
        `, [
          memberData.gender, memberData.name, memberData.email, memberData.phone,
          memberData.address, memberData.pinCode, memberData.state, memberData.chapter,
          payments.period_21, payments.amount_21, payments.payment_id_21, payments.payment_date_21,
          payments.period_22, payments.amount_22, payments.payment_id_22, payments.payment_date_22,
          payments.period_23, payments.amount_23, payments.payment_id_23, payments.payment_date_23,
          payments.period_24, payments.amount_24, payments.payment_id_24, payments.payment_date_24,
          payments.period_25, payments.amount_25, payments.payment_id_25, payments.payment_date_25,
          payments.period_26, payments.amount_26, payments.payment_id_26, payments.payment_date_26,
          payments.period_27, payments.amount_27, payments.payment_id_27, payments.payment_date_27,
          payments.period_28, payments.amount_28, payments.payment_id_28, payments.payment_date_28,
          memberData.folioNumber
        ]);
        
        results.updated++;
      } else {
        // INSERT new member with all data
        await db.query(`
          INSERT INTO members_with_payments (
            folio_number, gender, name, email, phone, address, pin_code, state, chapter, member_class, status,
            period_21, amount_21, payment_id_21, payment_date_21,
            period_22, amount_22, payment_id_22, payment_date_22,
            period_23, amount_23, payment_id_23, payment_date_23,
            period_24, amount_24, payment_id_24, payment_date_24,
            period_25, amount_25, payment_id_25, payment_date_25,
            period_26, amount_26, payment_id_26, payment_date_26,
            period_27, amount_27, payment_id_27, payment_date_27,
            period_28, amount_28, payment_id_28, payment_date_28
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          memberData.folioNumber, memberData.gender, memberData.name, memberData.email,
          memberData.phone, memberData.address, memberData.pinCode, memberData.state, memberData.chapter,
          payments.period_21, payments.amount_21, payments.payment_id_21, payments.payment_date_21,
          payments.period_22, payments.amount_22, payments.payment_id_22, payments.payment_date_22,
          payments.period_23, payments.amount_23, payments.payment_id_23, payments.payment_date_23,
          payments.period_24, payments.amount_24, payments.payment_id_24, payments.payment_date_24,
          payments.period_25, payments.amount_25, payments.payment_id_25, payments.payment_date_25,
          payments.period_26, payments.amount_26, payments.payment_id_26, payments.payment_date_26,
          payments.period_27, payments.amount_27, payments.payment_id_27, payments.payment_date_27,
          payments.period_28, payments.amount_28, payments.payment_id_28, payments.payment_date_28
        ]);
        
        results.added++;
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
