import type { HabitFrequency } from './habit.types';

/**
 * Validate a habit title
 * @throws Error if title is empty (after trim) or exceeds 100 characters
 */
export function validateHabitTitle(title: string): void {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw new Error('Habit title cannot be empty');
  }
  if (trimmed.length > 100) {
    throw new Error('Habit title must be 100 characters or fewer');
  }
}

/**
 * Validate a habit frequency
 * @throws Error if frequency is invalid per its type constraints
 */
export function validateHabitFrequency(frequency: HabitFrequency): void {
  if (frequency.type === 'weekly') {
    if (!frequency.targetDays || frequency.targetDays.length === 0) {
      throw new Error('Weekly habit must have at least one target day');
    }
    for (const day of frequency.targetDays) {
      if (day < 0 || day > 6) {
        throw new Error('Weekly habit target days must be in range [0..6]');
      }
    }
  } else if (frequency.type === 'every-n-days') {
    if (frequency.n < 2 || frequency.n > 30) {
      throw new Error('every-n-days habit n must be in range [2..30]');
    }
  }
  // 'daily' has no additional constraints
}
