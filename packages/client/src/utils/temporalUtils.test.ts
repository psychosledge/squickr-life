import { describe, it, expect } from 'vitest';
import { getDateKeyForTemporal, getMonthKeyForTemporal } from './temporalUtils';

describe('getDateKeyForTemporal', () => {
  it('should return current date in YYYY-MM-DD format for "today"', () => {
    const now = new Date('2026-02-11T14:30:00Z');
    const result = getDateKeyForTemporal('today', now);
    expect(result).toBe('2026-02-11');
  });

  it('should return previous day for "yesterday"', () => {
    const now = new Date('2026-02-11T14:30:00Z');
    const result = getDateKeyForTemporal('yesterday', now);
    expect(result).toBe('2026-02-10');
  });

  it('should return next day for "tomorrow"', () => {
    const now = new Date('2026-02-11T14:30:00Z');
    const result = getDateKeyForTemporal('tomorrow', now);
    expect(result).toBe('2026-02-12');
  });

  it('should handle month boundaries correctly (Feb 28 → Mar 1)', () => {
    const feb28 = new Date('2026-02-28T14:30:00Z');
    const result = getDateKeyForTemporal('tomorrow', feb28);
    expect(result).toBe('2026-03-01');
  });

  it('should handle month boundaries backwards (Mar 1 → Feb 28)', () => {
    const mar1 = new Date('2026-03-01T14:30:00Z');
    const result = getDateKeyForTemporal('yesterday', mar1);
    expect(result).toBe('2026-02-28');
  });

  it('should handle year boundaries correctly (Dec 31 → Jan 1)', () => {
    const dec31 = new Date('2025-12-31T14:30:00Z');
    const result = getDateKeyForTemporal('tomorrow', dec31);
    expect(result).toBe('2026-01-01');
  });

  it('should handle year boundaries backwards (Jan 1 → Dec 31)', () => {
    const jan1 = new Date('2026-01-01T14:30:00Z');
    const result = getDateKeyForTemporal('yesterday', jan1);
    expect(result).toBe('2025-12-31');
  });

  it('should use current date when no date is provided', () => {
    const result = getDateKeyForTemporal('today');
    // Should return today's date in YYYY-MM-DD format
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should maintain timezone consistency', () => {
    // Test with different times on the same local date
    // Using local date creation to avoid UTC/local confusion
    const earlyMorning = new Date(2026, 1, 11, 2, 0, 0); // Feb 11 2026, 2 AM local
    const result1 = getDateKeyForTemporal('today', earlyMorning);
    
    const lateEvening = new Date(2026, 1, 11, 22, 0, 0); // Feb 11 2026, 10 PM local
    const result2 = getDateKeyForTemporal('today', lateEvening);
    
    // Both should return the same date for "today" regardless of time
    expect(result1).toBe('2026-02-11');
    expect(result2).toBe('2026-02-11');
  });
});

describe('getMonthKeyForTemporal', () => {
  it('should return current month in YYYY-MM format for "this-month"', () => {
    const now = new Date('2026-02-11T14:30:00Z');
    const result = getMonthKeyForTemporal('this-month', now);
    expect(result).toBe('2026-02');
  });

  it('should return previous month for "last-month"', () => {
    const now = new Date('2026-02-11T14:30:00Z');
    const result = getMonthKeyForTemporal('last-month', now);
    expect(result).toBe('2026-01');
  });

  it('should return next month for "next-month"', () => {
    const now = new Date('2026-02-11T14:30:00Z');
    const result = getMonthKeyForTemporal('next-month', now);
    expect(result).toBe('2026-03');
  });

  it('should handle year boundaries correctly (Jan → Dec previous year)', () => {
    const jan = new Date('2026-01-15T14:30:00Z');
    const result = getMonthKeyForTemporal('last-month', jan);
    expect(result).toBe('2025-12');
  });

  it('should handle year boundaries correctly (Dec → Jan next year)', () => {
    const dec = new Date('2025-12-15T14:30:00Z');
    const result = getMonthKeyForTemporal('next-month', dec);
    expect(result).toBe('2026-01');
  });

  it('should use current date when no date is provided', () => {
    const result = getMonthKeyForTemporal('this-month');
    // Should return current month in YYYY-MM format
    expect(result).toMatch(/^\d{4}-\d{2}$/);
  });

  it('should pad single-digit months with zero', () => {
    const sep = new Date('2026-09-15T14:30:00Z');
    const result = getMonthKeyForTemporal('this-month', sep);
    expect(result).toBe('2026-09');
  });
});
