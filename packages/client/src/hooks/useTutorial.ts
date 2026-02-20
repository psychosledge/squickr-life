/**
 * useTutorial Hook
 *
 * Convenience wrapper around useTutorialContext.
 * Preferred import for components that just need to interact with
 * the tutorial (vs. the raw context accessor).
 *
 * Usage:
 *   const tutorial = useTutorial();
 *   tutorial.startTutorial();
 */

import { useTutorialContext } from '../context/TutorialContext';

export function useTutorial() {
  return useTutorialContext();
}
