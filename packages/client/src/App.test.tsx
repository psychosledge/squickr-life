import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import type { IndexedDBEventStore } from '@squickr/shared';
import { onAuthStateChanged } from 'firebase/auth';

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
  beforeEach(() => {
    // Mock authenticated user for these tests
    vi.mocked(onAuthStateChanged).mockImplementation((_auth, callback) => {
      // Simulate a signed-in user
      callback({
        uid: 'test-user-id',
        email: 'test@example.com',
      } as any);
      return vi.fn(); // Return unsubscribe function
    });
  });

  it('should render the Squickr Life title', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Squickr Life')).toBeInTheDocument();
    });
  });

  it('should display the tagline', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Get shit done quicker with Squickr!')).toBeInTheDocument();
    });
  });

  it('should render the FAB button after loading', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add new entry/i })).toBeInTheDocument();
    });
  });

  it('should show empty state initially', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText(/no collections yet/i)).toBeInTheDocument();
    });
  });


});
