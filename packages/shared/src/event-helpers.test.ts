import { describe, it, expect } from 'vitest';
import { generateEventMetadata } from './event-helpers';

describe('event-helpers', () => {
  describe('generateEventMetadata', () => {
    it('should generate unique event IDs', () => {
      const metadata1 = generateEventMetadata();
      const metadata2 = generateEventMetadata();
      
      expect(metadata1.id).not.toBe(metadata2.id);
    });

    it('should generate valid UUID v4', () => {
      const metadata = generateEventMetadata();
      
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(metadata.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate ISO 8601 timestamp', () => {
      const metadata = generateEventMetadata();
      
      // Should be valid ISO date string
      expect(metadata.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      
      // Should be parseable as Date
      const date = new Date(metadata.timestamp);
      expect(date.toISOString()).toBe(metadata.timestamp);
    });

    it('should set version to 1', () => {
      const metadata = generateEventMetadata();
      
      expect(metadata.version).toBe(1);
    });

    it('should generate recent timestamp', () => {
      const beforeTime = new Date().toISOString();
      const metadata = generateEventMetadata();
      const afterTime = new Date().toISOString();
      
      expect(metadata.timestamp >= beforeTime).toBe(true);
      expect(metadata.timestamp <= afterTime).toBe(true);
    });
  });
});
