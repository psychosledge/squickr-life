import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskEntryItem } from './TaskEntryItem';
import type { Entry } from '@squickr/domain';

describe('TaskEntryItem', () => {
  const mockOnCompleteTask = vi.fn();
  const mockOnReopenTask = vi.fn();
  const mockOnUpdateTaskTitle = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockOpenTask: Entry & { type: 'task' } = {
    type: 'task',
    id: 'task-1',
    title: 'Buy milk',
    createdAt: '2026-01-24T10:00:00.000Z',
    status: 'open',
  };

  const mockCompletedTask: Entry & { type: 'task' } = {
    type: 'task',
    id: 'task-2',
    title: 'Write tests',
    createdAt: '2026-01-24T10:00:00.000Z',
    status: 'completed',
    completedAt: '2026-01-24T10:30:00.000Z',
  };

  it('should render task with bullet icon', () => {
    render(
      <TaskEntryItem 
        entry={mockOpenTask} 
        onDelete={mockOnDelete}
      />
    );
    
    expect(screen.getByText('☐')).toBeInTheDocument();
    expect(screen.getByText('Buy milk')).toBeInTheDocument();
  });

  it('should render completed task with X bullet', () => {
    render(
      <TaskEntryItem 
        entry={mockCompletedTask} 
        onDelete={mockOnDelete}
      />
    );
    
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('should show bullet for open tasks', () => {
    render(
      <TaskEntryItem 
        entry={mockOpenTask} 
        onCompleteTask={mockOnCompleteTask}
        onDelete={mockOnDelete}
      />
    );
    
    const bullet = screen.getByRole('button', { name: /open task.*complete/i });
    expect(bullet).toBeInTheDocument();
    expect(bullet).toHaveTextContent('☐');
  });

  it('should show X bullet for completed tasks', () => {
    render(
      <TaskEntryItem 
        entry={mockCompletedTask} 
        onReopenTask={mockOnReopenTask}
        onDelete={mockOnDelete}
      />
    );
    
    const bullet = screen.getByRole('button', { name: /completed task.*reopen/i });
    expect(bullet).toBeInTheDocument();
    expect(bullet).toHaveTextContent('✓');
  });

  it('should call onCompleteTask when bullet is clicked for open task', () => {
    render(
      <TaskEntryItem 
        entry={mockOpenTask} 
        onCompleteTask={mockOnCompleteTask}
        onDelete={mockOnDelete}
      />
    );
    
    const bullet = screen.getByRole('button', { name: /open task.*complete/i });
    fireEvent.click(bullet);

    expect(mockOnCompleteTask).toHaveBeenCalledWith('task-1');
  });

  it('should call onReopenTask when bullet is clicked for completed task', () => {
    render(
      <TaskEntryItem 
        entry={mockCompletedTask} 
        onReopenTask={mockOnReopenTask}
        onDelete={mockOnDelete}
      />
    );
    
    const bullet = screen.getByRole('button', { name: /completed task.*reopen/i });
    fireEvent.click(bullet);

    expect(mockOnReopenTask).toHaveBeenCalledWith('task-2');
  });

  it('should apply strikethrough to completed task', () => {
    render(
      <TaskEntryItem 
        entry={mockCompletedTask} 
        onDelete={mockOnDelete}
      />
    );
    
    const title = screen.getByText('Write tests');
    expect(title).toHaveClass('line-through');
  });

  it('should show completion timestamp for completed tasks', () => {
    render(
      <TaskEntryItem 
        entry={mockCompletedTask} 
        onDelete={mockOnDelete}
      />
    );
    
    expect(screen.getByText(/• Completed/i)).toBeInTheDocument();
  });

  it('should call onDelete when Delete is clicked from menu', () => {
    render(
      <TaskEntryItem 
        entry={mockOpenTask} 
        onDelete={mockOnDelete}
      />
    );
    
    // Open the actions menu
    const menuButton = screen.getByRole('button', { name: /entry actions/i });
    fireEvent.click(menuButton);

    // Click Delete from the menu
    const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
    fireEvent.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledWith('task-1');
  });

  it('should enter edit mode on double-click when update handler provided', () => {
      render(
        <TaskEntryItem 
          entry={mockOpenTask}
          onDelete={mockOnDelete}
          onUpdateTaskTitle={mockOnUpdateTaskTitle}
        />
      );
    
    const title = screen.getByText('Buy milk');
    fireEvent.doubleClick(title);
    
    const input = screen.getByDisplayValue('Buy milk');
    expect(input).toBeInTheDocument();
  });

  it('should not enter edit mode if no update handler is provided', () => {
    render(
      <TaskEntryItem 
        entry={mockOpenTask} 
        onDelete={mockOnDelete}
      />
    );
    
    const title = screen.getByText('Buy milk');
    fireEvent.doubleClick(title);
    
    expect(screen.queryByDisplayValue('Buy milk')).not.toBeInTheDocument();
  });

  it('should format timestamp as relative time', () => {
    const recentTask: Entry & { type: 'task' } = {
      type: 'task',
      id: 'task-1',
      title: 'Recent task',
      createdAt: new Date().toISOString(),
      status: 'open',
    };

    render(
      <TaskEntryItem 
        entry={recentTask} 
        onDelete={mockOnDelete}
      />
    );
    
    expect(screen.getByText(/just now|seconds ago/i)).toBeInTheDocument();
  });

  it('should not display status badge', () => {
    render(
      <TaskEntryItem 
        entry={mockOpenTask} 
        onDelete={mockOnDelete}
      />
    );
    
    // Task should use bullet icon (☐) not a status badge
    expect(screen.getByText('☐')).toBeInTheDocument();
    
    // Should not have a separate status badge element
    expect(screen.queryByText('Open')).not.toBeInTheDocument();
    expect(screen.queryByText('Completed')).not.toBeInTheDocument();
  });

  describe('Issue #5: Link Icon Positioning', () => {
    it('should show Link2 icon after task title for migrated sub-task', () => {
      const migratedSubTask: Entry & { type: 'task' } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy groceries',
        status: 'open',
        parentTaskId: 'parent-1',
        createdAt: '2026-01-27T10:00:00.000Z',
        collectionId: 'col-other',
        collections: ['col-other'], // Sub-task is in different collection
      };

      render(
        <TaskEntryItem 
          entry={migratedSubTask}
          onDelete={mockOnDelete}
          currentCollectionId="col-parent" // Parent is in this collection
        />
      );
      
      // Should have Link2 icon with proper attributes
      const linkIcon = screen.getByLabelText('Linked to different collection');
      expect(linkIcon).toBeInTheDocument();
      
      // Check that wrapper span has title attribute
      const wrapper = linkIcon.parentElement;
      expect(wrapper).toHaveAttribute('title', 'This sub-task is in a different collection than its parent');
    });

    it('should NOT show Link2 icon for non-migrated sub-task', () => {
      const regularSubTask: Entry & { type: 'task' } = {
        type: 'task',
        id: 'task-1',
        title: 'Regular sub-task',
        status: 'open',
        parentTaskId: 'parent-1',
        createdAt: '2026-01-27T10:00:00.000Z',
        collectionId: 'col-parent',
        collections: ['col-parent'], // Sub-task is in same collection as parent
      };

      render(
        <TaskEntryItem 
          entry={regularSubTask}
          onDelete={mockOnDelete}
          currentCollectionId="col-parent" // Same collection = not migrated
        />
      );
      
      expect(screen.queryByLabelText('Linked to different collection')).not.toBeInTheDocument();
    });

    it('should NOT show Link2 icon for regular task (no parent)', () => {
      const regularTask: Entry & { type: 'task' } = {
        type: 'task',
        id: 'task-1',
        title: 'Regular task',
        status: 'open',
        createdAt: '2026-01-27T10:00:00.000Z',
        collections: [],
      };
      
      render(
        <TaskEntryItem 
          entry={regularTask}
          onDelete={mockOnDelete}
        />
      );
      
      expect(screen.queryByLabelText('Linked to different collection')).not.toBeInTheDocument();
    });

    it('should show Link2 icon BEFORE parent title reference', () => {
      const migratedSubTask: Entry & { type: 'task' } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy groceries',
        status: 'open',
        parentTaskId: 'parent-1',
        createdAt: '2026-01-27T10:00:00.000Z',
        collectionId: 'col-other',
        collections: ['col-other'], // Sub-task is in different collection
      };

      const { container } = render(
        <TaskEntryItem 
          entry={migratedSubTask}
          onDelete={mockOnDelete}
          parentTitle="Shopping List"
          currentCollectionId="col-parent" // Parent is in this collection
        />
      );
      
      // Find the title div
      const titleDiv = screen.getByText('Buy groceries').parentElement;
      expect(titleDiv).toBeInTheDocument();
      
      // Check that link icon exists
      const linkIcon = screen.getByLabelText('Linked to different collection');
      expect(linkIcon).toBeInTheDocument();
      
      // Check that parent title exists
      const parentTitle = screen.getByText(/\(Shopping List\)/);
      expect(parentTitle).toBeInTheDocument();
      
      // Verify order in DOM: title text, then link icon, then parent title
      const innerHTML = titleDiv?.innerHTML || '';
      const titleIndex = innerHTML.indexOf('Buy groceries');
      const linkIndex = innerHTML.indexOf('svg'); // Link2 renders as svg
      const parentIndex = innerHTML.indexOf('(Shopping List)');
      
      expect(titleIndex).toBeLessThan(linkIndex);
      expect(linkIndex).toBeLessThan(parentIndex);
    });

    it('should show Link2 icon for completed migrated sub-task', () => {
      const completedMigratedSubTask: Entry & { type: 'task' } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy groceries',
        status: 'completed',
        completedAt: '2026-01-27T11:00:00.000Z',
        parentTaskId: 'parent-1',
        createdAt: '2026-01-27T10:00:00.000Z',
        collectionId: 'col-other',
        collections: ['col-other'], // Sub-task is in different collection
      };

      render(
        <TaskEntryItem 
          entry={completedMigratedSubTask}
          onDelete={mockOnDelete}
          currentCollectionId="col-parent" // Parent is in this collection
        />
      );
      
      const linkIcon = screen.getByLabelText('Linked to different collection');
      expect(linkIcon).toBeInTheDocument();
    });

    it('should apply correct CSS classes to Link2 icon', () => {
      const migratedSubTask: Entry & { type: 'task' } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy groceries',
        status: 'open',
        parentTaskId: 'parent-1',
        createdAt: '2026-01-27T10:00:00.000Z',
        collectionId: 'col-other',
        collections: ['col-other'], // Sub-task is in different collection
      };

      render(
        <TaskEntryItem 
          entry={migratedSubTask}
          onDelete={mockOnDelete}
          currentCollectionId="col-parent" // Parent is in this collection
        />
      );
      
      const linkIcon = screen.getByLabelText('Linked to different collection');
      
      // Check SVG has required classes
      expect(linkIcon).toHaveClass('w-4');
      expect(linkIcon).toHaveClass('h-4');
      expect(linkIcon).toHaveClass('align-text-bottom');
      // Blue color for light mode
      expect(linkIcon).toHaveClass('text-blue-600');
      // Blue color for dark mode
      expect(linkIcon).toHaveClass('dark:text-blue-400');
      
      // Check wrapper span has inline-block and margin classes
      const wrapper = linkIcon.parentElement;
      expect(wrapper).toHaveClass('inline-block');
      expect(wrapper).toHaveClass('ml-1.5');
    });
  });
});
