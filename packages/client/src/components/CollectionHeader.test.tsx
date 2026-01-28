/**
 * CollectionHeader Tests
 * 
 * Phase 2C: Collection Detail View - Header component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { CollectionHeader } from './CollectionHeader';

describe('CollectionHeader', () => {
  const defaultProps = {
    collectionName: 'Books to Read',
    onRename: vi.fn(),
    onDelete: vi.fn(),
  };

  function renderHeader(props = {}) {
    return render(
      <BrowserRouter>
        <CollectionHeader {...defaultProps} {...props} />
      </BrowserRouter>
    );
  }

  it('should display collection name', () => {
    renderHeader();
    expect(screen.getByText('Books to Read')).toBeInTheDocument();
  });

  it('should render back button that navigates to index', () => {
    renderHeader();
    const backButton = screen.getByLabelText(/back to collections/i);
    expect(backButton).toBeInTheDocument();
    expect(backButton).toHaveAttribute('href', '/');
  });

  it('should render menu button', () => {
    renderHeader();
    const menuButton = screen.getByLabelText(/collection menu/i);
    expect(menuButton).toBeInTheDocument();
  });

  it('should open menu when menu button is clicked', async () => {
    const user = userEvent.setup();
    renderHeader();
    
    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);
    
    expect(screen.getByText(/rename/i)).toBeInTheDocument();
    expect(screen.getByText(/delete/i)).toBeInTheDocument();
  });

  it('should call onRename when rename option is clicked', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    renderHeader({ onRename });
    
    // Open menu
    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);
    
    // Click rename
    const renameOption = screen.getByText(/rename/i);
    await user.click(renameOption);
    
    expect(onRename).toHaveBeenCalledOnce();
  });

  it('should call onDelete when delete option is clicked', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderHeader({ onDelete });
    
    // Open menu
    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);
    
    // Click delete
    const deleteOption = screen.getByText(/delete/i);
    await user.click(deleteOption);
    
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('should close menu when clicking outside', async () => {
    const user = userEvent.setup();
    renderHeader();
    
    // Open menu
    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);
    expect(screen.getByText(/rename/i)).toBeInTheDocument();
    
    // Click outside (on the header title)
    const title = screen.getByText('Books to Read');
    await user.click(title);
    
    expect(screen.queryByText(/rename/i)).not.toBeInTheDocument();
  });
});
