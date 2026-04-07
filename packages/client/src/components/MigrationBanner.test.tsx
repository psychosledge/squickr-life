import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MigrationBanner } from './MigrationBanner';

describe('MigrationBanner', () => {
  it('renders the correct message with count and source collection name', () => {
    render(
      <MigrationBanner
        count={5}
        collectionName="Monday, Apr 6"
        onDismiss={vi.fn()}
      />
    );
    expect(
      screen.getByText('5 tasks migrated here from Monday, Apr 6')
    ).toBeInTheDocument();
  });

  it('pluralises "task" when count is 1', () => {
    render(
      <MigrationBanner
        count={1}
        collectionName="Yesterday"
        onDismiss={vi.fn()}
      />
    );
    expect(
      screen.getByText('1 task migrated here from Yesterday')
    ).toBeInTheDocument();
  });

  it('pluralises "tasks" when count is more than 1', () => {
    render(
      <MigrationBanner
        count={3}
        collectionName="Last Week"
        onDismiss={vi.fn()}
      />
    );
    expect(
      screen.getByText('3 tasks migrated here from Last Week')
    ).toBeInTheDocument();
  });

  it('renders a dismiss button', () => {
    render(
      <MigrationBanner
        count={2}
        collectionName="Monday"
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });

  it('calls onDismiss when the dismiss button is clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();

    render(
      <MigrationBanner
        count={2}
        collectionName="Monday"
        onDismiss={onDismiss}
      />
    );

    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('has an accessible status role for screen readers', () => {
    render(
      <MigrationBanner
        count={4}
        collectionName="Tuesday"
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders "0 tasks" (plural) when count is 0', () => {
    // The migrate handler guards against this case (returns early when no tasks),
    // but the component boundary should be explicitly documented.
    // English treats 0 as grammatically plural: "0 tasks", not "0 task".
    render(
      <MigrationBanner
        count={0}
        collectionName="Monday, Apr 6"
        onDismiss={vi.fn()}
      />
    );
    expect(
      screen.getByText('0 tasks migrated here from Monday, Apr 6')
    ).toBeInTheDocument();
  });
});
