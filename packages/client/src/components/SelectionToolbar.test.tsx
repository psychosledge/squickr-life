/**
 * Tests for SelectionToolbar component
 * 
 * Tests the toolbar that appears when in selection mode.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { SelectionToolbar } from './SelectionToolbar';

describe('SelectionToolbar', () => {
  const defaultProps = {
    selectedCount: 0,
    onSelectAll: vi.fn(),
    onSelectIncomplete: vi.fn(),
    onSelectNotes: vi.fn(),
    onClear: vi.fn(),
    onMigrate: vi.fn(),
    onCancel: vi.fn(),
  };

  it('should display selection count', () => {
    render(<SelectionToolbar {...defaultProps} selectedCount={5} />);
    
    expect(screen.getByText('5 selected')).toBeInTheDocument();
  });

  it('should display singular text for 1 selection', () => {
    render(<SelectionToolbar {...defaultProps} selectedCount={1} />);
    
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  it('should render all quick filter buttons', () => {
    render(<SelectionToolbar {...defaultProps} />);
    
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Incomplete')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('should render action buttons', () => {
    render(<SelectionToolbar {...defaultProps} />);
    
    expect(screen.getByText('Migrate')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should disable Migrate button when no selections', () => {
    render(<SelectionToolbar {...defaultProps} selectedCount={0} />);
    
    const migrateButton = screen.getByText('Migrate');
    expect(migrateButton).toBeDisabled();
  });

  it('should enable Migrate button when entries are selected', () => {
    render(<SelectionToolbar {...defaultProps} selectedCount={3} />);
    
    const migrateButton = screen.getByText('Migrate');
    expect(migrateButton).not.toBeDisabled();
  });

  it('should call onSelectAll when All button is clicked', async () => {
    const user = userEvent.setup();
    const onSelectAll = vi.fn();
    
    render(<SelectionToolbar {...defaultProps} onSelectAll={onSelectAll} />);
    
    await user.click(screen.getByText('All'));
    
    expect(onSelectAll).toHaveBeenCalledTimes(1);
  });

  it('should call onSelectIncomplete when Incomplete button is clicked', async () => {
    const user = userEvent.setup();
    const onSelectIncomplete = vi.fn();
    
    render(<SelectionToolbar {...defaultProps} onSelectIncomplete={onSelectIncomplete} />);
    
    await user.click(screen.getByText('Incomplete'));
    
    expect(onSelectIncomplete).toHaveBeenCalledTimes(1);
  });

  it('should call onSelectNotes when Notes button is clicked', async () => {
    const user = userEvent.setup();
    const onSelectNotes = vi.fn();
    
    render(<SelectionToolbar {...defaultProps} onSelectNotes={onSelectNotes} />);
    
    await user.click(screen.getByText('Notes'));
    
    expect(onSelectNotes).toHaveBeenCalledTimes(1);
  });

  it('should call onClear when Clear button is clicked', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    
    render(<SelectionToolbar {...defaultProps} onClear={onClear} />);
    
    await user.click(screen.getByText('Clear'));
    
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('should call onMigrate when Migrate button is clicked', async () => {
    const user = userEvent.setup();
    const onMigrate = vi.fn();
    
    render(<SelectionToolbar {...defaultProps} selectedCount={2} onMigrate={onMigrate} />);
    
    await user.click(screen.getByText('Migrate'));
    
    expect(onMigrate).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    
    render(<SelectionToolbar {...defaultProps} onCancel={onCancel} />);
    
    await user.click(screen.getByText('Cancel'));
    
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
