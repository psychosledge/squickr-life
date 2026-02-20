import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DateHeader } from './DateHeader';

describe('DateHeader', () => {
  // Fixed reference: Wednesday, February 19, 2026
  const reference = new Date('2026-02-19T12:00:00');

  it('should display "Today" when the date matches the reference date', () => {
    render(<DateHeader date="2026-02-19" entryCount={3} referenceDate={reference} />);
    expect(screen.getByRole('heading')).toHaveTextContent('Today');
  });

  it('should display "Yesterday" for the day before the reference date', () => {
    render(<DateHeader date="2026-02-18" entryCount={1} referenceDate={reference} />);
    expect(screen.getByRole('heading')).toHaveTextContent('Yesterday');
  });

  it('should display a formatted date for dates that are neither today nor yesterday', () => {
    render(<DateHeader date="2026-02-17" entryCount={2} referenceDate={reference} />);
    const heading = screen.getByRole('heading');
    expect(heading).toHaveTextContent(/Tue/);
    expect(heading).toHaveTextContent(/Feb/);
    expect(heading).toHaveTextContent(/17/);
  });

  it('should display singular "entry" for a count of 1', () => {
    render(<DateHeader date="2026-02-19" entryCount={1} referenceDate={reference} />);
    expect(screen.getByText('1 entry')).toBeInTheDocument();
  });

  it('should display plural "entries" for a count other than 1', () => {
    render(<DateHeader date="2026-02-19" entryCount={4} referenceDate={reference} />);
    expect(screen.getByText('4 entries')).toBeInTheDocument();
  });

  it('should display "0 entries" when entry count is zero', () => {
    render(<DateHeader date="2026-02-19" entryCount={0} referenceDate={reference} />);
    expect(screen.getByText('0 entries')).toBeInTheDocument();
  });

  it('should render without referenceDate prop (uses current time by default)', () => {
    // Just verify it renders without throwing
    render(<DateHeader date="2026-02-19" entryCount={2} />);
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });
});
