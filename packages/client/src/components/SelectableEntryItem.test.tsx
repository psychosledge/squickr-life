/**
 * Tests for SelectableEntryItem component
 * 
 * Tests the wrapper component that adds selection functionality to entries:
 * - Shows checkbox only in selection mode
 * - Handles selection toggle
 * - Shows selected state visually
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { SelectableEntryItem } from './SelectableEntryItem';
import type { Entry } from '@squickr/domain';

describe('SelectableEntryItem', () => {
  const mockEntry: Entry = {
    id: 'task-1',
    type: 'task',
    title: 'Test task',
    status: 'open',
    order: 'a0',
    createdAt: '2024-01-01T00:00:00Z',
  };

  it('should not render checkbox when not in selection mode', () => {
    const onToggleSelection = vi.fn();
    
    render(
      <SelectableEntryItem
        entry={mockEntry}
        isSelectionMode={false}
        isSelected={false}
        onToggleSelection={onToggleSelection}
      >
        <div>Entry Content</div>
      </SelectableEntryItem>
    );
    
    // Checkbox should not be present
    const checkboxes = screen.queryAllByRole('checkbox');
    expect(checkboxes).toHaveLength(0);
    
    // Content should be rendered
    expect(screen.getByText('Entry Content')).toBeInTheDocument();
  });

  it('should render checkbox when in selection mode', () => {
    const onToggleSelection = vi.fn();
    
    render(
      <SelectableEntryItem
        entry={mockEntry}
        isSelectionMode={true}
        isSelected={false}
        onToggleSelection={onToggleSelection}
      >
        <div>Entry Content</div>
      </SelectableEntryItem>
    );
    
    // Checkbox should be present
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it('should show checked state when selected', () => {
    const onToggleSelection = vi.fn();
    
    render(
      <SelectableEntryItem
        entry={mockEntry}
        isSelectionMode={true}
        isSelected={true}
        onToggleSelection={onToggleSelection}
      >
        <div>Entry Content</div>
      </SelectableEntryItem>
    );
    
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('should call onToggleSelection when checkbox is clicked', async () => {
    const user = userEvent.setup();
    const onToggleSelection = vi.fn();
    
    render(
      <SelectableEntryItem
        entry={mockEntry}
        isSelectionMode={true}
        isSelected={false}
        onToggleSelection={onToggleSelection}
      >
        <div>Entry Content</div>
      </SelectableEntryItem>
    );
    
    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);
    
    expect(onToggleSelection).toHaveBeenCalledWith(mockEntry.id);
    expect(onToggleSelection).toHaveBeenCalledTimes(1);
  });

  it('should apply selected styling when entry is selected', () => {
    const onToggleSelection = vi.fn();
    
    const { container } = render(
      <SelectableEntryItem
        entry={mockEntry}
        isSelectionMode={true}
        isSelected={true}
        onToggleSelection={onToggleSelection}
      >
        <div>Entry Content</div>
      </SelectableEntryItem>
    );
    
    // Check that the container has the selected background class
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('bg-blue-50');
  });

  it('should not apply selected styling when not selected', () => {
    const onToggleSelection = vi.fn();
    
    const { container } = render(
      <SelectableEntryItem
        entry={mockEntry}
        isSelectionMode={true}
        isSelected={false}
        onToggleSelection={onToggleSelection}
      >
        <div>Entry Content</div>
      </SelectableEntryItem>
    );
    
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).not.toContain('bg-blue-50');
  });

  it('should render children content', () => {
    const onToggleSelection = vi.fn();
    
    render(
      <SelectableEntryItem
        entry={mockEntry}
        isSelectionMode={true}
        isSelected={false}
        onToggleSelection={onToggleSelection}
      >
        <div data-testid="child-content">Custom Child Content</div>
      </SelectableEntryItem>
    );
    
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Custom Child Content')).toBeInTheDocument();
  });

  it('should handle multiple clicks on checkbox', async () => {
    const user = userEvent.setup();
    const onToggleSelection = vi.fn();
    
    render(
      <SelectableEntryItem
        entry={mockEntry}
        isSelectionMode={true}
        isSelected={false}
        onToggleSelection={onToggleSelection}
      >
        <div>Entry Content</div>
      </SelectableEntryItem>
    );
    
    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);
    await user.click(checkbox);
    await user.click(checkbox);
    
    expect(onToggleSelection).toHaveBeenCalledTimes(3);
  });
});
