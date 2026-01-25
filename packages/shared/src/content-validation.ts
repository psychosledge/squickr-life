/**
 * Content Validation Utilities
 * 
 * Shared validation logic for content fields across Note and Event entities.
 * This reduces code duplication and ensures consistent validation rules.
 */

/**
 * Validates and trims content string
 * 
 * @param content - The content to validate
 * @param maxLength - Maximum allowed length (default: 5000)
 * @returns The trimmed content
 * @throws Error if content is empty or exceeds max length
 */
export function validateContent(content: string, maxLength: number = 5000): string {
  const trimmed = content.trim();
  
  if (trimmed.length === 0) {
    throw new Error('Content cannot be empty');
  }
  
  if (trimmed.length > maxLength) {
    throw new Error(`Content must be between 1 and ${maxLength} characters`);
  }
  
  return trimmed;
}

/**
 * Validates ISO 8601 date string
 * 
 * @param dateString - The date string to validate
 * @returns true if valid, false otherwise
 */
export function isValidISODate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Validates an optional ISO 8601 date (can be null)
 * 
 * @param dateString - The date string to validate (or null)
 * @throws Error if date is provided but invalid
 */
export function validateOptionalISODate(dateString: string | null | undefined): void {
  if (dateString !== null && dateString !== undefined) {
    if (!isValidISODate(dateString)) {
      throw new Error('Event date must be a valid ISO 8601 date');
    }
  }
}
