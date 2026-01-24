import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('should render the Squickr Life title', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Squickr Life')).toBeInTheDocument();
    });
  });

  it('should display the tagline', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText(/Get shit done quicker with Squickr!/i)).toBeInTheDocument();
    });
  });

  it('should render the task input', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/add a task/i)).toBeInTheDocument();
    });
  });

  it('should show empty state initially', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
    });
  });
});
