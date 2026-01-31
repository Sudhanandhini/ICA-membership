import XLSX from 'xlsx';
import db from '../config/database.js';

export const parseExcelFile = (filePath) => {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      raw: false,
      defval: null
    });

    // 🔍 DEBUG: Print ALL column names found
    if (jsonData.length > 0) {
      console.log('\n🔍 EXCEL COLUMNS FOUND:');
      console.log(Object.keys(jsonData[0]));
      console.log('\n🔍 FIRST ROW DATA:');
      console.log(JSON.stringify(jsonData[0], null, 2));
    }

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

const parseAmount = (value) => {
  console.log('🔍 parseAmount input:', value, 'type:', typeof value);
  
  if (value === null || value === undefined || value === '') {
    console.log('   → NULL (empty)');
    return null;
  }

  // Handle "New Member" or other text
  if (typeof value === 'string' && isNaN(value.replace(/[,₹$]/g, ''))) {
    console.log('   → NULL (not a number)');
    return null;
  }

  let str = String(value).trim().replace(/[,₹$]/g, '');
  const num = parseFloat(str);
  
  if (isNaN(num) || num < 0) {
    console.log('   → NULL (invalid number)');
    return null;
  }
  
  console.log('   → ', num);
  return num;
};

const parseExcelDate = (value) => {
  if (!value) return null;

  try {
    if (typeof value === "string") {
      // Handle "New Member" text
      if (value.toLowerCase().includes('new member')) {
        return null;
      }

      const cleaned = value
        .replace(/(\d+)(st|nd|rd|th)/g, "$1")
        .replace(",", "")
        .trim();

      const d = new Date(cleaned);
      if (isNaN(d.getTime())) return null;

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    }

    if (typeof value === "number") {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const date = new Date(excelEpoch.getTime() + value * 86400000);

      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');

      return `${year}-${month}-${day}`;
    }

    return null;
  } catch {
    return null;
  }
};

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

export const parsePaymentData = (row) => {
  const payments = {};

  console.log('\n🔍 PARSING PAYMENT ROW:', row['Folio No.'] || row['Folio No']);

  const getColumn = (patterns, year) => {
    console.log(`  🔍 Looking for year ${year} in patterns:`, patterns);
    for (const key of patterns) {
      if (row.hasOwnProperty(key) && row[key] !== null && row[key] !== undefined && row[key] !== '') {
        console.log(`    ✅ FOUND "${key}" = ${row[key]}`);
        return row[key];
      }
    }
    console.log(`    ❌ NOT FOUND`);
    return null;
  };

  // Try EVERY possible column name variation
  const amountKeys = year => [
    `Amount${year}`,           // Amount21
    `Amount ${year}`,          // Amount 21
    `amount${year}`,           // amount21
    `amount_${year}`,          // amount_21
    `AMOUNT${year}`,           // AMOUNT21
    `Amount${year-2000}`,      // Amount1 (if year is 2021)
    `Fee Amount${year}`,       // Fee Amount21
    `Amount_${year}`,          // Amount_21
  ];

  const idKeys = year => [
    `Payment ID${year}`,       // Payment ID21
    `Payment ID ${year}`,      // Payment ID 21
    `PaymentID${year}`,        // PaymentID21
    `payment_id_${year}`,      // payment_id_21
    `payment_id${year}`,       // payment_id21
    `Payment_ID${year}`,       // Payment_ID21
  ];

  const dateKeys = year => [
    `Date${year}`,             // Date21
    `Date ${year}`,            // Date 21
    `Date of Payment${year}`,  // Date of Payment21
    `Payment Date${year}`,     // Payment Date21
    `payment_date_${year}`,    // payment_date_21
    `payment_date${year}`,     // payment_date21
    `Date_${year}`,            // Date_21
  ];

  for (let yr = 21; yr <= 28; yr++) {
    const fullYear = 2000 + yr;
    payments[`period_${yr}`] = `20${yr}-20${yr + 1}`;
    
    const amountValue = getColumn(amountKeys(yr), yr);
    const paymentIdValue = getColumn(idKeys(yr), yr);
    const dateValue = getColumn(dateKeys(yr), yr);
    
    payments[`amount_${yr}`] = parseAmount(amountValue);
    payments[`payment_id_${yr}`] = paymentIdValue;
    payments[`payment_date_${yr}`] = parseExcelDate(dateValue);
    
    console.log(`  Period ${yr} RESULT:`, {
      amount: payments[`amount_${yr}`],
      payment_id: payments[`payment_id_${yr}`],
      date: payments[`payment_date_${yr}`]
    });
  }

  return payments;
};

export const importMembers = async (excelData) => {
  const results = {
    totalRows: 0,
    membersAdded: 0,
    membersUpdated: 0,
    paymentsAdded: 0,
    errors: 0,
    errorDetails: []
  };

  for (const row of excelData) {
    try {
      results.totalRows++;
      
      const memberData = parseMemberData(row);
      
      if (!memberData.folioNumber || !memberData.name || !memberData.email) {
        results.errors++;
        results.errorDetails.push(`Row ${results.totalRows}: Missing folio/name/email`);
        continue;
      }

      const payments = parsePaymentData(row);

      const [existing] = await db.query(
        'SELECT id FROM members_with_payments WHERE folio_number = ?',
        [memberData.folioNumber]
      );

      if (existing.length > 0) {
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
        
        results.membersUpdated++;
      } else {
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
        
        results.membersAdded++;
      }

      // Count payments
      for (let yr = 21; yr <= 28; yr++) {
        if (payments[`payment_id_${yr}`] && payments[`amount_${yr}`]) {
          results.paymentsAdded++;
        }
      }

    } catch (error) {
      results.errors++;
      results.errorDetails.push(`Row ${results.totalRows}: ${error.message}`);
      console.error(`❌ Error importing row ${results.totalRows}:`, error);
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