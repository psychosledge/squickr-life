import { describe, it, expect } from 'vitest';
import { formatDateLabel } from './dateUtils';

describe('formatDateLabel', () => {
  // Fixed reference: Wednesday, February 19, 2026
  const reference = new Date('2026-02-19T12:00:00');

  it('should return "Today" when date matches the reference date', () => {
    expect(formatDateLabel('2026-02-19', reference)).toBe('Today');
  });

  it('should return "Yesterday" for the day before the reference date', () => {
    expect(formatDateLabel('2026-02-18', reference)).toBe('Yesterday');
  });

  it('should return "Tomorrow" for the day after the reference date', () => {
    expect(formatDateLabel('2026-02-20', reference)).toBe('Tomorrow');
  });

  it('should return a formatted date string for other dates', () => {
    const result = formatDateLabel('2026-02-17', reference);
    expect(result).toMatch(/Tuesday/);
    expect(result).toMatch(/Feb/);
    expect(result).toMatch(/17/);
  });

  it('should default to current time when no referenceDate is provided (smoke test)', () => {
    // Just verifies it doesn't throw and returns a string
    const result = formatDateLabel('2026-01-01');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle Yesterday correctly across a month boundary', () => {
    const marchFirst = new Date('2026-03-01T12:00:00');
    expect(formatDateLabel('2026-02-28', marchFirst)).toBe('Yesterday');
  });

  it('should handle Today correctly at the start of a year', () => {
    const newYear = new Date('2027-01-01T12:00:00');
    expect(formatDateLabel('2027-01-01', newYear)).toBe('Today');
  });

  it('should not shift dates for users west of UTC (T00:00:00 guard)', () => {
    // Simulates a date that would parse as the previous day if treated as UTC midnight.
    // With 'T00:00:00' appended, the Date constructor uses local time, so the date
    // remains correct regardless of the user's UTC offset.
    // We verify by checking the formatted output contains the correct month/day.
    const result = formatDateLabel('2026-02-01', new Date('2026-02-05T12:00:00'));
    expect(result).toMatch(/Feb/);
    expect(result).toMatch(/1/);
  });

  it('should format as "Weekday, Mon Day" for dates that are not today or yesterday', () => {
    // 2026-01-26 is a Monday
    const result = formatDateLabel('2026-01-26', reference);
    expect(result).toMatch(/Mon/);
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/26/);
  });
});
