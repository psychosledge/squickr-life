import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { DeleteCollectionModal } from './DeleteCollectionModal';

describe('DeleteCollectionModal', () => {
  it('should not render when closed', () => {
    render(
      <DeleteCollectionModal 
        isOpen={false} 
        collectionName="Test Collection"
        entryCount={5}
        onClose={vi.fn()} 
        onConfirm={vi.fn()} 
      />
    );

    expect(screen.queryByText('Delete Collection')).not.toBeInTheDocument();
  });

  it('should render when open', () => {
    render(
      <DeleteCollectionModal 
        isOpen={true} 
        collectionName="Test Collection"
        entryCount={5}
        onClose={vi.fn()} 
        onConfirm={vi.fn()} 
      />
    );

    expect(screen.getByText('Delete Collection')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('should display collection name in confirmation message', () => {
    render(
      <DeleteCollectionModal 
        isOpen={true} 
        collectionName="My Important Collection"
        entryCount={10}
        onClose={vi.fn()} 
        onConfirm={vi.fn()} 
      />
    );

    expect(screen.getByText(/"My Important Collection"/)).toBeInTheDocument();
  });

  it('should display entry count warning when count > 0', () => {
    render(
      <DeleteCollectionModal 
        isOpen={true} 
        collectionName="Test"
        entryCount={5}
        onClose={vi.fn()} 
        onConfirm={vi.fn()} 
      />
    );

    expect(screen.getByText(/5 entries/i)).toBeInTheDocument();
  });

  it('should display singular "entry" when count is 1', () => {
    render(
      <DeleteCollectionModal 
        isOpen={true} 
        collectionName="Test"
        entryCount={1}
        onClose={vi.fn()} 
        onConfirm={vi.fn()} 
      />
    );

    expect(screen.getByText(/1 entry/i)).toBeInTheDocument();
  });

  it('should display message when no entries exist', () => {
    render(
      <DeleteCollectionModal 
        isOpen={true} 
        collectionName="Test Collection"
        entryCount={0}
        onClose={vi.fn()} 
        onConfirm={vi.fn()} 
      />
    );

    expect(screen.getByText(/This is an empty collection/i)).toBeInTheDocument();
  });

  it('should call onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    
    render(
      <DeleteCollectionModal 
        isOpen={true} 
        collectionName="Test"
        entryCount={5}
        onClose={onClose} 
        onConfirm={vi.fn()} 
      />
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onConfirm when delete button is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    
    render(
      <DeleteCollectionModal 
        isOpen={true} 
        collectionName="Test"
        entryCount={5}
        onClose={vi.fn()} 
        onConfirm={onConfirm} 
      />
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('should confirm when Enter key is pressed', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    
    render(
      <DeleteCollectionModal 
        isOpen={true} 
        collectionName="Test"
        entryCount={5}
        onClose={vi.fn()} 
        onConfirm={onConfirm} 
      />
    );

    await user.keyboard('{Enter}');
    
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('should close when Escape key is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    
    render(
      <DeleteCollectionModal 
        isOpen={true} 
        collectionName="Test"
        entryCount={5}
        onClose={onClose} 
        onConfirm={vi.fn()} 
      />
    );

    await user.keyboard('{Escape}');
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should prevent body scroll when open', () => {
    const originalOverflow = document.body.style.overflow;
    
    const { rerender } = render(
      <DeleteCollectionModal 
        isOpen={true} 
        collectionName="Test"
        entryCount={5}
        onClose={vi.fn()} 
        onConfirm={vi.fn()} 
      />
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <DeleteCollectionModal 
        isOpen={false} 
        collectionName="Test"
        entryCount={5}
        onClose={vi.fn()} 
        onConfirm={vi.fn()} 
      />
    );

    expect(document.body.style.overflow).toBe(originalOverflow);
  });

  it('should close when backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    
    render(
      <DeleteCollectionModal 
        isOpen={true} 
        collectionName="Test"
        entryCount={5}
        onClose={onClose} 
        onConfirm={vi.fn()} 
      />
    );

    const backdrop = screen.getByText('Delete Collection').closest('.fixed');
    if (backdrop) {
      await user.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });

  it('should have danger styling on delete button', () => {
    render(
      <DeleteCollectionModal 
        isOpen={true} 
        collectionName="Test"
        entryCount={5}
        onClose={vi.fn()} 
        onConfirm={vi.fn()} 
      />
    );

    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    // Should have red/danger classes (checking for bg-red)
    expect(deleteButton.className).toMatch(/bg-red/);
  });
});
