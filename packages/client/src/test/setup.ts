import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Extend Vitest's expect with jest-dom matchers
// This gives us assertions like .toBeInTheDocument(), .toHaveClass(), etc.

// Mock window.matchMedia (used by dark mode toggle)
Object.defineProperty(globalThis, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }),
});

// Mock Firebase environment variables for tests
vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-api-key');
vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'test-project.firebaseapp.com');
vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project');
vi.stubEnv('VITE_FIREBASE_STORAGE_BUCKET', 'test-project.appspot.com');
vi.stubEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '123456789');
vi.stubEnv('VITE_FIREBASE_APP_ID', '1:123456789:web:test');

// Mock Firebase modules
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn((_auth, callback) => {
    // Simulate no user signed in for tests
    callback(null);
    return vi.fn(); // Return unsubscribe function
  }),
}));

vi.mock('firebase/firestore', () => ({
  initializeFirestore: vi.fn(() => ({})),
  persistentLocalCache: vi.fn(() => ({})),
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  writeBatch: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

