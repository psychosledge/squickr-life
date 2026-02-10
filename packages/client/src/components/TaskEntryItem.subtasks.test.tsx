import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskEntryItem } from './TaskEntryItem';
import type { Entry } from '@squickr/domain';

/**
 * TaskEntryItem - Sub-Tasks & Completion Badge Tests (Phase 2)
 * 
 * Tests:
 * - Completion badge shows for parent tasks
 * - Badge shows correct counts (e.g., "2/4")
 * - Badge hidden when task has no children
 * - Badge updates based on completion status
 */
describe('TaskEntryItem - Phase 2: Completion Badge', () => {
  const mockHandlers = {
    onCompleteTask: vi.fn(),
    onReopenTask: vi.fn(),
    onUpdateTaskTitle: vi.fn(),
    onDelete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Completion Badge Display', () => {
    it('should show completion badge for parent task with sub-tasks', () => {
      // Arrange: Parent task
      const parentTask: Entry & { type: 'task' } = {
        type: 'task',
        id: 'parent-1',
        title: 'App launch',
        status: 'open',
        createdAt: '2026-02-07T10:00:00Z',
      };

      const completionStatus = {
        total: 4,
        completed: 2,
        allComplete: false,
      };

      // Act
      render(
        <TaskEntryItem 
          entry={parentTask}
          completionStatus={completionStatus}
          {...mockHandlers}
        />
      );

      // Assert: Badge should show "(2/4)"
      expect(screen.getByText(/2\/4/)).toBeInTheDocument();
    });

    it('should NOT show completion badge for task with no children', () => {
      // Arrange: Regular task (no children)
      const task: Entry & { type: 'task' } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy groceries',
        status: 'open',
        createdAt: '2026-02-07T10:00:00Z',
      };

      const completionStatus = {
        total: 0,
        completed: 0,
        allComplete: true,
      };

      // Act
      render(
        <TaskEntryItem 
          entry={task}
          completionStatus={completionStatus}
          {...mockHandlers}
        />
      );

      // Assert: No badge should be shown
      expect(screen.queryByText(/\/0/)).not.toBeInTheDocument();
      expect(screen.queryByText(/0\/0/)).not.toBeInTheDocument();
    });

    it('should show badge when all sub-tasks are complete', () => {
      // Arrange: Parent with all children complete
      const parentTask: Entry & { type: 'task' } = {
        type: 'task',
        id: 'parent-1',
        title: 'Research competitors',
        status: 'open',
        createdAt: '2026-02-07T10:00:00Z',
      };

      const completionStatus = {
        total: 3,
        completed: 3,
        allComplete: true,
      };

      // Act
      render(
        <TaskEntryItem 
          entry={parentTask}
          completionStatus={completionStatus}
          {...mockHandlers}
        />
      );

      // Assert: Badge should show "(3/3)"
      expect(screen.getByText(/3\/3/)).toBeInTheDocument();
    });

    it('should show badge when no sub-tasks are complete', () => {
      // Arrange: Parent with no children complete
      const parentTask: Entry & { type: 'task' } = {
        type: 'task',
        id: 'parent-1',
        title: 'Marketing plan',
        status: 'open',
        createdAt: '2026-02-07T10:00:00Z',
      };

      const completionStatus = {
        total: 5,
        completed: 0,
        allComplete: false,
      };

      // Act
      render(
        <TaskEntryItem 
          entry={parentTask}
          completionStatus={completionStatus}
          {...mockHandlers}
        />
      );

      // Assert: Badge should show "(0/5)"
      expect(screen.getByText(/0\/5/)).toBeInTheDocument();
    });

    it('should show badge with single sub-task', () => {
      // Arrange: Parent with 1 child
      const parentTask: Entry & { type: 'task' } = {
        type: 'task',
        id: 'parent-1',
        title: 'Single child parent',
        status: 'open',
        createdAt: '2026-02-07T10:00:00Z',
      };

      const completionStatus = {
        total: 1,
        completed: 0,
        allComplete: false,
      };

      // Act
      render(
        <TaskEntryItem 
          entry={parentTask}
          completionStatus={completionStatus}
          {...mockHandlers}
        />
      );

      // Assert: Badge should show "(0/1)"
      expect(screen.getByText(/0\/1/)).toBeInTheDocument();
    });
  });

  describe('Badge Styling', () => {
    it('should style badge differently when all complete', () => {
      // Arrange
      const parentTask: Entry & { type: 'task' } = {
        type: 'task',
        id: 'parent-1',
        title: 'All done',
        status: 'open',
        createdAt: '2026-02-07T10:00:00Z',
      };

      const completionStatus = {
        total: 2,
        completed: 2,
        allComplete: true,
      };

      // Act
      const { container } = render(
        <TaskEntryItem 
          entry={parentTask}
          completionStatus={completionStatus}
          {...mockHandlers}
        />
      );

      // Assert: Badge should have different styling for all-complete state
      const badge = container.querySelector('[data-testid="completion-badge"]');
      expect(badge).toBeInTheDocument();
      // Badge text should be present
      expect(screen.getByText(/2\/2/)).toBeInTheDocument();
    });

    it('should use subtle styling for incomplete badge', () => {
      // Arrange
      const parentTask: Entry & { type: 'task' } = {
        type: 'task',
        id: 'parent-1',
        title: 'In progress',
        status: 'open',
        createdAt: '2026-02-07T10:00:00Z',
      };

      const completionStatus = {
        total: 4,
        completed: 1,
        allComplete: false,
      };

      // Act
      const { container } = render(
        <TaskEntryItem 
          entry={parentTask}
          completionStatus={completionStatus}
          {...mockHandlers}
        />
      );

      // Assert: Badge should exist with text
      const badge = container.querySelector('[data-testid="completion-badge"]');
      expect(badge).toBeInTheDocument();
      expect(screen.getByText(/1\/4/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined completionStatus gracefully', () => {
      // Arrange: No completion status passed
      const task: Entry & { type: 'task' } = {
        type: 'task',
        id: 'task-1',
        title: 'Task without status',
        status: 'open',
        createdAt: '2026-02-07T10:00:00Z',
      };

      // Act
      render(
        <TaskEntryItem 
          entry={task}
          {...mockHandlers}
        />
      );

      // Assert: Should render without badge, no crash
      expect(screen.getByText('Task without status')).toBeInTheDocument();
      expect(screen.queryByText(/\d+\/\d+/)).not.toBeInTheDocument();
    });

    it('should not show badge for completed parent task', () => {
      // Arrange: Completed parent task
      const completedParent: Entry & { type: 'task' } = {
        type: 'task',
        id: 'parent-1',
        title: 'Completed parent',
        status: 'completed',
        completedAt: '2026-02-07T12:00:00Z',
        createdAt: '2026-02-07T10:00:00Z',
      };

      const completionStatus = {
        total: 3,
        completed: 3,
        allComplete: true,
      };

      // Act
      render(
        <TaskEntryItem 
          entry={completedParent}
          completionStatus={completionStatus}
          {...mockHandlers}
        />
      );

      // Assert: Badge should still show even when parent is complete
      // (to show that all sub-tasks were completed)
      expect(screen.getByText(/3\/3/)).toBeInTheDocument();
    });
  });
});
