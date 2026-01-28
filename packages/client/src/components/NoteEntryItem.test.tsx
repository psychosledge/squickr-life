import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NoteEntryItem } from './NoteEntryItem';
import type { Entry } from '@squickr/shared';

describe('NoteEntryItem', () => {
  const mockOnUpdateNoteContent = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockNote: Entry & { type: 'note' } = {
    type: 'note',
    id: 'note-1',
    content: 'Important meeting notes',
    createdAt: '2026-01-24T10:00:00.000Z',
  };

  it('should render note with dash bullet', () => {
    render(
      <NoteEntryItem 
        entry={mockNote} 
        onDelete={mockOnDelete}
      />
    );
    
    expect(screen.getByText('–')).toBeInTheDocument();
    expect(screen.getByText('Important meeting notes')).toBeInTheDocument();
  });

  it('should not show Complete/Reopen buttons', () => {
    render(
      <NoteEntryItem 
        entry={mockNote} 
        onDelete={mockOnDelete}
      />
    );
    
    expect(screen.queryByRole('button', { name: /complete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reopen/i })).not.toBeInTheDocument();
  });

  it('should call onDelete when Delete button is clicked', () => {
    render(
      <NoteEntryItem 
        entry={mockNote} 
        onDelete={mockOnDelete}
      />
    );
    
    const button = screen.getByLabelText('Delete entry');
    fireEvent.click(button);

    expect(mockOnDelete).toHaveBeenCalledWith('note-1');
  });

  it('should enter edit mode on double-click when update handler provided', () => {
    render(
      <NoteEntryItem 
        entry={mockNote} 
        onUpdateNoteContent={mockOnUpdateNoteContent}
        onDelete={mockOnDelete}
      />
    );
    
    const content = screen.getByText('Important meeting notes');
    fireEvent.doubleClick(content);
    
    const textarea = screen.getByDisplayValue('Important meeting notes');
    expect(textarea).toBeInTheDocument();
  });

  it('should not enter edit mode if no update handler is provided', () => {
    render(
      <NoteEntryItem 
        entry={mockNote} 
        onDelete={mockOnDelete}
      />
    );
    
    const content = screen.getByText('Important meeting notes');
    fireEvent.doubleClick(content);
    
    expect(screen.queryByDisplayValue('Important meeting notes')).not.toBeInTheDocument();
  });

  it('should format timestamp as relative time', () => {
    const recentNote: Entry & { type: 'note' } = {
      type: 'note',
      id: 'note-1',
      content: 'Recent note',
      createdAt: new Date().toISOString(),
    };

    render(
      <NoteEntryItem 
        entry={recentNote} 
        onDelete={mockOnDelete}
      />
    );
    
    expect(screen.getByText(/just now|seconds ago/i)).toBeInTheDocument();
  });
});
