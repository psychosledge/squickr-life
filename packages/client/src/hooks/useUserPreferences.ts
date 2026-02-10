/**
 * useUserPreferences Hook
 * 
 * Provides access to user preferences with reactive updates.
 */

import { useState, useEffect } from 'react';
import type { UserPreferences } from '@squickr/domain';
import { DEFAULT_USER_PREFERENCES, UserPreferencesProjection } from '@squickr/domain';
import { useApp } from '../context/AppContext';

/**
 * Hook to access user preferences
 * 
 * Returns the current user preferences and automatically updates when they change.
 * Returns DEFAULT_USER_PREFERENCES if no preferences have been set yet.
 * 
 * @returns UserPreferences with reactive updates
 */
export function useUserPreferences(): UserPreferences {
  const { eventStore } = useApp();
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  
  useEffect(() => {
    const projection = new UserPreferencesProjection(eventStore);
    
    // Initial load
    projection.getUserPreferences().then(setPreferences);
    
    // Subscribe to updates
    const unsubscribe = projection.subscribe(() => {
      projection.getUserPreferences().then(setPreferences);
    });
    
    return () => unsubscribe();
  }, [eventStore]);
  
  return preferences;
}
