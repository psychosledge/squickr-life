/**
 * CollectionNavigationControls Tests
 * 
 * Tests for the navigation controls component that displays prev/next buttons.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { CollectionNavigationControls } from './CollectionNavigationControls';
import type { Collection } from '@squickr/domain';

describe('CollectionNavigationControls', () => {
  const mockPreviousCollection: Collection = {
    id: 'prev-1',
    name: 'Previous Collection',
    type: 'custom',
    order: 'a',
    createdAt: '2024-01-01T00:00:00.000Z',
  };

  const mockNextCollection: Collection = {
    id: 'next-1',
    name: 'Next Collection',
    type: 'custom',
    order: 'c',
    createdAt: '2024-01-02T00:00:00.000Z',
  };

  const defaultProps = {
    previousCollection: mockPreviousCollection,
    nextCollection: mockNextCollection,
    onNavigatePrevious: vi.fn(),
    onNavigateNext: vi.fn(),
  };

  it('should render both navigation buttons', () => {
    render(<CollectionNavigationControls {...defaultProps} />);
    
    const prevButton = screen.getByLabelText(/previous: previous collection/i);
    const nextButton = screen.getByLabelText(/next: next collection/i);
    
    expect(prevButton).toBeInTheDocument();
    expect(nextButton).toBeInTheDocument();
  });

  it('should show collection names in title attribute', () => {
    render(<CollectionNavigationControls {...defaultProps} />);
    
    const prevButton = screen.getByLabelText(/previous: previous collection/i);
    const nextButton = screen.getByLabelText(/next: next collection/i);
    
    expect(prevButton).toHaveAttribute('title', 'Previous Collection');
    expect(nextButton).toHaveAttribute('title', 'Next Collection');
  });

  it('should call onNavigatePrevious when previous button is clicked', async () => {
    const user = userEvent.setup();
    const onNavigatePrevious = vi.fn();
    
    render(
      <CollectionNavigationControls 
        {...defaultProps} 
        onNavigatePrevious={onNavigatePrevious} 
      />
    );
    
    const prevButton = screen.getByLabelText(/previous: previous collection/i);
    await user.click(prevButton);
    
    expect(onNavigatePrevious).toHaveBeenCalledOnce();
  });

  it('should call onNavigateNext when next button is clicked', async () => {
    const user = userEvent.setup();
    const onNavigateNext = vi.fn();
    
    render(
      <CollectionNavigationControls 
        {...defaultProps} 
        onNavigateNext={onNavigateNext} 
      />
    );
    
    const nextButton = screen.getByLabelText(/next: next collection/i);
    await user.click(nextButton);
    
    expect(onNavigateNext).toHaveBeenCalledOnce();
  });

  it('should disable previous button when previousCollection is null', () => {
    render(
      <CollectionNavigationControls 
        {...defaultProps} 
        previousCollection={null} 
      />
    );
    
    const prevButton = screen.getByLabelText(/no previous collection/i);
    expect(prevButton).toBeDisabled();
  });

  it('should disable next button when nextCollection is null', () => {
    render(
      <CollectionNavigationControls 
        {...defaultProps} 
        nextCollection={null} 
      />
    );
    
    const nextButton = screen.getByLabelText(/no next collection/i);
    expect(nextButton).toBeDisabled();
  });

  it('should have proper ARIA labels when collections are available', () => {
    render(<CollectionNavigationControls {...defaultProps} />);
    
    const prevButton = screen.getByLabelText('Previous: Previous Collection');
    const nextButton = screen.getByLabelText('Next: Next Collection');
    
    expect(prevButton).toBeInTheDocument();
    expect(nextButton).toBeInTheDocument();
  });

  it('should have proper ARIA labels when at boundaries', () => {
    render(
      <CollectionNavigationControls 
        previousCollection={null}
        nextCollection={null}
        onNavigatePrevious={vi.fn()}
        onNavigateNext={vi.fn()}
      />
    );
    
    const prevButton = screen.getByLabelText('No previous collection');
    const nextButton = screen.getByLabelText('No next collection');
    
    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeDisabled();
  });

  it('should not call handlers when buttons are disabled', async () => {
    const user = userEvent.setup();
    const onNavigatePrevious = vi.fn();
    const onNavigateNext = vi.fn();
    
    render(
      <CollectionNavigationControls 
        previousCollection={null}
        nextCollection={null}
        onNavigatePrevious={onNavigatePrevious}
        onNavigateNext={onNavigateNext}
      />
    );
    
    const prevButton = screen.getByLabelText(/no previous collection/i);
    const nextButton = screen.getByLabelText(/no next collection/i);
    
    // Try to click disabled buttons
    await user.click(prevButton);
    await user.click(nextButton);
    
    // Handlers should not be called
    expect(onNavigatePrevious).not.toHaveBeenCalled();
    expect(onNavigateNext).not.toHaveBeenCalled();
  });

  it('should display chevron icons', () => {
    const { container } = render(<CollectionNavigationControls {...defaultProps} />);
    
    // Check for SVG elements (chevron icons)
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(2);
  });
});
