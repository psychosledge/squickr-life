/**
 * Test utilities
 * 
 * Shared helpers for testing components that use AppContext.
 */

import { render } from '@testing-library/react';
import { AppProvider } from '../context/AppContext';
import { DEFAULT_USER_PREFERENCES } from '@squickr/domain';
import type { ReactNode, ReactElement } from 'react';
import type { UserPreferences } from '@squickr/domain';
import { vi } from 'vitest';

interface RenderWithProviderOptions {
  userPreferences?: UserPreferences;
}

/**
 * Render a component wrapped in AppProvider for testing
 */
export function renderWithAppProvider(
  ui: ReactNode,
  options: RenderWithProviderOptions = {}
) {
  const mockAppContext = {
    eventStore: {
      append: vi.fn(),
      getAll: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
      initialize: vi.fn().mockResolvedValue(undefined),
    } as any,
    entryProjection: {} as any,
    taskProjection: {} as any,
    collectionProjection: {} as any,
    createCollectionHandler: {} as any,
    restoreCollectionHandler: {} as any,
    migrateTaskHandler: {} as any,
    migrateNoteHandler: {} as any,
    migrateEventHandler: {} as any,
    addTaskToCollectionHandler: {} as any,
    removeTaskFromCollectionHandler: {} as any,
    moveTaskToCollectionHandler: {} as any,
    bulkMigrateEntriesHandler: {} as any,
    userPreferences: options.userPreferences ?? DEFAULT_USER_PREFERENCES,
    isAppReady: true,
  };

  const wrapped = (
    <AppProvider value={mockAppContext}>
      {ui}
    </AppProvider>
  );

  const result = render(wrapped);

  return {
    ...result,
    rerender: (rerenderUi: ReactElement) => {
      result.rerender(
        <AppProvider value={mockAppContext}>
          {rerenderUi}
        </AppProvider>
      );
    },
  };
}
