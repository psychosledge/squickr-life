import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CollectionStats } from './CollectionStats';
import type { Entry } from '@squickr/domain';

describe('CollectionStats', () => {
  it('shows only non-zero counts', () => {
    const entries: Entry[] = [
      { 
        type: 'task', 
        id: '1', 
        title: 'Test task',
        status: 'open',
        createdAt: '2026-02-03T12:00:00Z'
      },
      { 
        type: 'note', 
        id: '2', 
        content: 'Test note',
        createdAt: '2026-02-03T12:00:00Z'
      }
    ];
    
    render(<CollectionStats entries={entries} />);
    
    // Should show: "☐ 1" and "📝 1"
    expect(screen.getByText('☐ 1')).toBeInTheDocument();
    expect(screen.getByText('📝 1')).toBeInTheDocument();
    
    // Should NOT show completed tasks or events (zero counts)
    expect(screen.queryByText(/✓ \d+/)).not.toBeInTheDocument();
    expect(screen.queryByText(/📅 \d+/)).not.toBeInTheDocument();
  });

  it('returns null when all counts are zero', () => {
    const entries: Entry[] = [];
    
    const { container } = render(<CollectionStats entries={entries} />);
    
    // Component should render nothing
    expect(container.firstChild).toBeNull();
  });

  it('orders stats correctly', () => {
    const entries: Entry[] = [
      { 
        type: 'event', 
        id: '1', 
        content: 'Test event',
        createdAt: '2026-02-03T12:00:00Z'
      },
      { 
        type: 'note', 
        id: '2', 
        content: 'Test note',
        createdAt: '2026-02-03T12:00:00Z'
      },
      { 
        type: 'task', 
        id: '3', 
        title: 'Completed task',
        status: 'completed',
        createdAt: '2026-02-03T12:00:00Z',
        completedAt: '2026-02-03T13:00:00Z'
      },
      { 
        type: 'task', 
        id: '4', 
        title: 'Open task',
        status: 'open',
        createdAt: '2026-02-03T12:00:00Z'
      }
    ];
    
    render(<CollectionStats entries={entries} />);
    
    // Should render in order: open tasks (☐) → completed tasks (✓) → notes (📝) → events (📅)
    expect(screen.getByText('☐ 1')).toBeInTheDocument();
    expect(screen.getByText('✓ 1')).toBeInTheDocument();
    expect(screen.getByText('📝 1')).toBeInTheDocument();
    expect(screen.getByText('📅 1')).toBeInTheDocument();
  });

  it('updates when entries change', () => {
    const initialEntries: Entry[] = [
      { 
        type: 'task', 
        id: '1', 
        title: 'Task 1',
        status: 'open',
        createdAt: '2026-02-03T12:00:00Z'
      }
    ];
    
    const { rerender } = render(<CollectionStats entries={initialEntries} />);
    
    // Initially shows 1 open task
    expect(screen.getByText('☐ 1')).toBeInTheDocument();
    
    // Update entries - add a completed task
    const updatedEntries: Entry[] = [
      { 
        type: 'task', 
        id: '1', 
        title: 'Task 1',
        status: 'open',
        createdAt: '2026-02-03T12:00:00Z'
      },
      { 
        type: 'task', 
        id: '2', 
        title: 'Task 2',
        status: 'completed',
        createdAt: '2026-02-03T12:00:00Z',
        completedAt: '2026-02-03T13:00:00Z'
      }
    ];
    
    rerender(<CollectionStats entries={updatedEntries} />);
    
    // Should now show both open and completed
    expect(screen.getByText('☐ 1')).toBeInTheDocument();
    expect(screen.getByText('✓ 1')).toBeInTheDocument();
  });

  it('handles mixed entry types correctly', () => {
    const entries: Entry[] = [
      { 
        type: 'task', 
        id: '1', 
        title: 'Open task',
        status: 'open',
        createdAt: '2026-02-03T12:00:00Z'
      },
      { 
        type: 'task', 
        id: '2', 
        title: 'Open task 2',
        status: 'open',
        createdAt: '2026-02-03T12:00:00Z'
      },
      { 
        type: 'task', 
        id: '3', 
        title: 'Completed task',
        status: 'completed',
        createdAt: '2026-02-03T12:00:00Z',
        completedAt: '2026-02-03T13:00:00Z'
      },
      { 
        type: 'note', 
        id: '4', 
        content: 'Note 1',
        createdAt: '2026-02-03T12:00:00Z'
      },
      { 
        type: 'note', 
        id: '5', 
        content: 'Note 2',
        createdAt: '2026-02-03T12:00:00Z'
      },
      { 
        type: 'note', 
        id: '6', 
        content: 'Note 3',
        createdAt: '2026-02-03T12:00:00Z'
      }
    ];
    
    render(<CollectionStats entries={entries} />);
    
    // Should show: "☐ 2", "✓ 1", "📝 3"
    expect(screen.getByText('☐ 2')).toBeInTheDocument();
    expect(screen.getByText('✓ 1')).toBeInTheDocument();
    expect(screen.getByText('📝 3')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const entries: Entry[] = [
      { 
        type: 'task', 
        id: '1', 
        title: 'Test task',
        status: 'open',
        createdAt: '2026-02-03T12:00:00Z'
      }
    ];
    
    const { container } = render(<CollectionStats entries={entries} className="custom-class" />);
    
    const statsElement = container.firstChild as HTMLElement;
    expect(statsElement).toHaveClass('custom-class');
  });

  it('has correct default styling classes', () => {
    const entries: Entry[] = [
      { 
        type: 'task', 
        id: '1', 
        title: 'Test task',
        status: 'open',
        createdAt: '2026-02-03T12:00:00Z'
      }
    ];
    
    const { container } = render(<CollectionStats entries={entries} />);
    
    const statsElement = container.firstChild as HTMLElement;
    
    // Should have the design spec styling (pl-8 removed, now uses dynamic paddingLeft)
    expect(statsElement).toHaveClass('text-base');
    expect(statsElement).toHaveClass('text-gray-500');
    expect(statsElement).toHaveClass('dark:text-gray-400');
  });

  describe('Migrated Entries', () => {
    it('should exclude migrated open tasks from stats', () => {
      const entries: Entry[] = [
        { 
          type: 'task', 
          id: '1', 
          title: 'Normal task',
          status: 'open',
          createdAt: '2026-02-03T12:00:00Z'
        },
        { 
          type: 'task', 
          id: '2', 
          title: 'Migrated task',
          status: 'open',
          createdAt: '2026-02-03T12:00:00Z',
          migratedTo: 'new-task-id'
        }
      ];
      
      render(<CollectionStats entries={entries} />);
      
      // Should only show 1 open task (the non-migrated one)
      expect(screen.getByText(/☐ 1/)).toBeInTheDocument();
      expect(screen.queryByText(/☐ 2/)).not.toBeInTheDocument();
    });

    it('should exclude migrated completed tasks from stats', () => {
      const entries: Entry[] = [
        { 
          type: 'task', 
          id: '1', 
          title: 'Normal completed task',
          status: 'completed',
          createdAt: '2026-02-03T12:00:00Z',
          completedAt: '2026-02-03T13:00:00Z'
        },
        { 
          type: 'task', 
          id: '2', 
          title: 'Migrated completed task',
          status: 'completed',
          createdAt: '2026-02-03T12:00:00Z',
          completedAt: '2026-02-03T13:00:00Z',
          migratedTo: 'new-task-id'
        }
      ];
      
      render(<CollectionStats entries={entries} />);
      
      // Should only show 1 completed task
      expect(screen.getByText(/✓ 1/)).toBeInTheDocument();
      expect(screen.queryByText(/✓ 2/)).not.toBeInTheDocument();
    });

    it('should exclude migrated notes from stats', () => {
      const entries: Entry[] = [
        { 
          type: 'note', 
          id: '1', 
          content: 'Normal note',
          createdAt: '2026-02-03T12:00:00Z'
        },
        { 
          type: 'note', 
          id: '2', 
          content: 'Migrated note',
          createdAt: '2026-02-03T12:00:00Z',
          migratedTo: 'new-note-id'
        }
      ];
      
      render(<CollectionStats entries={entries} />);
      
      // Should only show 1 note
      expect(screen.getByText(/📝 1/)).toBeInTheDocument();
      expect(screen.queryByText(/📝 2/)).not.toBeInTheDocument();
    });

    it('should exclude migrated events from stats', () => {
      const entries: Entry[] = [
        { 
          type: 'event', 
          id: '1', 
          content: 'Normal event',
          createdAt: '2026-02-03T12:00:00Z'
        },
        { 
          type: 'event', 
          id: '2', 
          content: 'Migrated event',
          createdAt: '2026-02-03T12:00:00Z',
          migratedTo: 'new-event-id'
        }
      ];
      
      render(<CollectionStats entries={entries} />);
      
      // Should only show 1 event
      expect(screen.getByText(/📅 1/)).toBeInTheDocument();
      expect(screen.queryByText(/📅 2/)).not.toBeInTheDocument();
    });

    it('should return null when all entries are migrated', () => {
      const entries: Entry[] = [
        { 
          type: 'task', 
          id: '1', 
          title: 'Migrated task',
          status: 'open',
          createdAt: '2026-02-03T12:00:00Z',
          migratedTo: 'new-task-id'
        },
        { 
          type: 'note', 
          id: '2', 
          content: 'Migrated note',
          createdAt: '2026-02-03T12:00:00Z',
          migratedTo: 'new-note-id'
        }
      ];
      
      const { container } = render(<CollectionStats entries={entries} />);
      
      // Component should render nothing
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Accessibility', () => {
    it('provides accessible labels for screen readers', () => {
      const entries: Entry[] = [
        { type: 'task', id: '1', title: 'Task', status: 'open', createdAt: '2026-02-03T12:00:00Z' },
        { type: 'note', id: '2', content: 'Note', createdAt: '2026-02-03T12:00:00Z' },
      ];
      
      const { container } = render(<CollectionStats entries={entries} />);
      
      expect(container.querySelector('[aria-label="1 open task"]')).toBeInTheDocument();
      expect(container.querySelector('[aria-label="1 note"]')).toBeInTheDocument();
    });

    it('uses singular form for count of 1', () => {
      const entries: Entry[] = [
        { type: 'task', id: '1', title: 'Task', status: 'open', createdAt: '2026-02-03T12:00:00Z' },
      ];
      
      const { container } = render(<CollectionStats entries={entries} />);
      
      expect(container.querySelector('[aria-label="1 open task"]')).toBeInTheDocument();
    });

    it('uses plural form for count > 1', () => {
      const entries: Entry[] = [
        { type: 'note', id: '1', content: 'Note 1', createdAt: '2026-02-03T12:00:00Z' },
        { type: 'note', id: '2', content: 'Note 2', createdAt: '2026-02-03T12:00:00Z' },
      ];
      
      const { container } = render(<CollectionStats entries={entries} />);
      
      expect(container.querySelector('[aria-label="2 notes"]')).toBeInTheDocument();
    });

    it('uses correct singular/plural forms for all entry types', () => {
      const singleEntries: Entry[] = [
        { type: 'task', id: '1', title: 'Task', status: 'open', createdAt: '2026-02-03T12:00:00Z' },
        { type: 'task', id: '2', title: 'Completed', status: 'completed', createdAt: '2026-02-03T12:00:00Z', completedAt: '2026-02-03T13:00:00Z' },
        { type: 'note', id: '3', content: 'Note', createdAt: '2026-02-03T12:00:00Z' },
        { type: 'event', id: '4', content: 'Event', createdAt: '2026-02-03T12:00:00Z' },
      ];
      
      const { container: singleContainer } = render(<CollectionStats entries={singleEntries} />);
      
      expect(singleContainer.querySelector('[aria-label="1 open task"]')).toBeInTheDocument();
      expect(singleContainer.querySelector('[aria-label="1 completed task"]')).toBeInTheDocument();
      expect(singleContainer.querySelector('[aria-label="1 note"]')).toBeInTheDocument();
      expect(singleContainer.querySelector('[aria-label="1 event"]')).toBeInTheDocument();
      
      const multipleEntries: Entry[] = [
        { type: 'task', id: '1', title: 'Task 1', status: 'open', createdAt: '2026-02-03T12:00:00Z' },
        { type: 'task', id: '2', title: 'Task 2', status: 'open', createdAt: '2026-02-03T12:00:00Z' },
        { type: 'task', id: '3', title: 'Completed 1', status: 'completed', createdAt: '2026-02-03T12:00:00Z', completedAt: '2026-02-03T13:00:00Z' },
        { type: 'task', id: '4', title: 'Completed 2', status: 'completed', createdAt: '2026-02-03T12:00:00Z', completedAt: '2026-02-03T13:00:00Z' },
        { type: 'note', id: '5', content: 'Note 1', createdAt: '2026-02-03T12:00:00Z' },
        { type: 'note', id: '6', content: 'Note 2', createdAt: '2026-02-03T12:00:00Z' },
        { type: 'event', id: '7', content: 'Event 1', createdAt: '2026-02-03T12:00:00Z' },
        { type: 'event', id: '8', content: 'Event 2', createdAt: '2026-02-03T12:00:00Z' },
      ];
      
      const { container: multipleContainer } = render(<CollectionStats entries={multipleEntries} />);
      
      expect(multipleContainer.querySelector('[aria-label="2 open tasks"]')).toBeInTheDocument();
      expect(multipleContainer.querySelector('[aria-label="2 completed tasks"]')).toBeInTheDocument();
      expect(multipleContainer.querySelector('[aria-label="2 notes"]')).toBeInTheDocument();
      expect(multipleContainer.querySelector('[aria-label="2 events"]')).toBeInTheDocument();
    });
  });
});
