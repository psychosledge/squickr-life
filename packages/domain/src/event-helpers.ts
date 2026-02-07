/**
 * Event Metadata
 * Common fields for all domain events
 */
export interface EventMetadata {
  readonly id: string;
  readonly timestamp: string;
  readonly version: number;
}

/**
 * Generate event metadata with unique ID and timestamp
 * 
 * This helper centralizes the event metadata generation logic
 * that was duplicated across all command handlers.
 * 
 * @returns EventMetadata with unique UUID and ISO timestamp
 */
export function generateEventMetadata(): EventMetadata {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    version: 1,
  };
}
