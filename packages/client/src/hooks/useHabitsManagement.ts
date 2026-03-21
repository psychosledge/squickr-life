/**
 * Hook: useHabitsManagement
 *
 * Provides async wrapper functions for all 8 habit command handlers sourced
 * from AppContext. Consumers call these functions directly without needing
 * to know which handler each command maps to.
 */

import { useApp } from '../context/AppContext';
import type {
  CreateHabitCommand,
  UpdateHabitTitleCommand,
  UpdateHabitFrequencyCommand,
  CompleteHabitCommand,
  RevertHabitCompletionCommand,
  ArchiveHabitCommand,
  RestoreHabitCommand,
  ReorderHabitCommand,
} from '@squickr/domain';

export interface HabitsManagement {
  createHabit: (cmd: CreateHabitCommand) => Promise<void>;
  updateHabitTitle: (cmd: UpdateHabitTitleCommand) => Promise<void>;
  updateHabitFrequency: (cmd: UpdateHabitFrequencyCommand) => Promise<void>;
  completeHabit: (cmd: CompleteHabitCommand) => Promise<void>;
  revertHabitCompletion: (cmd: RevertHabitCompletionCommand) => Promise<void>;
  archiveHabit: (cmd: ArchiveHabitCommand) => Promise<void>;
  restoreHabit: (cmd: RestoreHabitCommand) => Promise<void>;
  reorderHabit: (cmd: ReorderHabitCommand) => Promise<void>;
}

export function useHabitsManagement(): HabitsManagement {
  const {
    createHabitHandler,
    updateHabitTitleHandler,
    updateHabitFrequencyHandler,
    completeHabitHandler,
    revertHabitCompletionHandler,
    archiveHabitHandler,
    restoreHabitHandler,
    reorderHabitHandler,
  } = useApp();

  return {
    createHabit: async (cmd) => { await createHabitHandler.handle(cmd); },
    updateHabitTitle: (cmd) => updateHabitTitleHandler.handle(cmd),
    updateHabitFrequency: (cmd) => updateHabitFrequencyHandler.handle(cmd),
    completeHabit: (cmd) => completeHabitHandler.handle(cmd),
    revertHabitCompletion: (cmd) => revertHabitCompletionHandler.handle(cmd),
    archiveHabit: (cmd) => archiveHabitHandler.handle(cmd),
    restoreHabit: (cmd) => restoreHabitHandler.handle(cmd),
    reorderHabit: (cmd) => reorderHabitHandler.handle(cmd),
  };
}
