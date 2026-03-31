import { describe, it, expect } from 'vitest';
import { getCompletedTaskBehavior } from './collectionSettings';
import type { CollectionSettings } from '@squickr/domain';
import type { UserPreferences } from '@squickr/domain';
import { DEFAULT_USER_PREFERENCES } from '@squickr/domain';

const defaultPrefs: UserPreferences = DEFAULT_USER_PREFERENCES;

describe('getCompletedTaskBehavior', () => {
  it('returns the new enum value when completedTaskBehavior is set', () => {
    const settings: CollectionSettings = { completedTaskBehavior: 'move-to-bottom' };
    expect(getCompletedTaskBehavior(settings, defaultPrefs)).toBe('move-to-bottom');
  });

  it('returns "collapse" when enum is explicitly "collapse"', () => {
    const settings: CollectionSettings = { completedTaskBehavior: 'collapse' };
    expect(getCompletedTaskBehavior(settings, defaultPrefs)).toBe('collapse');
  });

  it('returns "keep-in-place" when enum is explicitly "keep-in-place"', () => {
    const settings: CollectionSettings = { completedTaskBehavior: 'keep-in-place' };
    expect(getCompletedTaskBehavior(settings, defaultPrefs)).toBe('keep-in-place');
  });

  it('migrates legacy collapseCompleted: true to "collapse"', () => {
    const settings: CollectionSettings = { collapseCompleted: true };
    expect(getCompletedTaskBehavior(settings, defaultPrefs)).toBe('collapse');
  });

  it('migrates legacy collapseCompleted: false to "keep-in-place"', () => {
    const settings: CollectionSettings = { collapseCompleted: false };
    expect(getCompletedTaskBehavior(settings, defaultPrefs)).toBe('keep-in-place');
  });

  it('falls back to userPreferences.defaultCompletedTaskBehavior when settings is undefined', () => {
    const prefs: UserPreferences = { ...defaultPrefs, defaultCompletedTaskBehavior: 'move-to-bottom' };
    expect(getCompletedTaskBehavior(undefined, prefs)).toBe('move-to-bottom');
  });

  it('falls back to userPreferences default when settings has no completed-task fields', () => {
    const settings: CollectionSettings = {};
    const prefs: UserPreferences = { ...defaultPrefs, defaultCompletedTaskBehavior: 'collapse' };
    expect(getCompletedTaskBehavior(settings, prefs)).toBe('collapse');
  });

  it('falls back to userPreferences default when completedTaskBehavior is null (explicit "use global")', () => {
    const settings: CollectionSettings = { completedTaskBehavior: null };
    const prefs: UserPreferences = { ...defaultPrefs, defaultCompletedTaskBehavior: 'move-to-bottom' };
    expect(getCompletedTaskBehavior(settings, prefs)).toBe('move-to-bottom');
  });
});
