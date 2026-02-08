/**
 * TaskEntryItem Collapse/Expand Tests
 * 
 * Tests for Phase 4: Expand/Collapse sub-tasks functionality
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskEntryItem } from './TaskEntryItem';
import type { Entry } from '@squickr/domain';

describe('TaskEntryItem - Collapse/Expand', () => {
  const mockEntry: Entry & { type: 'task' } = {
    id: 'task-1',
    type: 'task',
    title: 'Parent Task with Sub-tasks',
    createdAt: '2024-01-01T12:00:00Z',
    status: 'open',
  };

  const mockCompletionStatus = {
    total: 3,
    completed: 1,
    allComplete: false,
  };

  describe('Chevron Button Visibility', () => {
    it('should show chevron button when task has sub-tasks', () => {
      render(
        <TaskEntryItem
          entry={mockEntry}
          onDelete={vi.fn()}
          completionStatus={mockCompletionStatus}
          isCollapsed={false}
          onToggleCollapse={vi.fn()}
        />
      );

      // Chevron button should be visible
      const chevronButton = screen.getByRole('button', { name: /collapse sub-tasks/i });
      expect(chevronButton).toBeInTheDocument();
    });

    it('should NOT show chevron button when task has no sub-tasks', () => {
      render(
        <TaskEntryItem
          entry={mockEntry}
          onDelete={vi.fn()}
          // No completionStatus = no sub-tasks
        />
      );

      // Chevron button should NOT be visible
      const chevronButton = screen.queryByRole('button', { name: /collapse sub-tasks/i });
      expect(chevronButton).not.toBeInTheDocument();
    });

    it('should NOT show chevron button when completionStatus total is 0', () => {
      render(
        <TaskEntryItem
          entry={mockEntry}
          onDelete={vi.fn()}
          completionStatus={{ total: 0, completed: 0, allComplete: false }}
        />
      );

      // Chevron button should NOT be visible
      const chevronButton = screen.queryByRole('button', { name: /collapse sub-tasks/i });
      expect(chevronButton).not.toBeInTheDocument();
    });

    it('should NOT show chevron button when onToggleCollapse is not provided', () => {
      render(
        <TaskEntryItem
          entry={mockEntry}
          onDelete={vi.fn()}
          completionStatus={mockCompletionStatus}
          isCollapsed={false}
          // No onToggleCollapse prop
        />
      );

      // Chevron button should NOT be visible
      const chevronButton = screen.queryByRole('button', { name: /collapse sub-tasks/i });
      expect(chevronButton).not.toBeInTheDocument();
    });
  });

  describe('Chevron Icon Direction', () => {
    it('should show down chevron when expanded (isCollapsed=false)', () => {
      render(
        <TaskEntryItem
          entry={mockEntry}
          onDelete={vi.fn()}
          completionStatus={mockCompletionStatus}
          isCollapsed={false}
          onToggleCollapse={vi.fn()}
        />
      );

      const chevronButton = screen.getByRole('button', { name: /collapse sub-tasks/i });
      expect(chevronButton).toBeInTheDocument();
      expect(chevronButton).toHaveAttribute('aria-label', 'Collapse sub-tasks');
      expect(chevronButton).toHaveAttribute('title', 'Collapse sub-tasks');
    });

    it('should show right chevron when collapsed (isCollapsed=true)', () => {
      render(
        <TaskEntryItem
          entry={mockEntry}
          onDelete={vi.fn()}
          completionStatus={mockCompletionStatus}
          isCollapsed={true}
          onToggleCollapse={vi.fn()}
        />
      );

      const chevronButton = screen.getByRole('button', { name: /expand sub-tasks/i });
      expect(chevronButton).toBeInTheDocument();
      expect(chevronButton).toHaveAttribute('aria-label', 'Expand sub-tasks');
      expect(chevronButton).toHaveAttribute('title', 'Expand sub-tasks');
    });
  });

  describe('Toggle Interaction', () => {
    it('should call onToggleCollapse when chevron button is clicked', async () => {
      const user = userEvent.setup();
      const onToggleCollapse = vi.fn();

      render(
        <TaskEntryItem
          entry={mockEntry}
          onDelete={vi.fn()}
          completionStatus={mockCompletionStatus}
          isCollapsed={false}
          onToggleCollapse={onToggleCollapse}
        />
      );

      const chevronButton = screen.getByRole('button', { name: /collapse sub-tasks/i });
      await user.click(chevronButton);

      expect(onToggleCollapse).toHaveBeenCalledTimes(1);
    });

    it('should work correctly when toggling from expanded to collapsed', async () => {
      const user = userEvent.setup();
      const onToggleCollapse = vi.fn();

      const { rerender } = render(
        <TaskEntryItem
          entry={mockEntry}
          onDelete={vi.fn()}
          completionStatus={mockCompletionStatus}
          isCollapsed={false}
          onToggleCollapse={onToggleCollapse}
        />
      );

      // Initially expanded - click to collapse
      const expandedButton = screen.getByRole('button', { name: /collapse sub-tasks/i });
      await user.click(expandedButton);
      expect(onToggleCollapse).toHaveBeenCalledTimes(1);

      // Simulate parent updating isCollapsed prop
      rerender(
        <TaskEntryItem
          entry={mockEntry}
          onDelete={vi.fn()}
          completionStatus={mockCompletionStatus}
          isCollapsed={true}
          onToggleCollapse={onToggleCollapse}
        />
      );

      // Now collapsed - verify chevron changed
      const collapsedButton = screen.getByRole('button', { name: /expand sub-tasks/i });
      expect(collapsedButton).toBeInTheDocument();
    });

    it('should work correctly when toggling from collapsed to expanded', async () => {
      const user = userEvent.setup();
      const onToggleCollapse = vi.fn();

      const { rerender } = render(
        <TaskEntryItem
          entry={mockEntry}
          onDelete={vi.fn()}
          completionStatus={mockCompletionStatus}
          isCollapsed={true}
          onToggleCollapse={onToggleCollapse}
        />
      );

      // Initially collapsed - click to expand
      const collapsedButton = screen.getByRole('button', { name: /expand sub-tasks/i });
      await user.click(collapsedButton);
      expect(onToggleCollapse).toHaveBeenCalledTimes(1);

      // Simulate parent updating isCollapsed prop
      rerender(
        <TaskEntryItem
          entry={mockEntry}
          onDelete={vi.fn()}
          completionStatus={mockCompletionStatus}
          isCollapsed={false}
          onToggleCollapse={onToggleCollapse}
        />
      );

      // Now expanded - verify chevron changed
      const expandedButton = screen.getByRole('button', { name: /collapse sub-tasks/i });
      expect(expandedButton).toBeInTheDocument();
    });
  });

  describe('Badge Visibility', () => {
    it('should always show completion badge even when collapsed', () => {
      render(
        <TaskEntryItem
          entry={mockEntry}
          onDelete={vi.fn()}
          completionStatus={mockCompletionStatus}
          isCollapsed={true}
          onToggleCollapse={vi.fn()}
        />
      );

      // Badge should still be visible when collapsed
      const badge = screen.getByTestId('completion-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('1/3');
    });

    it('should always show completion badge when expanded', () => {
      render(
        <TaskEntryItem
          entry={mockEntry}
          onDelete={vi.fn()}
          completionStatus={mockCompletionStatus}
          isCollapsed={false}
          onToggleCollapse={vi.fn()}
        />
      );

      // Badge should be visible when expanded
      const badge = screen.getByTestId('completion-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('1/3');
    });
  });

  describe('Layout and Positioning', () => {
    it('should position chevron before the task title', () => {
      render(
        <TaskEntryItem
          entry={mockEntry}
          onDelete={vi.fn()}
          completionStatus={mockCompletionStatus}
          isCollapsed={false}
          onToggleCollapse={vi.fn()}
        />
      );

      const titleDiv = screen.getByText('Parent Task with Sub-tasks');
      const chevronButton = screen.getByRole('button', { name: /collapse sub-tasks/i });

      // Both should exist in the document
      expect(chevronButton).toBeInTheDocument();
      expect(titleDiv).toBeInTheDocument();

      // Chevron and title should be siblings (in the same parent container)
      const parent = titleDiv.parentElement;
      expect(parent).toContainElement(chevronButton);
    });
  });

  describe('Keyboard Accessibility', () => {
    it('should have focus-visible styling for keyboard navigation', () => {
      render(
        <TaskEntryItem
          entry={mockEntry}
          onDelete={vi.fn()}
          completionStatus={mockCompletionStatus}
          isCollapsed={false}
          onToggleCollapse={vi.fn()}
        />
      );

      const chevronButton = screen.getByRole('button', { name: /collapse sub-tasks/i });
      
      // Check that focus-visible styles are applied
      expect(chevronButton).toHaveClass('focus:outline-none');
      expect(chevronButton).toHaveClass('focus-visible:ring-2');
      expect(chevronButton).toHaveClass('focus-visible:ring-blue-500');
      expect(chevronButton).toHaveClass('focus-visible:ring-offset-2');
      expect(chevronButton).toHaveClass('rounded');
    });

    it('should be keyboard accessible with proper aria labels', () => {
      render(
        <TaskEntryItem
          entry={mockEntry}
          onDelete={vi.fn()}
          completionStatus={mockCompletionStatus}
          isCollapsed={false}
          onToggleCollapse={vi.fn()}
        />
      );

      const chevronButton = screen.getByRole('button', { name: /collapse sub-tasks/i });
      
      // Should be a button type
      expect(chevronButton).toHaveAttribute('type', 'button');
      
      // Should have proper aria-label
      expect(chevronButton).toHaveAttribute('aria-label', 'Collapse sub-tasks');
      
      // Should have proper title for tooltip
      expect(chevronButton).toHaveAttribute('title', 'Collapse sub-tasks');
    });

    it('should update aria labels when collapsed state changes', () => {
      const { rerender } = render(
        <TaskEntryItem
          entry={mockEntry}
          onDelete={vi.fn()}
          completionStatus={mockCompletionStatus}
          isCollapsed={false}
          onToggleCollapse={vi.fn()}
        />
      );

      let chevronButton = screen.getByRole('button', { name: /collapse sub-tasks/i });
      expect(chevronButton).toHaveAttribute('aria-label', 'Collapse sub-tasks');

      // Change to collapsed state
      rerender(
        <TaskEntryItem
          entry={mockEntry}
          onDelete={vi.fn()}
          completionStatus={mockCompletionStatus}
          isCollapsed={true}
          onToggleCollapse={vi.fn()}
        />
      );

      chevronButton = screen.getByRole('button', { name: /expand sub-tasks/i });
      expect(chevronButton).toHaveAttribute('aria-label', 'Expand sub-tasks');
      expect(chevronButton).toHaveAttribute('title', 'Expand sub-tasks');
    });
  });
});
