import { useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark' | 'auto';

export function useDarkMode() {
  // Initialize from localStorage or default to 'auto'
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem('squickr-theme-mode');
      if (stored === 'light' || stored === 'dark' || stored === 'auto') {
        return stored;
      }
    } catch (e) {
      console.warn('Failed to read theme from localStorage:', e);
    }
    return 'auto';
  });

  // Apply dark class to HTML element
  useEffect(() => {
    const applyTheme = () => {
      const isDark = themeMode === 'dark' || 
        (themeMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme();

    // If in auto mode, listen for OS preference changes
    if (themeMode === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme();
      
      // Modern browsers
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      } 
      // Fallback for older browsers
      else {
        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
      }
    }
    
    // Return empty cleanup function when not in auto mode
    return () => {};
  }, [themeMode]);

  // Cycle through modes: light → dark → auto → light
  const cycleThemeMode = () => {
    setThemeMode(current => {
      const next = current === 'light' ? 'dark' : current === 'dark' ? 'auto' : 'light';
      
      // Persist to localStorage
      try {
        localStorage.setItem('squickr-theme-mode', next);
      } catch (e) {
        console.warn('Failed to save theme to localStorage:', e);
      }
      
      return next;
    });
  };

  return { themeMode, cycleThemeMode };
}
