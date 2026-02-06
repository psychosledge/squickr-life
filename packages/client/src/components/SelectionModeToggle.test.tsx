/**
 * Tests for SelectionModeToggle component
 * 
 * Tests the toggle button for entering/exiting selection mode.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { SelectionModeToggle } from './SelectionModeToggle';

describe('SelectionModeToggle', () => {
  it('should render enter button when not in selection mode', () => {
    const onEnter = vi.fn();
    const onExit = vi.fn();
    
    render(
      <SelectionModeToggle
        isSelectionMode={false}
        onEnter={onEnter}
        onExit={onExit}
      />
    );
    
    expect(screen.getByText('Select Entries')).toBeInTheDocument();
  });

  it('should call onEnter when enter button is clicked', async () => {
    const user = userEvent.setup();
    const onEnter = vi.fn();
    const onExit = vi.fn();
    
    render(
      <SelectionModeToggle
        isSelectionMode={false}
        onEnter={onEnter}
        onExit={onExit}
      />
    );
    
    const button = screen.getByText('Select Entries');
    await user.click(button);
    
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(onExit).not.toHaveBeenCalled();
  });

  it('should not render anything when in selection mode', () => {
    const onEnter = vi.fn();
    const onExit = vi.fn();
    
    const { container } = render(
      <SelectionModeToggle
        isSelectionMode={true}
        onEnter={onEnter}
        onExit={onExit}
      />
    );
    
    // Component returns null when in selection mode (toolbar handles exit)
    expect(container.firstChild).toBeNull();
  });
});
