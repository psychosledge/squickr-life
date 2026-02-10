import { describe, it, expect } from 'vitest';
import { validateCollectionName } from './collection-validation';

describe('validateCollectionName', () => {
  it('should return trimmed name for valid input', () => {
    const result = validateCollectionName('  Valid Name  ');
    expect(result).toBe('Valid Name');
  });

  it('should return name unchanged if already trimmed', () => {
    const result = validateCollectionName('Valid Name');
    expect(result).toBe('Valid Name');
  });

  it('should throw error if name is empty', () => {
    expect(() => validateCollectionName('')).toThrow('Name cannot be empty');
  });

  it('should throw error if name is only whitespace', () => {
    expect(() => validateCollectionName('   ')).toThrow('Name cannot be empty');
  });

  it('should handle tabs and other whitespace', () => {
    const result = validateCollectionName('\t\nValid Name\t\n');
    expect(result).toBe('Valid Name');
  });
});
