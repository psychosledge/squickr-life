import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import type { IndexedDBEventStore } from '@squickr/shared';

// Mock IndexedDBEventStore since we're in jsdom environment
vi.mock('@squickr/shared', async () => {
  const actual = await vi.importActual('@squickr/shared');
  
  class MockIndexedDBEventStore {
    async initialize() {
      return Promise.resolve();
    }
    async append() {
      return Promise.resolve();
    }
    async getAll() {
      return Promise.resolve([]);
    }
    async getById() {
      return Promise.resolve([]);
    }
    subscribe() {
      return () => {}; // Return unsubscribe function
    }
  }
  
  return {
    ...actual,
    IndexedDBEventStore: MockIndexedDBEventStore,
  };
});

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

  it('should render the task input after loading', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/add a task/i)).toBeInTheDocument();
    });
  });

  it('should show empty state initially', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText(/no entries yet/i)).toBeInTheDocument();
    });
  });

  it('should show persistence message in footer', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText(/data persists with indexeddb/i)).toBeInTheDocument();
    });
  });
});
