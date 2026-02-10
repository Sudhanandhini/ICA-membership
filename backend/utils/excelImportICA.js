import XLSX from 'xlsx';
import db from '../config/database.js';

/* ---------------------------------------------------------
   NORMALIZE EXCEL COLUMN KEYS
--------------------------------------------------------- */
const normalizeKeys = (row) => {
  const out = {};
  for (const key in row) {
    if (!key) continue;

    const cleanKey = key
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");

    // TRIM all string values to remove tabs, spaces, etc.
    out[cleanKey] = typeof row[key] === 'string' ? row[key].trim() : row[key];
  }
  return out;
};

/* ---------------------------------------------------------
   READ AND PARSE EXCEL FILE
--------------------------------------------------------- */
export const parseExcelFile = (filePath) => {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      raw: false,
      defval: null
    });

    if (jsonData.length > 0) {
      console.log(`\n🔍 EXCEL COLUMNS FOUND:`);
      console.log(Object.keys(jsonData[0]));
    }

    // NORMALIZE EVERY ROW BEFORE RETURNING
    const normalized = jsonData.map((row) => normalizeKeys(row));

    return { success: true, data: normalized, sheetName };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/* ---------------------------------------------------------
   PARSE AMOUNT
--------------------------------------------------------- */
const parseAmount = (value) => {
  if (!value) return null;
  const num = parseFloat(String(value).replace(/[^0-9.]/g, ''));
  return isNaN(num) ? null : num;
};

/* ---------------------------------------------------------
   PARSE DATE FROM EXCEL OR STRING
--------------------------------------------------------- */
const parseExcelDate = (value) => {
  if (!value) return null;

  // Skip non-date strings like "New Member"
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    if (lower === 'new member' || lower === 'na' || lower === 'n/a' || lower === '-') {
      return null;
    }

    const cleaned = value
      .replace(/(\d+)(st|nd|rd|th)/g, "$1")
      .replace(/,/g, "")
      .trim();

    // DD-MM-YYYY format
    const dmy = cleaned.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

    // DD-MM-YY format
    const dmy2 = cleaned.match(/^(\d{2})-(\d{2})-(\d{2})$/);
    if (dmy2) {
      const yr = parseInt(dmy2[3]);
      const fullYear = yr > 50 ? `19${dmy2[3]}` : `20${dmy2[3]}`;
      return `${fullYear}-${dmy2[2]}-${dmy2[1]}`;
    }

    const d = new Date(cleaned);
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return date.toISOString().slice(0, 10);
  }

  return null;
};

/* ---------------------------------------------------------
   PARSE MEMBER DATA
--------------------------------------------------------- */
const parseMemberData = (row) => ({
  folioNumber: (row.folio_number || row.folio_no || "").toString().trim() || null,
  gender: row.gender || null,
  name: row.name || null,
  email: row.email || null,
  phone: (row.phone_number || row.phone || "").toString().trim() || "0000000000",
  address: row.address || null,
  pinCode: row.pin_code || null,
  state: row.state || null,
  chapter: row.chapter || null,
  dob: parseExcelDate(row.dob),
  age: row.age ? parseInt(row.age) : null
});

/* ---------------------------------------------------------
   PARSE PAYMENT DATA (YEARS 21–28)
--------------------------------------------------------- */
const parsePaymentData = (row) => {
  const payments = {};

  const find = (prefix, yr) => {
    const keys = Object.keys(row);

    // handle both fee_period21 and fee_period_21
    const variants = [
      `${prefix}${yr}`,
      `${prefix}_${yr}`
    ];

    for (const key of keys) {
      for (const v of variants) {
        if (key === v || key.includes(v)) return row[key];
      }
    }
    return null;
  };

  for (let yr = 21; yr <= 28; yr++) {
    const rawPeriod = find("fee_period", yr) || find("period", yr);
    const isValidPeriod = rawPeriod && rawPeriod.toLowerCase() !== 'new member';
    payments[`period_${yr}`] = isValidPeriod ? rawPeriod : `20${yr}-20${yr + 1}`;

    payments[`amount_${yr}`] = parseAmount(find("amount", yr));

    const rawPaymentId = find("payment_id", yr);
    payments[`payment_id_${yr}`] =
      rawPaymentId && rawPaymentId.toLowerCase() !== 'new member'
        ? rawPaymentId
        : null;

    const rawDate = find("payment_date", yr) || find("date", yr);
    payments[`payment_date_${yr}`] = parseExcelDate(rawDate);
  }

  return payments;
};


/* ---------------------------------------------------------
   ENSURE dob AND age COLUMNS EXIST
--------------------------------------------------------- */
const ensureColumns = async () => {
  try {
    const [columns] = await db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'members_with_payments'`
    );

    const existingCols = columns.map(c => c.COLUMN_NAME || c.column_name);

    if (!existingCols.includes('dob')) {
      await db.query(
        `ALTER TABLE members_with_payments ADD COLUMN dob DATE NULL AFTER chapter`
      );
      console.log('✅ Added missing column: dob');
    }

    if (!existingCols.includes('age')) {
      await db.query(
        `ALTER TABLE members_with_payments ADD COLUMN age INT NULL AFTER dob`
      );
      console.log('✅ Added missing column: age');
    }
  } catch (err) {
    console.error('⚠️ ensureColumns error:', err.message);
  }
};


/* ---------------------------------------------------------
   REMOVE OLD MEMBERS NOT IN EXCEL
--------------------------------------------------------- */
const removeOldMembers = async (excelFolios) => {
  try {
    if (excelFolios.length === 0) return 0;

    const [dbMembers] = await db.query(
      "SELECT id, folio_number FROM members_with_payments"
    );

    const excelFolioSet = new Set(excelFolios);
    const toDelete = dbMembers.filter(m => !excelFolioSet.has(m.folio_number));

    if (toDelete.length > 0) {
      const idsToDelete = toDelete.map(m => m.id);
      await db.query(
        `DELETE FROM members_with_payments WHERE id IN (?)`,
        [idsToDelete]
      );
      console.log(`🗑️ Removed ${toDelete.length} old members not in Excel:`);
      toDelete.forEach(m => console.log(`   - ${m.folio_number}`));
    }

    return toDelete.length;
  } catch (err) {
    console.error('⚠️ removeOldMembers error:', err.message);
    return 0;
  }
};


/* ---------------------------------------------------------
   IMPORT MEMBERS (INSERT OR UPDATE + CLEANUP)
--------------------------------------------------------- */
export const importMembers = async (excelData) => {
  // Auto-add dob & age columns if they don't exist
  await ensureColumns();

  const results = {
    totalRows: 0,
    membersAdded: 0,
    membersUpdated: 0,
    membersRemoved: 0,
    errors: 0,
    errorDetails: []
  };

  // Collect all valid folio numbers from Excel for cleanup
  const excelFolios = [];

  for (const row of excelData) {
    results.totalRows++;

    const memberData = parseMemberData(row);
    const payments = parsePaymentData(row);

    if (!memberData.folioNumber || !memberData.name) {
      results.errors++;
      results.errorDetails.push(
        `Row ${results.totalRows}: Missing folio or name`
      );
      continue;
    }

    excelFolios.push(memberData.folioNumber);

    const [existing] = await db.query(
      "SELECT id FROM members_with_payments WHERE folio_number = ?",
      [memberData.folioNumber]
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

    try {
      if (existing.length > 0) {
        await db.query(
          `UPDATE members_with_payments SET
            gender=?, name=?, email=?, phone=?, address=?, pin_code=?, state=?, chapter=?,
            dob=?, age=?,
            ${paymentFields.map(f => `${f}=?`).join(", ")},
            status='active',
            updated_at=NOW()
          WHERE folio_number=?`,
          [
            memberData.gender, memberData.name, memberData.email, memberData.phone,
            memberData.address, memberData.pinCode, memberData.state, memberData.chapter,
            memberData.dob, memberData.age,
            ...paymentValues,
            memberData.folioNumber
          ]
        );
        results.membersUpdated++;
      } else {
        await db.query(
          `INSERT INTO members_with_payments (
            folio_number, gender, name, email, phone, address, pin_code, state, chapter,
            dob, age, member_class, status,
            ${paymentFields.join(", ")}
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', 'active',
            ${paymentFields.map(() => "?").join(", ")}
          )`,
          [
            memberData.folioNumber, memberData.gender, memberData.name, memberData.email,
            memberData.phone, memberData.address, memberData.pinCode, memberData.state,
            memberData.chapter, memberData.dob, memberData.age,
            ...paymentValues
          ]
        );
        results.membersAdded++;
      }

    } catch (err) {
      results.errors++;
      results.errorDetails.push(
        `Row ${results.totalRows} (${memberData.folioNumber}): ${err.message}`
      );
    }
  }

  /* -------------------
     CLEANUP: Remove members not in Excel
  ------------------- */
  results.membersRemoved = await removeOldMembers(excelFolios);

  return results;
};

export default {
  parseExcelFile,
  parseMemberData,
  parsePaymentData,
  importMembers
};