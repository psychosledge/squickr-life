import type { CollectionType } from './collection.types';

/**
 * Validates a date string for a given collection type
 * 
 * @param date - The date string to validate
 * @param type - The collection type
 * @throws Error if date is invalid or doesn't match the expected format for the type
 */
export function validateCollectionDate(date: string | undefined, type: CollectionType): void {
  // Custom collections don't require dates
  if (type === 'custom' || type === 'log' || type === 'tracker') {
    return;
  }

  // Temporal collections require dates
  if (!date) {
    throw new Error(`Date is required for ${type} collections`);
  }

  // Validate format based on type
  switch (type) {
    case 'daily':
      validateDailyDate(date);
      break;
    case 'monthly':
      validateMonthlyDate(date);
      break;
    case 'yearly':
      validateYearlyDate(date);
      break;
  }
}

/**
 * Validates a daily collection date (YYYY-MM-DD format)
 */
function validateDailyDate(date: string): void {
  const dailyPattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!dailyPattern.test(date)) {
    throw new Error('Invalid date format for daily collection. Expected YYYY-MM-DD');
  }

  // Validate it's a real date
  const parts = date.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  
  const dateObj = new Date(year, month - 1, day);
  
  if (
    dateObj.getFullYear() !== year ||
    dateObj.getMonth() !== month - 1 ||
    dateObj.getDate() !== day
  ) {
    throw new Error(`Invalid date: ${date}`);
  }
}

/**
 * Validates a monthly collection date (YYYY-MM format)
 */
function validateMonthlyDate(date: string): void {
  const monthlyPattern = /^\d{4}-\d{2}$/;
  if (!monthlyPattern.test(date)) {
    throw new Error('Invalid date format for monthly collection. Expected YYYY-MM');
  }

  // Validate month is 01-12
  const parts = date.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  
  if (month < 1 || month > 12) {
    throw new Error(`Invalid date: ${date}`);
  }
  
  if (year < 1000 || year > 9999) {
    throw new Error(`Invalid date: ${date}`);
  }
}

/**
 * Validates a yearly collection date (YYYY format)
 */
function validateYearlyDate(date: string): void {
  const yearlyPattern = /^\d{4}$/;
  if (!yearlyPattern.test(date)) {
    throw new Error('Invalid date format for yearly collection. Expected YYYY');
  }

  const year = Number(date);
  if (year < 1000 || year > 9999) {
    throw new Error(`Invalid date: ${date}`);
  }
}
