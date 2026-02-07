/**
 * UserProfileMenu Tests
 * 
 * Tests for user profile menu component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { UserProfileMenu } from './UserProfileMenu';
import type { User } from 'firebase/auth';

// Mock user data
const mockUserWithPhoto: Partial<User> = {
  uid: 'test-uid',
  email: 'test@example.com',
  displayName: 'John Doe',
  photoURL: 'https://example.com/photo.jpg',
};

const mockUserWithoutPhoto: Partial<User> = {
  uid: 'test-uid-2',
  email: 'test2@example.com',
  displayName: 'Jane Smith',
  photoURL: null,
};

const mockUserWithoutDisplayName: Partial<User> = {
  uid: 'test-uid-3',
  email: 'test3@example.com',
  displayName: null,
  photoURL: null,
};

const mockUserWithSingleName: Partial<User> = {
  uid: 'test-uid-4',
  email: 'test4@example.com',
  displayName: 'Madonna',
  photoURL: null,
};

describe('UserProfileMenu', () => {
  const mockOnSignOut = vi.fn();
  const mockOnSettingsClick = vi.fn();

  afterEach(() => {
    mockOnSignOut.mockClear();
    mockOnSettingsClick.mockClear();
  });

  it('should render with photo URL', () => {
    render(<UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} />);
    
    const avatar = screen.getByRole('button', { name: /user menu/i });
    expect(avatar).toBeInTheDocument();
    
    // Check that image is present
    const img = screen.getByAltText(/profile/i);
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
  });

  it('should render with initials fallback when no photo', () => {
    render(<UserProfileMenu user={mockUserWithoutPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} />);
    
    const avatar = screen.getByRole('button', { name: /user menu/i });
    expect(avatar).toBeInTheDocument();
    
    // Check for initials
    expect(screen.getByText('JS')).toBeInTheDocument();
  });

  it('should render with single initial for single-word name', () => {
    render(<UserProfileMenu user={mockUserWithSingleName as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} />);
    
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('should display email when no display name', async () => {
    const user = userEvent.setup();
    render(<UserProfileMenu user={mockUserWithoutDisplayName as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} />);
    
    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);
    
    // Email should be shown in place of display name
    expect(screen.getByText('test3@example.com')).toBeInTheDocument();
  });

  it('should open dropdown when avatar is clicked', async () => {
    const user = userEvent.setup();
    render(<UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} />);
    
    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);
    
    // Dropdown should show user info
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument();
  });

  it('should close dropdown when avatar is clicked again', async () => {
    const user = userEvent.setup();
    render(<UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} />);
    
    const avatar = screen.getByRole('button', { name: /user menu/i });
    
    // Open
    await user.click(avatar);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    
    // Close
    await user.click(avatar);
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  it('should close dropdown when clicking outside', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <div>
        <UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} />
        <div data-testid="outside">Outside element</div>
      </div>
    );
    
    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    
    // Click outside
    const outside = screen.getByTestId('outside');
    await user.click(outside);
    
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  it('should close dropdown when Escape is pressed', async () => {
    const user = userEvent.setup();
    render(<UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} />);
    
    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    
    // Press Escape
    await user.keyboard('{Escape}');
    
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  it('should call onSignOut when sign out button is clicked', async () => {
    const user = userEvent.setup();
    render(<UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} />);
    
    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);
    
    const signOutButton = screen.getByRole('menuitem', { name: /sign out/i });
    await user.click(signOutButton);
    
    expect(mockOnSignOut).toHaveBeenCalledOnce();
  });

  it('should display user info correctly in dropdown', async () => {
    const user = userEvent.setup();
    render(<UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} />);
    
    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);
    
    // Check display name
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    
    // Check email
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('should have proper ARIA attributes', () => {
    render(<UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} />);
    
    const avatar = screen.getByRole('button', { name: /user menu/i });
    
    expect(avatar).toHaveAttribute('aria-haspopup', 'true');
    expect(avatar).toHaveAttribute('aria-expanded', 'false');
  });

  it('should update aria-expanded when dropdown opens', async () => {
    const user = userEvent.setup();
    render(<UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} />);
    
    const avatar = screen.getByRole('button', { name: /user menu/i });
    
    expect(avatar).toHaveAttribute('aria-expanded', 'false');
    
    await user.click(avatar);
    
    expect(avatar).toHaveAttribute('aria-expanded', 'true');
  });

  it('should support keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} />);
    
    const avatar = screen.getByRole('button', { name: /user menu/i });
    
    // Tab to avatar
    await user.tab();
    expect(avatar).toHaveFocus();
    
    // Open with Enter
    await user.keyboard('{Enter}');
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    
    // Tab to first menu item (Settings)
    await user.tab();
    const settingsButton = screen.getByRole('menuitem', { name: /settings/i });
    expect(settingsButton).toHaveFocus();
  });

  it('should render Settings menu option', async () => {
    const user = userEvent.setup();
    render(<UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} />);
    
    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);
    
    expect(screen.getByRole('menuitem', { name: /settings/i })).toBeInTheDocument();
  });

  it('should call onSettingsClick when Settings is clicked', async () => {
    const user = userEvent.setup();
    render(<UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} />);
    
    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);
    
    const settingsButton = screen.getByRole('menuitem', { name: /settings/i });
    await user.click(settingsButton);
    
    expect(mockOnSettingsClick).toHaveBeenCalledOnce();
  });

  it('should close menu after Settings is clicked', async () => {
    const user = userEvent.setup();
    render(<UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} />);
    
    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    
    const settingsButton = screen.getByRole('menuitem', { name: /settings/i });
    await user.click(settingsButton);
    
    // Menu should be closed
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  it('should display Settings option before Sign out', async () => {
    const user = userEvent.setup();
    render(<UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} />);
    
    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);
    
    const menuItems = screen.getAllByRole('menuitem');
    expect(menuItems).toHaveLength(2);
    expect(menuItems[0]).toHaveTextContent(/settings/i);
    expect(menuItems[1]).toHaveTextContent(/sign out/i);
  });
});
