import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatMembershipYear,
  getStatusColor,
  isValidEmail,
  isValidPhone,
  debounce,
} from '../helpers';

describe('formatCurrency', () => {
  it('should format 1200 as INR', () => {
    const result = formatCurrency(1200);
    expect(result).toContain('1,200');
  });

  it('should format 0', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
  });

  it('should format large amounts with Indian grouping', () => {
    const result = formatCurrency(100000);
    expect(result).toContain('1,00,000');
  });

  it('should include rupee symbol', () => {
    const result = formatCurrency(500);
    expect(result).toMatch(/₹|INR/);
  });
});

describe('formatDate', () => {
  it('should return N/A for null', () => {
    expect(formatDate(null)).toBe('N/A');
  });

  it('should return N/A for undefined', () => {
    expect(formatDate(undefined)).toBe('N/A');
  });

  it('should format a valid date string', () => {
    const result = formatDate('2024-04-01');
    expect(result).toBeTruthy();
    expect(result).not.toBe('N/A');
    // Should contain year
    expect(result).toContain('2024');
  });
});

describe('formatDateTime', () => {
  it('should return N/A for null', () => {
    expect(formatDateTime(null)).toBe('N/A');
  });

  it('should format a valid datetime', () => {
    const result = formatDateTime('2024-04-01T10:30:00');
    expect(result).toBeTruthy();
    expect(result).not.toBe('N/A');
  });
});

describe('formatMembershipYear', () => {
  it('should format April-March membership year', () => {
    const result = formatMembershipYear('2024-04-01', '2025-03-31');
    expect(result).toBe('Apr 2024 - Mar 2025');
  });

  it('should format another year range', () => {
    const result = formatMembershipYear('2025-04-01', '2026-03-31');
    expect(result).toBe('Apr 2025 - Mar 2026');
  });
});

describe('getStatusColor', () => {
  it('should return green for success', () => {
    expect(getStatusColor('success')).toContain('green');
  });

  it('should return yellow for pending', () => {
    expect(getStatusColor('pending')).toContain('yellow');
  });

  it('should return red for failed', () => {
    expect(getStatusColor('failed')).toContain('red');
  });

  it('should return green for active', () => {
    expect(getStatusColor('active')).toContain('green');
  });

  it('should return gray for unknown status', () => {
    expect(getStatusColor('unknown')).toContain('gray');
  });

  it('should return gray for inactive', () => {
    expect(getStatusColor('inactive')).toContain('gray');
  });
});

describe('isValidEmail', () => {
  it('should return true for valid email', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
  });

  it('should return true for email with subdomain', () => {
    expect(isValidEmail('user@mail.example.com')).toBe(true);
  });

  it('should return false for missing @', () => {
    expect(isValidEmail('testexample.com')).toBe(false);
  });

  it('should return false for missing domain', () => {
    expect(isValidEmail('test@')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('should return false for spaces', () => {
    expect(isValidEmail('test @example.com')).toBe(false);
  });
});

describe('isValidPhone', () => {
  it('should return true for valid Indian phone starting with 9', () => {
    expect(isValidPhone('9876543210')).toBe(true);
  });

  it('should return true for phone starting with 6', () => {
    expect(isValidPhone('6123456789')).toBe(true);
  });

  it('should return true for phone starting with 7', () => {
    expect(isValidPhone('7123456789')).toBe(true);
  });

  it('should return true for phone starting with 8', () => {
    expect(isValidPhone('8123456789')).toBe(true);
  });

  it('should return false for phone starting with 1', () => {
    expect(isValidPhone('1234567890')).toBe(false);
  });

  it('should return false for too short', () => {
    expect(isValidPhone('98765')).toBe(false);
  });

  it('should return false for too long', () => {
    expect(isValidPhone('98765432101')).toBe(false);
  });

  it('should return false for non-digits', () => {
    expect(isValidPhone('98765abcde')).toBe(false);
  });
});

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should call function after delay', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced('arg1');
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledWith('arg1');
  });

  it('should cancel previous call when called again within delay', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced('first');
    vi.advanceTimersByTime(100);
    debounced('second');
    vi.advanceTimersByTime(300);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('second');
  });

  it('should not call function if delay has not elapsed', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 500);

    debounced();
    vi.advanceTimersByTime(200);

    expect(fn).not.toHaveBeenCalled();
  });
});
