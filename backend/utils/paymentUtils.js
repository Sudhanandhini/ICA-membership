/**
 * Payment Utilities
 * Handles membership year calculations and sequential payment logic
 */

const MEMBERSHIP_FEE = 1200;

/**
 * Get current membership year based on current date
 * Membership year runs from April to March
 */
export const getCurrentMembershipYear = () => {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-11
  const currentYear = now.getFullYear();
  
  // If current month is Jan, Feb, or Mar (0, 1, 2), we're in the second half of membership year
  // If current month is Apr-Dec (3-11), we're in the first half of membership year
  
  let startYear, endYear;
  if (currentMonth >= 3) { // April (3) to December (11)
    startYear = currentYear;
    endYear = currentYear + 1;
  } else { // January (0) to March (2)
    startYear = currentYear - 1;
    endYear = currentYear;
  }
  
  return {
    start: `${startYear}-04-01`,
    end: `${endYear}-03-31`,
    label: `Apr ${startYear} - Mar ${endYear}`
  };
};

/**
 * Generate all membership years from start year to current year
 */
export const generateMembershipYears = (startYear, endYear) => {
  const years = [];
  for (let year = startYear; year <= endYear; year++) {
    years.push({
      start: `${year}-04-01`,
      end: `${year + 1}-03-31`,
      label: `Apr ${year} - Mar ${year + 1}`
    });
  }
  return years;
};

/**
 * Parse membership year from date string
 */
export const parseMembershipYear = (dateString) => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  return year;
};

/**
 * Calculate payable years based on payment history
 * Implements the sequential payment rule
 */
export const calculatePayableYears = (paymentHistory) => {
  const currentYear = getCurrentMembershipYear();
  const currentYearStart = parseMembershipYear(currentYear.start);
  
  // If no payment history, assign first year (current year)
  if (!paymentHistory || paymentHistory.length === 0) {
    return {
      payableYears: [currentYear],
      totalAmount: MEMBERSHIP_FEE,
      isFirstTime: true,
      message: 'First-time membership registration'
    };
  }
  
  // Get all paid years (sorted by year)
  const paidYears = paymentHistory
    .filter(payment => payment.payment_status === 'success')
    .map(payment => parseMembershipYear(payment.membership_year_start))
    .sort((a, b) => a - b);
  
  if (paidYears.length === 0) {
    // Has records but no successful payments
    return {
      payableYears: [currentYear],
      totalAmount: MEMBERSHIP_FEE,
      isFirstTime: true,
      message: 'Complete your first membership payment'
    };
  }
  
  // Find the latest paid year
  const latestPaidYear = paidYears[paidYears.length - 1];
  
  // Find the first unpaid year (gap detection)
  const firstPaidYear = paidYears[0];
  let firstUnpaidYear = null;
  
  // Check for gaps in payment history
  for (let year = firstPaidYear; year < currentYearStart; year++) {
    if (!paidYears.includes(year)) {
      firstUnpaidYear = year;
      break;
    }
  }
  
  // If there's a gap, start from the first unpaid year
  if (firstUnpaidYear) {
    const payableYears = generateMembershipYears(firstUnpaidYear, currentYearStart);
    return {
      payableYears,
      totalAmount: payableYears.length * MEMBERSHIP_FEE,
      isFirstTime: false,
      hasGap: true,
      gapYear: firstUnpaidYear,
      message: `You have skipped membership year(s). Please pay from ${firstUnpaidYear}-${firstUnpaidYear + 1} onwards.`
    };
  }
  
  // Check if all years are paid up to current year
  if (latestPaidYear >= currentYearStart) {
    return {
      payableYears: [],
      totalAmount: 0,
      isFirstTime: false,
      allPaid: true,
      message: 'All membership years are up to date!'
    };
  }
  
  // Generate payable years from next unpaid year to current year
  const nextYearToPay = latestPaidYear + 1;
  const payableYears = generateMembershipYears(nextYearToPay, currentYearStart);
  
  return {
    payableYears,
    totalAmount: payableYears.length * MEMBERSHIP_FEE,
    isFirstTime: false,
    message: `Pay for ${payableYears.length} pending year(s)`
  };
};

/**
 * Format amount in INR
 */
export const formatAmount = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

/**
 * Validate membership year format
 */
export const isValidMembershipYear = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Check if start is April 1st and end is March 31st
  return (
    start.getMonth() === 3 && // April (0-indexed)
    start.getDate() === 1 &&
    end.getMonth() === 2 && // March
    end.getDate() === 31 &&
    end.getFullYear() === start.getFullYear() + 1
  );
};

export { MEMBERSHIP_FEE };
