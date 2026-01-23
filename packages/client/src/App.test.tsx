import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('should render the Squickr Life title', () => {
    render(<App />);
    
    expect(screen.getByText('Squickr Life')).toBeInTheDocument();
  });

  it('should display the tagline', () => {
    render(<App />);
    
    expect(screen.getByText(/Get shit done quicker with Squickr!/i)).toBeInTheDocument();
  });

  it('should render the counter button', () => {
    render(<App />);
    
    expect(screen.getByRole('button', { name: /Test Counter: 0/i })).toBeInTheDocument();
  });
});
