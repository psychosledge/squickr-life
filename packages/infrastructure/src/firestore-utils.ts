/**
 * Shared Firestore utility functions
 */

/**
 * Remove undefined values from an object (Firestore doesn't allow undefined)
 * Recursively cleans nested objects and arrays
 */
export function removeUndefinedDeep(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return null;
  }

  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedDeep);
  }

  if (typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefinedDeep(value);
      }
    }
    return cleaned;
  }

  return obj;
}
