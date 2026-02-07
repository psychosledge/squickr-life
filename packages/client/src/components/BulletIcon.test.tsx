import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulletIcon } from './BulletIcon';
import type { Entry } from '@squickr/domain';

describe('BulletIcon', () => {
  describe('Task Bullets', () => {
    it('should render open task with bullet and interactive role', () => {
      const entry: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Test',
        status: 'open',
        createdAt: '2026-01-27T10:00:00.000Z'
      };
      
      render(<BulletIcon entry={entry} onClick={vi.fn()} />);
      
      const bullet = screen.getByRole('button', { name: /open task.*complete/i });
      expect(bullet).toHaveTextContent('☐');
      expect(bullet).toHaveAttribute('tabindex', '0');
    });

    it('should render completed task with X and interactive role', () => {
      const entry: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Test',
        status: 'completed',
        completedAt: '2026-01-27T10:00:00.000Z',
        createdAt: '2026-01-27T09:00:00.000Z'
      };
      
      render(<BulletIcon entry={entry} onClick={vi.fn()} />);
      
      const bullet = screen.getByRole('button', { name: /completed task.*reopen/i });
      expect(bullet).toHaveTextContent('✓');
    });

    it('should render migrated task with > and no button role', () => {
      const entry: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Test',
        status: 'open',
        migratedTo: 'task-2',
        createdAt: '2026-01-27T10:00:00.000Z'
      };
      
      render(<BulletIcon entry={entry} />);
      
      expect(screen.getByText('>')).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Migrated task')).toBeInTheDocument();
    });

    it('should prioritize migration over completion status', () => {
      const entry: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Test',
        status: 'completed',
        completedAt: '2026-01-27T10:00:00.000Z',
        migratedTo: 'task-2',
        createdAt: '2026-01-27T09:00:00.000Z'
      };
      
      render(<BulletIcon entry={entry} />);
      
      // Should show migration icon, not completion
      expect(screen.getByText('>')).toBeInTheDocument();
      expect(screen.queryByText('✓')).not.toBeInTheDocument();
    });
  });

  describe('Note Bullets', () => {
    it('should render note with dash and no button role', () => {
      const entry: Entry = {
        type: 'note',
        id: 'note-1',
        content: 'Test note',
        createdAt: '2026-01-27T10:00:00.000Z'
      };
      
      render(<BulletIcon entry={entry} />);
      
      expect(screen.getByText('📝')).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Note')).toBeInTheDocument();
    });

    it('should render migrated note with >', () => {
      const entry: Entry = {
        type: 'note',
        id: 'note-1',
        content: 'Test',
        migratedTo: 'note-2',
        createdAt: '2026-01-27T10:00:00.000Z'
      };
      
      render(<BulletIcon entry={entry} />);
      
      expect(screen.getByText('>')).toBeInTheDocument();
      expect(screen.getByLabelText('Migrated note')).toBeInTheDocument();
    });
  });

  describe('Event Bullets', () => {
    it('should render event with circle and no button role', () => {
      const entry: Entry = {
        type: 'event',
        id: 'event-1',
        content: 'Test event',
        createdAt: '2026-01-27T10:00:00.000Z'
      };
      
      render(<BulletIcon entry={entry} />);
      
      expect(screen.getByText('📅')).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Event')).toBeInTheDocument();
    });

    it('should render migrated event with >', () => {
      const entry: Entry = {
        type: 'event',
        id: 'event-1',
        content: 'Test',
        migratedTo: 'event-2',
        createdAt: '2026-01-27T10:00:00.000Z'
      };
      
      render(<BulletIcon entry={entry} />);
      
      expect(screen.getByText('>')).toBeInTheDocument();
      expect(screen.getByLabelText('Migrated event')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should call onClick when Enter key pressed on interactive bullet', () => {
      const onClick = vi.fn();
      const entry: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Test',
        status: 'open',
        createdAt: '2026-01-27T10:00:00.000Z'
      };
      
      render(<BulletIcon entry={entry} onClick={onClick} />);
      
      const bullet = screen.getByRole('button');
      fireEvent.keyDown(bullet, { key: 'Enter' });
      
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should call onClick when Space key pressed on interactive bullet', () => {
      const onClick = vi.fn();
      const entry: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Test',
        status: 'open',
        createdAt: '2026-01-27T10:00:00.000Z'
      };
      
      render(<BulletIcon entry={entry} onClick={onClick} />);
      
      const bullet = screen.getByRole('button');
      fireEvent.keyDown(bullet, { key: ' ' });
      
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick on non-interactive bullet', () => {
      const onClick = vi.fn();
      const entry: Entry = {
        type: 'note',
        id: 'note-1',
        content: 'Test',
        createdAt: '2026-01-27T10:00:00.000Z'
      };
      
      render(<BulletIcon entry={entry} onClick={onClick} />);
      
      const bullet = screen.getByText('📝');
      fireEvent.keyDown(bullet, { key: 'Enter' });
      
      expect(onClick).not.toHaveBeenCalled();
    });

    it('should not respond to other keys', () => {
      const onClick = vi.fn();
      const entry: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Test',
        status: 'open',
        createdAt: '2026-01-27T10:00:00.000Z'
      };
      
      render(<BulletIcon entry={entry} onClick={onClick} />);
      
      const bullet = screen.getByRole('button');
      fireEvent.keyDown(bullet, { key: 'a' });
      fireEvent.keyDown(bullet, { key: 'Tab' });
      
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('Click Handling', () => {
    it('should call onClick when interactive bullet is clicked', () => {
      const onClick = vi.fn();
      const entry: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Test',
        status: 'open',
        createdAt: '2026-01-27T10:00:00.000Z'
      };
      
      render(<BulletIcon entry={entry} onClick={onClick} />);
      
      const bullet = screen.getByRole('button');
      fireEvent.click(bullet);
      
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick if not provided', () => {
      const entry: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Test',
        status: 'open',
        createdAt: '2026-01-27T10:00:00.000Z'
      };
      
      // Should not throw error when clicking without onClick handler
      const { container } = render(<BulletIcon entry={entry} />);
      const bullet = container.querySelector('span');
      
      expect(() => {
        fireEvent.click(bullet!);
      }).not.toThrow();
    });

    it('should not be clickable for migrated entries', () => {
      const onClick = vi.fn();
      const entry: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Test',
        status: 'open',
        migratedTo: 'task-2',
        createdAt: '2026-01-27T10:00:00.000Z'
      };
      
      render(<BulletIcon entry={entry} onClick={onClick} />);
      
      const bullet = screen.getByText('>');
      fireEvent.click(bullet);
      
      // Should not call onClick for migrated entries
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have correct tabindex for interactive bullets', () => {
      const entry: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Test',
        status: 'open',
        createdAt: '2026-01-27T10:00:00.000Z'
      };
      
      render(<BulletIcon entry={entry} onClick={vi.fn()} />);
      
      const bullet = screen.getByRole('button');
      expect(bullet).toHaveAttribute('tabindex', '0');
    });

    it('should not have tabindex for non-interactive bullets', () => {
      const entry: Entry = {
        type: 'note',
        id: 'note-1',
        content: 'Test',
        createdAt: '2026-01-27T10:00:00.000Z'
      };
      
      render(<BulletIcon entry={entry} />);
      
      const bullet = screen.getByText('📝');
      expect(bullet).not.toHaveAttribute('tabindex');
    });

    it('should have cursor pointer for interactive bullets', () => {
      const entry: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Test',
        status: 'open',
        createdAt: '2026-01-27T10:00:00.000Z'
      };
      
      render(<BulletIcon entry={entry} onClick={vi.fn()} />);
      
      const bullet = screen.getByRole('button');
      expect(bullet).toHaveClass('cursor-pointer');
    });

    it('should have default cursor for non-interactive bullets', () => {
      const entry: Entry = {
        type: 'note',
        id: 'note-1',
        content: 'Test',
        createdAt: '2026-01-27T10:00:00.000Z'
      };
      
      render(<BulletIcon entry={entry} />);
      
      const bullet = screen.getByText('📝');
      expect(bullet).toHaveClass('cursor-default');
    });
  });
});
