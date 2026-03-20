/**
 * ReviewCompletedSection Tests
 *
 * Phase 1 (Proactive Squickr — Review Screen): ReviewCompletedSection component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReviewCompletedSection } from './ReviewCompletedSection';
import type { Entry, Collection } from '@squickr/domain';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<{
  id: string;
  content: string;
  collections: string[];
  completedAt: string;
}> = {}): Entry {
  return {
    type: 'task',
    id: overrides.id ?? 'task-1',
    content: overrides.content ?? 'Do something',
    status: 'completed',
    collections: overrides.collections ?? ['col-1'],
    completedAt: overrides.completedAt ?? '2026-03-19T10:00:00.000Z',
    createdAt: '2026-03-01T00:00:00.000Z',
  } as Entry;
}

function makeCollection(id: string, name: string): Collection {
  return {
    id,
    name,
    type: 'monthly',
    order: 'a0',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ReviewCompletedSection', () => {
  it('renders "Nothing completed this week" when entries is empty and period is weekly', () => {
    render(
      <ReviewCompletedSection
        entries={[]}
        collectionMap={new Map()}
        period="weekly"
      />
    );
    expect(
      screen.getByText(/nothing completed this week/i)
    ).toBeInTheDocument();
  });

  it('renders "Nothing completed this month" when entries is empty and period is monthly', () => {
    render(
      <ReviewCompletedSection
        entries={[]}
        collectionMap={new Map()}
        period="monthly"
      />
    );
    expect(
      screen.getByText(/nothing completed this month/i)
    ).toBeInTheDocument();
  });

  it('renders section heading with count when entries exist', () => {
    const entries = [makeTask(), makeTask({ id: 'task-2', content: 'Another task' })];
    const collectionMap = new Map([['col-1', makeCollection('col-1', 'My Collection')]]);

    render(
      <ReviewCompletedSection
        entries={entries}
        collectionMap={collectionMap}
        period="weekly"
      />
    );

    expect(screen.getByRole('heading', { name: /completed/i })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('groups entries by collection name', () => {
    const entries = [
      makeTask({ id: 'task-1', collections: ['col-1'] }),
      makeTask({ id: 'task-2', collections: ['col-2'] }),
    ];
    const collectionMap = new Map([
      ['col-1', makeCollection('col-1', 'Work')],
      ['col-2', makeCollection('col-2', 'Personal')],
    ]);

    render(
      <ReviewCompletedSection
        entries={entries}
        collectionMap={collectionMap}
        period="weekly"
      />
    );

    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Personal')).toBeInTheDocument();
  });

  it('renders entry content text', () => {
    const entries = [makeTask({ content: 'Write tests' })];
    const collectionMap = new Map([['col-1', makeCollection('col-1', 'Work')]]);

    render(
      <ReviewCompletedSection
        entries={entries}
        collectionMap={collectionMap}
        period="weekly"
      />
    );

    expect(screen.getByText('Write tests')).toBeInTheDocument();
  });

  it('renders completedAt date formatted as "Mar 19"', () => {
    const entries = [
      makeTask({ completedAt: '2026-03-19T10:00:00.000Z' }),
    ];
    const collectionMap = new Map([['col-1', makeCollection('col-1', 'Work')]]);

    render(
      <ReviewCompletedSection
        entries={entries}
        collectionMap={collectionMap}
        period="weekly"
      />
    );

    expect(screen.getByText(/Mar 19/)).toBeInTheDocument();
  });

  it('shows entry under all collections it belongs to (multi-collection)', () => {
    const entries = [
      makeTask({
        id: 'task-1',
        content: 'Cross-collection task',
        collections: ['col-1', 'col-2'],
      }),
    ];
    const collectionMap = new Map([
      ['col-1', makeCollection('col-1', 'Work')],
      ['col-2', makeCollection('col-2', 'Personal')],
    ]);

    render(
      <ReviewCompletedSection
        entries={entries}
        collectionMap={collectionMap}
        period="weekly"
      />
    );

    // The entry content should appear twice (once per collection)
    const items = screen.getAllByText('Cross-collection task');
    expect(items).toHaveLength(2);

    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Personal')).toBeInTheDocument();
  });

  it('falls back to "Unknown Collection" when collection not in map', () => {
    const entries = [
      makeTask({ id: 'task-1', collections: ['col-missing'] }),
    ];

    render(
      <ReviewCompletedSection
        entries={entries}
        collectionMap={new Map()}
        period="weekly"
      />
    );

    expect(screen.getByText('Unknown Collection')).toBeInTheDocument();
  });
});
