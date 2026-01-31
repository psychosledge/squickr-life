/**
 * User Utilities
 * 
 * Helper functions for user-related operations
 */

/**
 * Extracts initials from a user's name or email.
 * Returns first and last initials for multi-word names.
 * Returns first initial for single-word names.
 */
export function getInitials(name: string | null): string {
  if (!name || name.trim().length === 0) return '?';
  
  const parts = name.trim().split(/\s+/).filter(part => part.length > 0);
  
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    const firstChar = parts[0]?.[0];
    return firstChar ? firstChar.toUpperCase() : '?';
  }
  
  const firstChar = parts[0]?.[0];
  const lastChar = parts[parts.length - 1]?.[0];
  
  if (!firstChar || !lastChar) return '?';
  
  return (firstChar + lastChar).toUpperCase();
}
