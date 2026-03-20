/**
 * ReviewStalledSection Tests
 *
 * Phase 1 (Proactive Squickr — Review Screen): ReviewStalledSection component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReviewStalledSection } from './ReviewStalledSection';
import type { StalledTask } from '@squickr/domain';
import type { Entry } from '@squickr/domain';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<{
  id: string;
  content: string;
}> = {}): Entry {
  return {
    type: 'task',
    id: overrides.id ?? 'task-1',
    content: overrides.content ?? 'Stalled task',
    status: 'open',
    collections: ['col-1'],
    createdAt: '2026-01-01T00:00:00.000Z',
  } as Entry;
}

function makeStalledTask(overrides: Partial<{
  entry: Entry;
  collectionId: string;
  collectionName: string;
  lastEventAt: string;
  staleDays: number;
}> = {}): StalledTask {
  return {
    entry: overrides.entry ?? makeEntry(),
    collectionId: overrides.collectionId ?? 'col-1',
    collectionName: overrides.collectionName ?? 'Monthly Log',
    lastEventAt: overrides.lastEventAt ?? '2026-02-01T00:00:00.000Z',
    staleDays: overrides.staleDays ?? 14,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ReviewStalledSection', () => {
  it('renders "No stalled projects" empty state when no stalled tasks', () => {
    render(<ReviewStalledSection stalledTasks={[]} />);
    expect(screen.getByText(/no stalled projects/i)).toBeInTheDocument();
  });

  it('renders section heading with count when tasks exist', () => {
    const tasks = [
      makeStalledTask(),
      makeStalledTask({
        entry: makeEntry({ id: 'task-2', content: 'Another stalled task' }),
        staleDays: 21,
      }),
    ];

    render(<ReviewStalledSection stalledTasks={tasks} />);

    expect(screen.getByRole('heading', { name: /stalled projects/i })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders stalled task content', () => {
    const tasks = [makeStalledTask({ entry: makeEntry({ content: 'Fix the bug' }) })];

    render(<ReviewStalledSection stalledTasks={tasks} />);

    expect(screen.getByText('Fix the bug')).toBeInTheDocument();
  });

  it('renders staleDays badge', () => {
    const tasks = [makeStalledTask({ staleDays: 30 })];

    render(<ReviewStalledSection stalledTasks={tasks} />);

    expect(screen.getByText('30d')).toBeInTheDocument();
    expect(screen.getByLabelText('30 days stale')).toBeInTheDocument();
  });

  it('groups tasks by collectionName', () => {
    const tasks = [
      makeStalledTask({
        entry: makeEntry({ id: 'task-1', content: 'Work task' }),
        collectionId: 'col-1',
        collectionName: 'Work Log',
        staleDays: 14,
      }),
      makeStalledTask({
        entry: makeEntry({ id: 'task-2', content: 'Personal task' }),
        collectionId: 'col-2',
        collectionName: 'Personal Log',
        staleDays: 7,
      }),
    ];

    render(<ReviewStalledSection stalledTasks={tasks} />);

    expect(screen.getByText('Work Log')).toBeInTheDocument();
    expect(screen.getByText('Personal Log')).toBeInTheDocument();
    expect(screen.getByText('Work task')).toBeInTheDocument();
    expect(screen.getByText('Personal task')).toBeInTheDocument();
  });
});
