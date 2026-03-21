import { describe, it, expect } from 'vitest';
import { validateHabitTitle, validateHabitFrequency } from './habit-validation';
import type { HabitFrequency } from './habit.types';

describe('validateHabitTitle', () => {
  it('should accept a valid title', () => {
    expect(() => validateHabitTitle('Morning run')).not.toThrow();
  });

  it('should accept a title of exactly 100 characters', () => {
    const title = 'a'.repeat(100);
    expect(() => validateHabitTitle(title)).not.toThrow();
  });

  it('should throw if title is empty', () => {
    expect(() => validateHabitTitle('')).toThrow('Habit title cannot be empty');
  });

  it('should throw if title is only whitespace', () => {
    expect(() => validateHabitTitle('   ')).toThrow('Habit title cannot be empty');
  });

  it('should throw if title exceeds 100 characters', () => {
    const title = 'a'.repeat(101);
    expect(() => validateHabitTitle(title)).toThrow('Habit title must be 100 characters or fewer');
  });

  it('should accept a title of 1 character', () => {
    expect(() => validateHabitTitle('x')).not.toThrow();
  });
});

describe('validateHabitFrequency', () => {
  it('should accept daily frequency', () => {
    const freq: HabitFrequency = { type: 'daily' };
    expect(() => validateHabitFrequency(freq)).not.toThrow();
  });

  it('should accept weekly frequency with valid target days', () => {
    const freq: HabitFrequency = { type: 'weekly', targetDays: [1, 3, 5] };
    expect(() => validateHabitFrequency(freq)).not.toThrow();
  });

  it('should accept weekly frequency with all days', () => {
    const freq: HabitFrequency = { type: 'weekly', targetDays: [0, 1, 2, 3, 4, 5, 6] };
    expect(() => validateHabitFrequency(freq)).not.toThrow();
  });

  it('should throw if weekly frequency has no target days', () => {
    const freq: HabitFrequency = { type: 'weekly', targetDays: [] };
    expect(() => validateHabitFrequency(freq)).toThrow('Weekly habit must have at least one target day');
  });

  it('should throw if weekly frequency has a day outside [0..6]', () => {
    // TypeScript would normally prevent this, but we test runtime validation
    const freq = { type: 'weekly', targetDays: [1, 7] } as unknown as HabitFrequency;
    expect(() => validateHabitFrequency(freq)).toThrow('Weekly habit target days must be in range [0..6]');
  });

  it('should accept every-n-days with n=2 (minimum)', () => {
    const freq: HabitFrequency = { type: 'every-n-days', n: 2 };
    expect(() => validateHabitFrequency(freq)).not.toThrow();
  });

  it('should accept every-n-days with n=30 (maximum)', () => {
    const freq: HabitFrequency = { type: 'every-n-days', n: 30 };
    expect(() => validateHabitFrequency(freq)).not.toThrow();
  });

  it('should throw if every-n-days has n < 2', () => {
    const freq: HabitFrequency = { type: 'every-n-days', n: 1 };
    expect(() => validateHabitFrequency(freq)).toThrow('every-n-days habit n must be in range [2..30]');
  });

  it('should throw if every-n-days has n > 30', () => {
    const freq: HabitFrequency = { type: 'every-n-days', n: 31 };
    expect(() => validateHabitFrequency(freq)).toThrow('every-n-days habit n must be in range [2..30]');
  });

  it('should throw if every-n-days has n=0', () => {
    const freq: HabitFrequency = { type: 'every-n-days', n: 0 };
    expect(() => validateHabitFrequency(freq)).toThrow('every-n-days habit n must be in range [2..30]');
  });
});
