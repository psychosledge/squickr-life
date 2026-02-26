/**
 * Shared test fixtures for MigrateEntryDialog tests
 * 
 * Extracted from MigrateEntryDialog.test.tsx to reduce duplication
 * across split test files.
 */

import type { Entry, Collection } from '@squickr/domain';

/**
 * Standard mock collections used across tests
 */
export const mockCollections: Collection[] = [
  {
    id: 'daily-log',
    name: 'Daily Log',
    type: 'daily',
    date: '2026-01-24', // Daily logs need a date field
    createdAt: '2026-01-24T10:00:00.000Z',
    order: 'a0',
  },
  {
    id: 'monthly-log',
    name: 'Monthly Log',
    type: 'monthly',
    date: '2026-01', // Monthly logs need a date field
    createdAt: '2026-01-24T10:00:00.000Z',
    order: 'a1',
  },
  {
    id: 'work-projects',
    name: 'Work Projects',
    type: 'custom',
    createdAt: '2026-01-24T10:00:00.000Z',
    order: 'a2',
  },
];

/**
 * Mock task for single entry tests
 */
export const mockTask: Entry = {
  type: 'task',
  id: 'task-1',
  title: 'Buy milk',
  createdAt: '2026-01-24T10:00:00.000Z',
  status: 'open',
  collections: [],
};

/**
 * Mock sub-task with parentEntryId
 */
export const mockSubTask: Entry = {
  type: 'task',
  id: 'task-2',
  title: 'Buy organic milk',
  createdAt: '2026-01-24T10:00:00.000Z',
  status: 'open',
  collections: [],
  parentEntryId: 'task-1',
};

/**
 * Mock note for entry tests
 */
export const mockNote: Entry = {
  type: 'note',
  id: 'note-1',
  content: 'Important meeting notes',
  createdAt: '2026-01-24T10:00:00.000Z',
  collections: [],
};

/**
 * Mock event for entry tests
 */
export const mockEvent: Entry = {
  type: 'event',
  id: 'event-1',
  content: 'Team standup',
  createdAt: '2026-01-24T10:00:00.000Z',
  eventDate: '2026-02-15',
  collections: [],
};

/**
 * Mock multiple entries for bulk migration tests
 */
export const mockBulkEntries: Entry[] = [
  {
    type: 'task',
    id: 'task-1',
    title: 'Buy milk',
    createdAt: '2026-01-24T10:00:00.000Z',
    status: 'open',
    collections: [],
  },
  {
    type: 'task',
    id: 'task-2',
    title: 'Buy eggs',
    createdAt: '2026-01-24T10:01:00.000Z',
    status: 'open',
    collections: [],
  },
  {
    type: 'task',
    id: 'task-3',
    title: 'Buy bread',
    createdAt: '2026-01-24T10:02:00.000Z',
    status: 'open',
    collections: [],
  },
];
