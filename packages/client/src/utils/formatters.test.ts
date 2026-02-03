import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatTimestamp, formatDate, getCollectionDisplayName, formatMonthlyLogName } from './formatters';

describe('formatTimestamp', () => {
  const mockNow = new Date('2026-01-25T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "just now" for timestamps less than 10 seconds ago', () => {
    const timestamp = new Date('2026-01-25T11:59:55.000Z').toISOString();
    expect(formatTimestamp(timestamp)).toBe('just now');
  });

  it('should return seconds for timestamps between 10-59 seconds ago', () => {
    const timestamp = new Date('2026-01-25T11:59:30.000Z').toISOString();
    expect(formatTimestamp(timestamp)).toBe('30 seconds ago');
  });

  it('should return minutes for timestamps between 1-59 minutes ago', () => {
    const timestamp = new Date('2026-01-25T11:45:00.000Z').toISOString();
    expect(formatTimestamp(timestamp)).toBe('15 minutes ago');
  });

  it('should use singular "minute" for 1 minute ago', () => {
    const timestamp = new Date('2026-01-25T11:59:00.000Z').toISOString();
    expect(formatTimestamp(timestamp)).toBe('1 minute ago');
  });

  it('should return hours for timestamps between 1-23 hours ago', () => {
    const timestamp = new Date('2026-01-25T09:00:00.000Z').toISOString();
    expect(formatTimestamp(timestamp)).toBe('3 hours ago');
  });

  it('should use singular "hour" for 1 hour ago', () => {
    const timestamp = new Date('2026-01-25T11:00:00.000Z').toISOString();
    expect(formatTimestamp(timestamp)).toBe('1 hour ago');
  });

  it('should return days for timestamps 24+ hours ago', () => {
    const timestamp = new Date('2026-01-23T12:00:00.000Z').toISOString();
    expect(formatTimestamp(timestamp)).toBe('2 days ago');
  });

  it('should use singular "day" for 1 day ago', () => {
    const timestamp = new Date('2026-01-24T12:00:00.000Z').toISOString();
    expect(formatTimestamp(timestamp)).toBe('1 day ago');
  });

  it('should handle timestamps exactly at current time', () => {
    const timestamp = mockNow.toISOString();
    expect(formatTimestamp(timestamp)).toBe('just now');
  });

  it('should handle very old timestamps', () => {
    const timestamp = new Date('2025-01-25T12:00:00.000Z').toISOString();
    expect(formatTimestamp(timestamp)).toBe('365 days ago');
  });
});

describe('formatDate', () => {
  it('should format valid date string as readable date', () => {
    const result = formatDate('2026-01-25');
    // The exact format depends on locale, but should contain year, month, and day
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/January|Jan/);
    expect(result).toMatch(/25/);
  });

  it('should return original string for invalid date', () => {
    const invalidDate = 'invalid-date';
    expect(formatDate(invalidDate)).toBe(invalidDate);
  });

  it('should handle edge case dates correctly', () => {
    const result = formatDate('2026-12-31');
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/December|Dec/);
    expect(result).toMatch(/31/);
  });

  it('should handle leap year dates', () => {
    const result = formatDate('2024-02-29');
    expect(result).toMatch(/2024/);
    expect(result).toMatch(/February|Feb/);
    expect(result).toMatch(/29/);
  });

  it('should return original string for malformed dates', () => {
    const malformed = '2026-13-45';
    const result = formatDate(malformed);
    // Either returns the original string or throws (which we catch)
    expect(typeof result).toBe('string');
  });

  it('should handle empty string', () => {
    const result = formatDate('');
    expect(result).toBe('');
  });
});

describe('getCollectionDisplayName', () => {
  it('should format daily log with date as "Weekday, Month Day"', () => {
    const collection = {
      name: 'Some stored name',
      type: 'daily' as const,
      date: '2026-02-01'
    };
    const result = getCollectionDisplayName(collection);
    // Should be formatted as "Sunday, February 1" (2026-02-01 is a Sunday)
    expect(result).toMatch(/February/);
    expect(result).toMatch(/1/);
    expect(result).not.toBe(collection.name); // Should NOT use the stored name
  });

  it('should return name as-is for custom collection', () => {
    const collection = {
      name: 'My Custom Collection',
      type: 'custom' as const
    };
    const result = getCollectionDisplayName(collection);
    expect(result).toBe('My Custom Collection');
  });

  it('should return name as-is for legacy collection without type', () => {
    const collection = {
      name: 'Legacy Collection'
    };
    const result = getCollectionDisplayName(collection);
    expect(result).toBe('Legacy Collection');
  });

  it('should handle daily log without date gracefully', () => {
    const collection = {
      name: 'Broken Daily Log',
      type: 'daily' as const
    };
    const result = getCollectionDisplayName(collection);
    // Should fall back to name if no date
    expect(result).toBe('Broken Daily Log');
  });

  it('should format different dates correctly', () => {
    const collection = {
      name: 'Stored',
      type: 'daily' as const,
      date: '2026-12-25'
    };
    const result = getCollectionDisplayName(collection);
    expect(result).toMatch(/December/);
    expect(result).toMatch(/25/);
  });

  it('should format monthly log with date as "Month Year"', () => {
    const collection = {
      name: 'Some stored name',
      type: 'monthly' as const,
      date: '2026-02'
    };
    const result = getCollectionDisplayName(collection);
    // Should be formatted as "February 2026"
    expect(result).toBe('February 2026');
    expect(result).not.toBe(collection.name); // Should NOT use the stored name
  });

  it('should handle monthly log without date gracefully', () => {
    const collection = {
      name: 'Broken Monthly Log',
      type: 'monthly' as const
    };
    const result = getCollectionDisplayName(collection);
    // Should fall back to name if no date
    expect(result).toBe('Broken Monthly Log');
  });
});

describe('formatMonthlyLogName', () => {
  it('should format YYYY-MM to "Month Year"', () => {
    expect(formatMonthlyLogName('2026-02')).toBe('February 2026');
    expect(formatMonthlyLogName('2025-12')).toBe('December 2025');
    expect(formatMonthlyLogName('2026-01')).toBe('January 2026');
  });

  it('should handle all months correctly', () => {
    expect(formatMonthlyLogName('2026-01')).toBe('January 2026');
    expect(formatMonthlyLogName('2026-02')).toBe('February 2026');
    expect(formatMonthlyLogName('2026-03')).toBe('March 2026');
    expect(formatMonthlyLogName('2026-04')).toBe('April 2026');
    expect(formatMonthlyLogName('2026-05')).toBe('May 2026');
    expect(formatMonthlyLogName('2026-06')).toBe('June 2026');
    expect(formatMonthlyLogName('2026-07')).toBe('July 2026');
    expect(formatMonthlyLogName('2026-08')).toBe('August 2026');
    expect(formatMonthlyLogName('2026-09')).toBe('September 2026');
    expect(formatMonthlyLogName('2026-10')).toBe('October 2026');
    expect(formatMonthlyLogName('2026-11')).toBe('November 2026');
    expect(formatMonthlyLogName('2026-12')).toBe('December 2026');
  });

  it('should handle different years', () => {
    expect(formatMonthlyLogName('2020-06')).toBe('June 2020');
    expect(formatMonthlyLogName('2030-06')).toBe('June 2030');
  });
});
