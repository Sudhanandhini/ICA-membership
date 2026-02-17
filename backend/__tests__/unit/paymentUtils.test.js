import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MEMBERSHIP_FEE,
  getCurrentMembershipYear,
  generateMembershipYears,
  parseMembershipYear,
  calculatePayableYears,
  formatAmount,
  isValidMembershipYear,
} from '../../utils/paymentUtils.js';

describe('Payment Utilities', () => {
  describe('MEMBERSHIP_FEE', () => {
    it('should be 1200', () => {
      expect(MEMBERSHIP_FEE).toBe(1200);
    });
  });

  describe('getCurrentMembershipYear', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return current year as start when in Apr-Dec', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 5, 15)); // June 2025
      const result = getCurrentMembershipYear();
      expect(result.start).toBe('2025-04-01');
      expect(result.end).toBe('2026-03-31');
      expect(result.label).toBe('Apr 2025 - Mar 2026');
    });

    it('should return previous year as start when in Jan-Mar', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 1, 14)); // Feb 2026
      const result = getCurrentMembershipYear();
      expect(result.start).toBe('2025-04-01');
      expect(result.end).toBe('2026-03-31');
      expect(result.label).toBe('Apr 2025 - Mar 2026');
    });

    it('should return correct year when in April (boundary)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 3, 1)); // April 1, 2025
      const result = getCurrentMembershipYear();
      expect(result.start).toBe('2025-04-01');
      expect(result.end).toBe('2026-03-31');
    });

    it('should return correct year when in March (boundary)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 2, 31)); // March 31, 2026
      const result = getCurrentMembershipYear();
      expect(result.start).toBe('2025-04-01');
      expect(result.end).toBe('2026-03-31');
    });
  });

  describe('generateMembershipYears', () => {
    it('should generate correct range of years', () => {
      const years = generateMembershipYears(2022, 2024);
      expect(years).toHaveLength(3);
      expect(years[0]).toEqual({
        start: '2022-04-01',
        end: '2023-03-31',
        label: 'Apr 2022 - Mar 2023',
      });
      expect(years[2]).toEqual({
        start: '2024-04-01',
        end: '2025-03-31',
        label: 'Apr 2024 - Mar 2025',
      });
    });

    it('should return single year when start equals end', () => {
      const years = generateMembershipYears(2025, 2025);
      expect(years).toHaveLength(1);
    });

    it('should return empty array when start > end', () => {
      const years = generateMembershipYears(2026, 2024);
      expect(years).toHaveLength(0);
    });
  });

  describe('parseMembershipYear', () => {
    it('should extract year from date string', () => {
      expect(parseMembershipYear('2024-04-01')).toBe(2024);
    });

    it('should handle ISO date strings', () => {
      expect(parseMembershipYear('2023-12-15T10:00:00Z')).toBe(2023);
    });
  });

  describe('calculatePayableYears', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 5, 15)); // June 2025
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return current year for empty history (first-time)', () => {
      const result = calculatePayableYears([]);
      expect(result.isFirstTime).toBe(true);
      expect(result.totalAmount).toBe(MEMBERSHIP_FEE);
      expect(result.payableYears).toHaveLength(1);
    });

    it('should return current year for null history', () => {
      const result = calculatePayableYears(null);
      expect(result.isFirstTime).toBe(true);
    });

    it('should detect all paid up to current year', () => {
      const history = [
        { payment_status: 'success', membership_year_start: '2024-04-01' },
        { payment_status: 'success', membership_year_start: '2025-04-01' },
      ];
      const result = calculatePayableYears(history);
      expect(result.allPaid).toBe(true);
      expect(result.payableYears).toHaveLength(0);
      expect(result.totalAmount).toBe(0);
    });

    it('should detect gap in payment history', () => {
      const history = [
        { payment_status: 'success', membership_year_start: '2022-04-01' },
        { payment_status: 'success', membership_year_start: '2024-04-01' },
        // gap at 2023
      ];
      const result = calculatePayableYears(history);
      expect(result.hasGap).toBe(true);
      expect(result.gapYear).toBe(2023);
    });

    it('should calculate sequential unpaid years', () => {
      const history = [
        { payment_status: 'success', membership_year_start: '2022-04-01' },
        { payment_status: 'success', membership_year_start: '2023-04-01' },
      ];
      const result = calculatePayableYears(history);
      expect(result.isFirstTime).toBe(false);
      expect(result.payableYears.length).toBeGreaterThan(0);
      expect(result.totalAmount).toBe(result.payableYears.length * MEMBERSHIP_FEE);
    });

    it('should handle history with no successful payments', () => {
      const history = [
        { payment_status: 'failed', membership_year_start: '2024-04-01' },
      ];
      const result = calculatePayableYears(history);
      expect(result.isFirstTime).toBe(true);
    });
  });

  describe('formatAmount', () => {
    it('should format 1200 as INR currency', () => {
      const formatted = formatAmount(1200);
      expect(formatted).toContain('1,200');
    });

    it('should format 0', () => {
      const formatted = formatAmount(0);
      expect(formatted).toContain('0');
    });

    it('should format large amounts with Indian grouping', () => {
      const formatted = formatAmount(100000);
      expect(formatted).toContain('1,00,000');
    });
  });

  describe('isValidMembershipYear', () => {
    it('should return true for valid April-March period', () => {
      expect(isValidMembershipYear('2024-04-01', '2025-03-31')).toBe(true);
    });

    it('should return false for non-April start', () => {
      expect(isValidMembershipYear('2024-01-01', '2025-03-31')).toBe(false);
    });

    it('should return false for non-March end', () => {
      expect(isValidMembershipYear('2024-04-01', '2025-04-30')).toBe(false);
    });

    it('should return false for same year start and end', () => {
      expect(isValidMembershipYear('2024-04-01', '2024-03-31')).toBe(false);
    });
  });
});
