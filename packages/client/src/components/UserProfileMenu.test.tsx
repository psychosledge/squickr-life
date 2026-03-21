/**
 * UserProfileMenu Tests (extended for Commit 2)
 *
 * Tests for user profile menu component — original tests preserved,
 * extended with Help section tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { UserProfileMenu } from './UserProfileMenu';
import { TutorialProvider, TUTORIAL_COMPLETED_KEY } from '../context/TutorialContext';
import type { User } from 'firebase/auth';
import type { ReactNode } from 'react';
// ─── Render helper ────────────────────────────────────────────────────────────

function renderWithTutorial(ui: ReactNode) {
  return render(<TutorialProvider>{ui}</TutorialProvider>);
}

// ─── localStorage mock ────────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// ─── Mock user data ───────────────────────────────────────────────────────────

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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UserProfileMenu', () => {
  const mockOnSignOut = vi.fn();
  const mockOnSettingsClick = vi.fn();
  const mockOnReviewClick = vi.fn();

  beforeEach(() => {
    localStorageMock.clear();
  });

  afterEach(() => {
    mockOnSignOut.mockClear();
    mockOnSettingsClick.mockClear();
    mockOnReviewClick.mockClear();
  });

  it('should render with photo URL', () => {
    renderWithTutorial(
      <UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} onReviewClick={mockOnReviewClick} />,
    );

    const avatar = screen.getByRole('button', { name: /user menu/i });
    expect(avatar).toBeInTheDocument();

    const img = screen.getByAltText(/profile/i);
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
  });

  it('should render with initials fallback when no photo', () => {
    renderWithTutorial(
      <UserProfileMenu user={mockUserWithoutPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} onReviewClick={mockOnReviewClick} />,
    );

    const avatar = screen.getByRole('button', { name: /user menu/i });
    expect(avatar).toBeInTheDocument();

    expect(screen.getByText('JS')).toBeInTheDocument();
  });

  it('should render with single initial for single-word name', () => {
    renderWithTutorial(
      <UserProfileMenu user={mockUserWithSingleName as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} onReviewClick={mockOnReviewClick} />,
    );

    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('should display email when no display name', async () => {
    const user = userEvent.setup();
    renderWithTutorial(
      <UserProfileMenu user={mockUserWithoutDisplayName as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} onReviewClick={mockOnReviewClick} />,
    );

    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);

    expect(screen.getByText('test3@example.com')).toBeInTheDocument();
  });

  it('should open dropdown when avatar is clicked', async () => {
    const user = userEvent.setup();
    renderWithTutorial(
      <UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} onReviewClick={mockOnReviewClick} />,
    );

    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument();
  });

  it('should close dropdown when avatar is clicked again', async () => {
    const user = userEvent.setup();
    renderWithTutorial(
      <UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} onReviewClick={mockOnReviewClick} />,
    );

    const avatar = screen.getByRole('button', { name: /user menu/i });

    await user.click(avatar);
    expect(screen.getByText('John Doe')).toBeInTheDocument();

    await user.click(avatar);
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  it('should close dropdown when clicking outside', async () => {
    const user = userEvent.setup();
    renderWithTutorial(
      <div>
        <UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} onReviewClick={mockOnReviewClick} />
        <div data-testid="outside">Outside element</div>
      </div>,
    );

    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);

    expect(screen.getByText('John Doe')).toBeInTheDocument();

    const outside = screen.getByTestId('outside');
    await user.click(outside);

    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  it('should close dropdown when Escape is pressed', async () => {
    const user = userEvent.setup();
    renderWithTutorial(
      <UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} onReviewClick={mockOnReviewClick} />,
    );

    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);

    expect(screen.getByText('John Doe')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  it('should call onSignOut when sign out button is clicked', async () => {
    const user = userEvent.setup();
    renderWithTutorial(
      <UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} onReviewClick={mockOnReviewClick} />,
    );

    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);

    const signOutButton = screen.getByRole('menuitem', { name: /sign out/i });
    await user.click(signOutButton);

    expect(mockOnSignOut).toHaveBeenCalledOnce();
  });

  it('should display user info correctly in dropdown', async () => {
    const user = userEvent.setup();
    renderWithTutorial(
      <UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} onReviewClick={mockOnReviewClick} />,
    );

    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('should have proper ARIA attributes', () => {
    renderWithTutorial(
      <UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} onReviewClick={mockOnReviewClick} />,
    );

    const avatar = screen.getByRole('button', { name: /user menu/i });

    expect(avatar).toHaveAttribute('aria-haspopup', 'true');
    expect(avatar).toHaveAttribute('aria-expanded', 'false');
  });

  it('should update aria-expanded when dropdown opens', async () => {
    const user = userEvent.setup();
    renderWithTutorial(
      <UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} onReviewClick={mockOnReviewClick} />,
    );

    const avatar = screen.getByRole('button', { name: /user menu/i });

    expect(avatar).toHaveAttribute('aria-expanded', 'false');

    await user.click(avatar);

    expect(avatar).toHaveAttribute('aria-expanded', 'true');
  });

  it('should support keyboard navigation', async () => {
    const user = userEvent.setup();
    renderWithTutorial(
      <UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} onReviewClick={mockOnReviewClick} />,
    );

    const avatar = screen.getByRole('button', { name: /user menu/i });

    await user.tab();
    expect(avatar).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.getByText('John Doe')).toBeInTheDocument();

    await user.tab();
    const settingsButton = screen.getByRole('menuitem', { name: /settings/i });
    expect(settingsButton).toHaveFocus();
  });

  it('should render Settings menu option', async () => {
    const user = userEvent.setup();
    renderWithTutorial(
      <UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} onReviewClick={mockOnReviewClick} />,
    );

    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);

    expect(screen.getByRole('menuitem', { name: /settings/i })).toBeInTheDocument();
  });

  it('should call onSettingsClick when Settings is clicked', async () => {
    const user = userEvent.setup();
    renderWithTutorial(
      <UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} onReviewClick={mockOnReviewClick} />,
    );

    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);

    const settingsButton = screen.getByRole('menuitem', { name: /settings/i });
    await user.click(settingsButton);

    expect(mockOnSettingsClick).toHaveBeenCalledOnce();
  });

  it('should close menu after Settings is clicked', async () => {
    const user = userEvent.setup();
    renderWithTutorial(
      <UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} onReviewClick={mockOnReviewClick} />,
    );

    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);

    expect(screen.getByText('John Doe')).toBeInTheDocument();

    const settingsButton = screen.getByRole('menuitem', { name: /settings/i });
    await user.click(settingsButton);

    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  it('should display Settings option before Sign out with new help items in between', async () => {
    const user = userEvent.setup();
    renderWithTutorial(
      <UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} onReviewClick={mockOnReviewClick} />,
    );

    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);

    // Verify specific items are present rather than relying on a total count
    expect(screen.getByRole('menuitem', { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /review/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /restart tutorial/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /bullet journal guide/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /keyboard shortcuts/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /report a bug/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /request a feature/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /about squickr life/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument();

    // Settings should appear before Sign out in document order
    const menuItems = screen.getAllByRole('menuitem');
    const settingsIndex = menuItems.findIndex(el => /settings/i.test(el.textContent ?? ''));
    const signOutIndex = menuItems.findIndex(el => /sign out/i.test(el.textContent ?? ''));
    expect(settingsIndex).toBeLessThan(signOutIndex);
  });

  // ─── Review ──────────────────────────────────────────────────────────────

  it('renders Review menu item', async () => {
    const user = userEvent.setup();
    renderWithTutorial(
      <UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} onReviewClick={mockOnReviewClick} />,
    );

    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);

    expect(screen.getByRole('menuitem', { name: /review/i })).toBeInTheDocument();
  });

  it('calls onReviewClick and closes menu when Review is clicked', async () => {
    const user = userEvent.setup();
    renderWithTutorial(
      <UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} onReviewClick={mockOnReviewClick} />,
    );

    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);

    const reviewButton = screen.getByRole('menuitem', { name: /review/i });
    await user.click(reviewButton);

    expect(mockOnReviewClick).toHaveBeenCalledOnce();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  // ─── Help Section ────────────────────────────────────────────────────────

  it('help section items are present in the dropdown', async () => {
    const user = userEvent.setup();
    renderWithTutorial(
      <UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} onReviewClick={mockOnReviewClick} />,
    );

    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);

    expect(screen.getByRole('menuitem', { name: /restart tutorial/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /bullet journal guide/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /keyboard shortcuts/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /report a bug/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /request a feature/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /github discussions/i })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /about squickr life/i })).toBeInTheDocument();
  });

  it('clicking "Restart Tutorial" calls resetTutorial and clears localStorage', async () => {
    const user = userEvent.setup();
    // Pre-set the completed flag
    localStorageMock.setItem(TUTORIAL_COMPLETED_KEY, 'true');

    renderWithTutorial(
      <UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} onReviewClick={mockOnReviewClick} />,
    );

    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);

    const restartButton = screen.getByRole('menuitem', { name: /restart tutorial/i });
    await user.click(restartButton);

    // Dropdown should be closed
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();

    // localStorage key should be cleared (resetTutorial removes it)
    expect(localStorageMock.getItem(TUTORIAL_COMPLETED_KEY)).toBeNull();
  });

  it('clicking "Bullet Journal Guide" opens the BuJo modal', async () => {
    const user = userEvent.setup();
    renderWithTutorial(
      <UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} onReviewClick={mockOnReviewClick} />,
    );

    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);

    const bujoButton = screen.getByRole('menuitem', { name: /bullet journal guide/i });
    await user.click(bujoButton);

    // BulletJournalGuideModal should be visible
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Bullet Journal Guide')).toBeInTheDocument();
  });

  it('clicking "Keyboard Shortcuts" opens the keyboard shortcuts modal', async () => {
    const user = userEvent.setup();
    renderWithTutorial(
      <UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} onReviewClick={mockOnReviewClick} />,
    );

    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);

    const shortcutsButton = screen.getByRole('menuitem', { name: /keyboard shortcuts/i });
    await user.click(shortcutsButton);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  it('clicking "About Squickr Life" opens the About modal', async () => {
    const user = userEvent.setup();
    renderWithTutorial(
      <UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} onReviewClick={mockOnReviewClick} />,
    );

    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);

    const aboutButton = screen.getByRole('menuitem', { name: /about squickr life/i });
    await user.click(aboutButton);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Squickr Life')).toBeInTheDocument();
  });

  // ─── Habits ──────────────────────────────────────────────────────────────

  it('renders Habits menu item when onHabitsClick is provided', async () => {
    const user = userEvent.setup();
    const mockOnHabitsClick = vi.fn();
    renderWithTutorial(
      <UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} onReviewClick={mockOnReviewClick} onHabitsClick={mockOnHabitsClick} />,
    );

    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);

    expect(screen.getByRole('menuitem', { name: /habits/i })).toBeInTheDocument();
  });

  it('calls onHabitsClick and closes menu when Habits is clicked', async () => {
    const user = userEvent.setup();
    const mockOnHabitsClick = vi.fn();
    renderWithTutorial(
      <UserProfileMenu user={mockUserWithPhoto as User} onSignOut={mockOnSignOut} onSettingsClick={mockOnSettingsClick} onReviewClick={mockOnReviewClick} onHabitsClick={mockOnHabitsClick} />,
    );

    const avatar = screen.getByRole('button', { name: /user menu/i });
    await user.click(avatar);

    const habitsButton = screen.getByRole('menuitem', { name: /habits/i });
    await user.click(habitsButton);

    expect(mockOnHabitsClick).toHaveBeenCalledOnce();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });
});

