import XLSX from 'xlsx';
import db from '../config/database.js';

/**
 * Parse Excel file for latest member with payment format
 */
export function parseExcelFile(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (data.length === 0) {
      return { success: false, error: 'Excel file is empty' };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: `Failed to parse Excel file: ${error.message}` };
  }
}

/**
 * Import members and payments from parsed Excel data
 */
export async function importMembersAndPayments(data) {
  const result = {
    success: true,
    totalRows: data.length,
    membersAdded: 0,
    membersUpdated: 0,
    paymentsAdded: 0,
    paymentsSkipped: 0,
    errors: []
  };

  for (let i = 0; i < data.length; i++) {
    try {
      const row = data[i];
      const folioNumber = row['Folio Number'] || row['folio_number'] || row['FOLIO'] || '';

      if (!folioNumber) {
        result.errors.push({ row: i + 1, error: 'Missing folio number' });
        continue;
      }

      const name = row['Name'] || row['name'] || row['NAME'] || '';
      const email = row['Email'] || row['email'] || row['EMAIL'] || '';
      const phone = row['Phone'] || row['phone'] || row['PHONE'] || '';
      const gender = row['Gender'] || row['gender'] || row['GENDER'] || 'Male';

      const [existing] = await db.query(
        'SELECT id FROM members_with_payments WHERE folio_number = ?',
        [folioNumber]
      );

      if (existing.length > 0) {
        await db.query(
          'UPDATE members_with_payments SET name = ?, email = ?, phone = ?, gender = ?, updated_at = NOW() WHERE folio_number = ?',
          [name, email, phone, gender, folioNumber]
        );
        result.membersUpdated++;
      } else {
        await db.query(
          'INSERT INTO members_with_payments (folio_number, name, email, phone, gender, status) VALUES (?, ?, ?, ?, ?, ?)',
          [folioNumber, name, email, phone, gender, 'active']
        );
        result.membersAdded++;
      }
    } catch (error) {
      result.errors.push({ row: i + 1, error: error.message });
    }
  }

  return result;
}
