/**
 * Collection validation utilities
 * 
 * Reusable validation functions for collection operations
 */

/**
 * Validate and normalize a collection name
 * 
 * @param name - The name to validate
 * @returns The trimmed name
 * @throws Error if name is empty after trimming
 */
export function validateCollectionName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error('Name cannot be empty');
  }
  return trimmed;
}
