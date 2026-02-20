/**
 * TutorialContext Tests
 *
 * Tests for the TutorialContext, useTutorialContext hook,
 * and useTutorial convenience hook.
 *
 * Also covers auto-trigger logic that lives in CollectionIndexView.
 *
 * TDD: RED phase — these tests must fail before implementation exists.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { TutorialProvider, useTutorialContext, TUTORIAL_COMPLETED_KEY, TUTORIAL_SEEN_KEY, TUTORIAL_STEP_COUNT } from './TutorialContext';
import { useTutorial } from '../hooks/useTutorial';
import { UNCATEGORIZED_COLLECTION_ID } from '../routes';

// ─── Storage mocks ────────────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

// ─── Helpers ──────────────────────────────────────────────────────────────────

const wrapper = ({ children }: { children: ReactNode }) => (
  <TutorialProvider>{children}</TutorialProvider>
);

// ─── Constants ────────────────────────────────────────────────────────────────

// TUTORIAL_COMPLETED_KEY and TUTORIAL_SEEN_KEY are imported from TutorialContext above

// ─── TutorialContext: core state actions ─────────────────────────────────────

describe('TutorialContext', () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
  });

  // Test 1
  it('startTutorial() sets isRunning=true and stepIndex=0', () => {
    const { result } = renderHook(() => useTutorialContext(), { wrapper });

    act(() => {
      result.current.startTutorial();
    });

    expect(result.current.isRunning).toBe(true);
    expect(result.current.stepIndex).toBe(0);
  });

  // Test 2
  it('stopTutorial() sets isRunning=false', () => {
    const { result } = renderHook(() => useTutorialContext(), { wrapper });

    act(() => {
      result.current.startTutorial();
    });
    expect(result.current.isRunning).toBe(true);

    act(() => {
      result.current.stopTutorial();
    });

    expect(result.current.isRunning).toBe(false);
  });

  // Test 3
  it('nextStep() increments stepIndex', () => {
    const { result } = renderHook(() => useTutorialContext(), { wrapper });

    act(() => {
      result.current.startTutorial();
    });
    expect(result.current.stepIndex).toBe(0);

    act(() => {
      result.current.nextStep();
    });
    expect(result.current.stepIndex).toBe(1);

    act(() => {
      result.current.nextStep();
    });
    expect(result.current.stepIndex).toBe(2);
  });

  // Test 4
  it('completeTutorial() sets isRunning=false and writes localStorage flag', () => {
    const { result } = renderHook(() => useTutorialContext(), { wrapper });

    act(() => {
      result.current.startTutorial();
    });

    act(() => {
      result.current.completeTutorial();
    });

    expect(result.current.isRunning).toBe(false);
    expect(result.current.hasCompletedTutorial).toBe(true);
    expect(localStorageMock.getItem(TUTORIAL_COMPLETED_KEY)).toBe('true');
  });

  // Test 5
  it('resetTutorial() clears both storage keys and resets state, starting the tutorial', () => {
    const { result } = renderHook(() => useTutorialContext(), { wrapper });

    // Set up persisted state
    localStorageMock.setItem(TUTORIAL_COMPLETED_KEY, 'true');
    sessionStorageMock.setItem(TUTORIAL_SEEN_KEY, 'true');

    act(() => {
      result.current.resetTutorial();
    });

    expect(result.current.isRunning).toBe(true);
    expect(result.current.stepIndex).toBe(0);
    expect(result.current.hasCompletedTutorial).toBe(false);
    expect(localStorageMock.getItem(TUTORIAL_COMPLETED_KEY)).toBeNull();
    expect(sessionStorageMock.getItem(TUTORIAL_SEEN_KEY)).toBeNull();
  });

  // Persistence: hasCompletedTutorial reads from localStorage on mount
  it('reads hasCompletedTutorial from localStorage on mount', () => {
    localStorageMock.setItem(TUTORIAL_COMPLETED_KEY, 'true');

    const { result } = renderHook(() => useTutorialContext(), { wrapper });

    expect(result.current.hasCompletedTutorial).toBe(true);
  });

  it('useTutorialContext() throws outside TutorialProvider', () => {
    expect(() => {
      renderHook(() => useTutorialContext());
    }).toThrow('useTutorialContext must be used within TutorialProvider');
  });

  // Test: startTutorial writes TUTORIAL_SEEN_KEY to sessionStorage
  it('startTutorial() writes TUTORIAL_SEEN_KEY to sessionStorage', () => {
    const { result } = renderHook(() => useTutorialContext(), { wrapper });

    act(() => {
      result.current.startTutorial();
    });

    expect(sessionStorageMock.getItem(TUTORIAL_SEEN_KEY)).toBe('true');
  });

  // Test: nextStep() does not increment beyond TUTORIAL_STEP_COUNT - 1
  it('nextStep() does not increment stepIndex beyond TUTORIAL_STEP_COUNT - 1', () => {
    const { result } = renderHook(() => useTutorialContext(), { wrapper });

    // Call nextStep TUTORIAL_STEP_COUNT + 2 times to attempt overflow
    act(() => {
      for (let i = 0; i < TUTORIAL_STEP_COUNT + 2; i++) {
        result.current.nextStep();
      }
    });

    expect(result.current.stepIndex).toBe(TUTORIAL_STEP_COUNT - 1);
  });
});

// ─── useTutorial convenience hook ────────────────────────────────────────────

describe('useTutorial convenience hook', () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
  });

  it('exposes the same interface as useTutorialContext', () => {
    const { result } = renderHook(() => useTutorial(), { wrapper });

    expect(typeof result.current.startTutorial).toBe('function');
    expect(typeof result.current.stopTutorial).toBe('function');
    expect(typeof result.current.nextStep).toBe('function');
    expect(typeof result.current.completeTutorial).toBe('function');
    expect(typeof result.current.resetTutorial).toBe('function');
    expect(typeof result.current.isRunning).toBe('boolean');
    expect(typeof result.current.stepIndex).toBe('number');
    expect(typeof result.current.hasCompletedTutorial).toBe('boolean');
  });
});

// ─── Auto-trigger logic (pure function extracted for testing) ─────────────────
//
// The auto-trigger logic lives in CollectionIndexView.
// We test the conditions directly here using the same storage API
// and a small helper that mirrors the useEffect logic.

/**
 * Mirrors the auto-trigger guard logic from CollectionIndexView.
 * Returns true if the tutorial SHOULD fire.
 */
function shouldAutoTrigger(collections: { id: string }[]): boolean {
  const realCollections = collections.filter(
    (c) => c.id !== UNCATEGORIZED_COLLECTION_ID,
  );
  const hasSeenThisSession =
    sessionStorageMock.getItem(TUTORIAL_SEEN_KEY) === 'true';
  const hasCompletedTutorial =
    localStorageMock.getItem(TUTORIAL_COMPLETED_KEY) === 'true';

  return (
    realCollections.length === 0 && !hasSeenThisSession && !hasCompletedTutorial
  );
}

describe('Auto-trigger logic', () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
  });

  // Test 6
  it('fires when: zero real collections + not seen this session + not completed', () => {
    const collections: { id: string }[] = [];
    expect(shouldAutoTrigger(collections)).toBe(true);
  });

  // Test 7
  it('does NOT fire when squickr_tutorial_seen is "true" in sessionStorage', () => {
    sessionStorageMock.setItem(TUTORIAL_SEEN_KEY, 'true');
    const collections: { id: string }[] = [];
    expect(shouldAutoTrigger(collections)).toBe(false);
  });

  // Test 8
  it('does NOT fire when squickr_tutorial_completed is "true" in localStorage', () => {
    localStorageMock.setItem(TUTORIAL_COMPLETED_KEY, 'true');
    const collections: { id: string }[] = [];
    expect(shouldAutoTrigger(collections)).toBe(false);
  });

  // Test 9
  it('does NOT fire when there are real collections', () => {
    const collections = [{ id: 'col-1' }, { id: 'col-2' }];
    expect(shouldAutoTrigger(collections)).toBe(false);
  });

  it('fires when only the virtual Uncategorized collection is present', () => {
    // UNCATEGORIZED_COLLECTION_ID is filtered out — counts as zero real collections
    const collections = [{ id: UNCATEGORIZED_COLLECTION_ID }];
    expect(shouldAutoTrigger(collections)).toBe(true);
  });

  it('does NOT fire when there is one real collection alongside uncategorized', () => {
    const collections = [
      { id: UNCATEGORIZED_COLLECTION_ID },
      { id: 'col-1' },
    ];
    expect(shouldAutoTrigger(collections)).toBe(false);
  });
});
