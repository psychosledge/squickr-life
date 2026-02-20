/**
 * TutorialContext
 *
 * Manages the state for the react-joyride interactive tutorial.
 * Handles localStorage/sessionStorage persistence for:
 *   - Whether the user has completed the tutorial (localStorage)
 *   - Whether the tutorial has been shown this session (sessionStorage)
 *
 * Part 1 of the v1.0.0 Intro Guide feature.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

// ─── Storage keys ─────────────────────────────────────────────────────────────

export const TUTORIAL_COMPLETED_KEY = 'squickr_tutorial_completed';
export const TUTORIAL_SEEN_KEY = 'squickr_tutorial_seen';

// ─── Step count ───────────────────────────────────────────────────────────────

/** Total number of tutorial steps. Must match TUTORIAL_STEPS.length in App.tsx. */
export const TUTORIAL_STEP_COUNT = 7;

// ─── Types ────────────────────────────────────────────────────────────────────

interface TutorialState {
  isRunning: boolean;
  isPaused: boolean;
  stepIndex: number;
  hasCompletedTutorial: boolean;
}

interface TutorialContextValue extends TutorialState {
  /** Sets isRunning=true, stepIndex=0 and marks session as seen */
  startTutorial: () => void;
  /** Sets isRunning=false without marking complete */
  stopTutorial: () => void;
  /**
   * Pauses the tutorial: sets isRunning=false, isPaused=true.
   * Used for Option A — pause after Step 3 until user enters a collection.
   */
  pauseTutorial: () => void;
  /**
   * Resumes from pause: sets isRunning=true, isPaused=false.
   * Called by CollectionDetailView when user first navigates into a collection.
   */
  resumeTutorial: () => void;
  /** Increments stepIndex by 1 */
  nextStep: () => void;
  /** Sets isRunning=false and persists completed flag to localStorage */
  completeTutorial: () => void;
  /** Clears both storage keys and resets all state */
  resetTutorial: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const TutorialContext = createContext<TutorialContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface TutorialProviderProps {
  children: ReactNode;
}

export function TutorialProvider({ children }: TutorialProviderProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [hasCompletedTutorial, setHasCompletedTutorial] = useState<boolean>(
    () => localStorage.getItem(TUTORIAL_COMPLETED_KEY) === 'true',
  );

  const startTutorial = useCallback(() => {
    setIsRunning(true);
    setIsPaused(false);
    setStepIndex(0);
    sessionStorage.setItem(TUTORIAL_SEEN_KEY, 'true');
  }, []);

  const stopTutorial = useCallback(() => {
    setIsRunning(false);
    setIsPaused(false);
  }, []);

  const pauseTutorial = useCallback(() => {
    setIsRunning(false);
    setIsPaused(true);
  }, []);

  const resumeTutorial = useCallback(() => {
    // Advance past the step we paused on, then resume.
    // When paused after step N, stepIndex is still N. We need to move to N+1
    // so Joyride shows the correct next step on resume.
    setStepIndex((prev) => Math.min(prev + 1, TUTORIAL_STEP_COUNT - 1));
    setIsRunning(true);
    setIsPaused(false);
  }, []);

  const nextStep = useCallback(() => {
    setStepIndex((prev) => Math.min(prev + 1, TUTORIAL_STEP_COUNT - 1));
  }, []);

  const completeTutorial = useCallback(() => {
    setIsRunning(false);
    setIsPaused(false);
    setHasCompletedTutorial(true);
    localStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');
  }, []);

  const resetTutorial = useCallback(() => {
    setIsRunning(true);
    setIsPaused(false);
    setStepIndex(0);
    setHasCompletedTutorial(false);
    localStorage.removeItem(TUTORIAL_COMPLETED_KEY);
    sessionStorage.removeItem(TUTORIAL_SEEN_KEY);
  }, []);

  const value: TutorialContextValue = {
    isRunning,
    isPaused,
    stepIndex,
    hasCompletedTutorial,
    startTutorial,
    stopTutorial,
    pauseTutorial,
    resumeTutorial,
    nextStep,
    completeTutorial,
    resetTutorial,
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Access TutorialContext directly.
 * @throws Error if used outside TutorialProvider
 */
export function useTutorialContext(): TutorialContextValue {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorialContext must be used within TutorialProvider');
  }
  return context;
}
