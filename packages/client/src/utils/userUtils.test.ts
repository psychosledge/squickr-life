/**
 * User Utilities Tests
 * 
 * Tests for user-related utility functions
 */

import { describe, it, expect } from 'vitest';
import { getInitials } from './userUtils';

describe('getInitials', () => {
  it('should return first and last initials for multi-word names', () => {
    expect(getInitials('John Doe')).toBe('JD');
    expect(getInitials('Jane Marie Smith')).toBe('JS');
    expect(getInitials('Mary Jane Watson Parker')).toBe('MP');
  });

  it('should return first initial for single-word names', () => {
    expect(getInitials('John')).toBe('J');
    expect(getInitials('Madonna')).toBe('M');
    expect(getInitials('Cher')).toBe('C');
  });

  it('should return "?" for null input', () => {
    expect(getInitials(null)).toBe('?');
  });

  it('should return "?" for empty string', () => {
    expect(getInitials('')).toBe('?');
  });

  it('should return "?" for whitespace-only string', () => {
    expect(getInitials('   ')).toBe('?');
    expect(getInitials('\t\n')).toBe('?');
  });

  it('should trim whitespace before extracting initials', () => {
    expect(getInitials('  John Doe  ')).toBe('JD');
    expect(getInitials('  Jane  Smith  ')).toBe('JS');
    expect(getInitials('   John   ')).toBe('J');
  });

  it('should convert initials to uppercase', () => {
    expect(getInitials('john doe')).toBe('JD');
    expect(getInitials('jane smith')).toBe('JS');
    expect(getInitials('alice')).toBe('A');
  });

  it('should handle names with multiple spaces between words', () => {
    expect(getInitials('John  Doe')).toBe('JD');
    expect(getInitials('Jane   Marie   Smith')).toBe('JS');
  });

  it('should handle names with special characters', () => {
    expect(getInitials('Jean-Luc Picard')).toBe('JP');
    expect(getInitials("O'Brien")).toBe('O');
    expect(getInitials('José García')).toBe('JG');
  });
});
