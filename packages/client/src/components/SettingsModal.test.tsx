/**
 * SettingsModal Tests
 * 
 * Tests for settings modal component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { SettingsModal } from './SettingsModal';
import type { IEventStore, UserPreferences, CompletedTaskBehavior } from '@squickr/domain';
import { InMemoryEventStore } from '@squickr/infrastructure';

// Mock hooks
vi.mock('../hooks/useUserPreferences', () => ({
  useUserPreferences: vi.fn(),
}));

vi.mock('../context/AppContext', () => ({
  useApp: vi.fn(),
}));

import { useUserPreferences } from '../hooks/useUserPreferences';
import { useApp } from '../context/AppContext';

describe('SettingsModal', () => {
  let mockEventStore: IEventStore;
  const mockOnClose = vi.fn();

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup event store
    mockEventStore = new InMemoryEventStore();
    
    // Mock useApp hook
    vi.mocked(useApp).mockReturnValue({
      eventStore: mockEventStore,
      user: null,
      loading: false,
      signOut: vi.fn(),
    });
    
    // Mock useUserPreferences hook with defaults
    vi.mocked(useUserPreferences).mockReturnValue({
      defaultCompletedTaskBehavior: 'move-to-bottom',
      autoFavoriteRecentDailyLogs: false,
    });
  });

  it('should not render when closed', () => {
    render(<SettingsModal isOpen={false} onClose={mockOnClose} />);

    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('should render when open', () => {
    render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('User Preferences')).toBeInTheDocument();
    expect(screen.getByLabelText('Default Completed Task Behavior')).toBeInTheDocument();
    expect(screen.getByLabelText(/Auto-favorite recent daily logs/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('should display current preferences on open', () => {
    vi.mocked(useUserPreferences).mockReturnValue({
      defaultCompletedTaskBehavior: 'collapse',
      autoFavoriteRecentDailyLogs: true,
    });

    render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

    const behaviorDropdown = screen.getByLabelText('Default Completed Task Behavior') as HTMLSelectElement;
    const autoFavoriteCheckbox = screen.getByLabelText(/Auto-favorite recent daily logs/i) as HTMLInputElement;
    
    expect(behaviorDropdown.value).toBe('collapse');
    expect(autoFavoriteCheckbox.checked).toBe(true);
  });

  it('should save changes when form is submitted', async () => {
    const user = userEvent.setup();
    const appendSpy = vi.spyOn(mockEventStore, 'append');
    
    render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

    // Change behavior
    const behaviorDropdown = screen.getByLabelText('Default Completed Task Behavior');
    await user.selectOptions(behaviorDropdown, 'collapse');
    
    // Toggle auto-favorite
    const autoFavoriteCheckbox = screen.getByLabelText(/Auto-favorite recent daily logs/i);
    await user.click(autoFavoriteCheckbox);

    // Submit
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Should save event
    await waitFor(() => {
      expect(appendSpy).toHaveBeenCalled();
      const event = appendSpy.mock.calls[0][0];
      expect(event.type).toBe('UserPreferencesUpdated');
      expect(event.payload.defaultCompletedTaskBehavior).toBe('collapse');
      expect(event.payload.autoFavoriteRecentDailyLogs).toBe(true);
    });

    // Should close modal
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledOnce();
    });
  });

  it('should close modal after successful save', async () => {
    const user = userEvent.setup();
    
    render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledOnce();
    });
  });

  it('should show error message on save failure', async () => {
    const user = userEvent.setup();
    vi.spyOn(mockEventStore, 'append').mockRejectedValue(new Error('Network error'));
    
    render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
    
    // Should not close modal
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('should call onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    
    render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('should close modal when Escape is pressed', async () => {
    const user = userEvent.setup();
    
    render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

    await user.keyboard('{Escape}');
    
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('should close modal when clicking outside', async () => {
    const user = userEvent.setup();
    
    render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

    // Click the backdrop
    const backdrop = screen.getByText('Settings').parentElement?.parentElement;
    if (backdrop) {
      await user.click(backdrop);
      expect(mockOnClose).toHaveBeenCalledOnce();
    }
  });

  it('should show loading state while saving', async () => {
    const user = userEvent.setup();
    let resolveAppend: () => void;
    const appendPromise = new Promise<void>((resolve) => {
      resolveAppend = resolve;
    });
    vi.spyOn(mockEventStore, 'append').mockReturnValue(appendPromise);
    
    render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

    // Start save
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Should show loading state
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    
    // Complete save
    resolveAppend!();
  });

  it('should prevent closing while saving', async () => {
    const user = userEvent.setup();
    let resolveAppend: () => void;
    const appendPromise = new Promise<void>((resolve) => {
      resolveAppend = resolve;
    });
    vi.spyOn(mockEventStore, 'append').mockReturnValue(appendPromise);
    
    render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

    // Start save
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Try to close with Escape
    await user.keyboard('{Escape}');
    
    // Should not close
    expect(mockOnClose).not.toHaveBeenCalled();
    
    // Complete save
    resolveAppend!();
  });

  it('should disable controls while saving', async () => {
    const user = userEvent.setup();
    let resolveAppend: () => void;
    const appendPromise = new Promise<void>((resolve) => {
      resolveAppend = resolve;
    });
    vi.spyOn(mockEventStore, 'append').mockReturnValue(appendPromise);
    
    render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

    // Start save
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Controls should be disabled
    const behaviorDropdown = screen.getByLabelText('Default Completed Task Behavior');
    const autoFavoriteCheckbox = screen.getByLabelText(/Auto-favorite recent daily logs/i);
    
    expect(behaviorDropdown).toBeDisabled();
    expect(autoFavoriteCheckbox).toBeDisabled();
    
    // Complete save
    resolveAppend!();
  });

  it('should display behavior descriptions', () => {
    render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

    // Default is 'move-to-bottom'
    expect(screen.getByText('Completed tasks move below a separator')).toBeInTheDocument();
  });

  it('should update behavior description when selection changes', async () => {
    const user = userEvent.setup();
    
    render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

    // Change to 'collapse'
    const behaviorDropdown = screen.getByLabelText('Default Completed Task Behavior');
    await user.selectOptions(behaviorDropdown, 'collapse');
    
    expect(screen.getByText('Completed tasks hidden in expandable section')).toBeInTheDocument();
  });

  it('should display help text for settings', () => {
    render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText('New collections will use this behavior.')).toBeInTheDocument();
    expect(screen.getByText(/Automatically show Today, Yesterday, and Tomorrow/i)).toBeInTheDocument();
  });

  it('should have all three behavior options', () => {
    render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

    const behaviorDropdown = screen.getByLabelText('Default Completed Task Behavior') as HTMLSelectElement;
    const options = Array.from(behaviorDropdown.options).map(opt => opt.value);
    
    expect(options).toContain('keep-in-place');
    expect(options).toContain('move-to-bottom');
    expect(options).toContain('collapse');
  });

  it('should reset form when reopened', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

    // Make changes
    const behaviorDropdown = screen.getByLabelText('Default Completed Task Behavior');
    await user.selectOptions(behaviorDropdown, 'collapse');
    
    // Close modal (without saving)
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    
    // Reopen modal
    rerender(<SettingsModal isOpen={false} onClose={mockOnClose} />);
    rerender(<SettingsModal isOpen={true} onClose={mockOnClose} />);
    
    // Should reset to original value
    const resetDropdown = screen.getByLabelText('Default Completed Task Behavior') as HTMLSelectElement;
    expect(resetDropdown.value).toBe('move-to-bottom'); // original default
  });
});
