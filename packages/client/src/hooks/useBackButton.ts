import { useEffect, useRef } from 'react';

/**
 * useBackButton Hook
 * 
 * Manages browser back button behavior for modals and views.
 * Pushes a history state when the component mounts and listens for
 * popstate events to handle back button presses.
 * 
 * When the back button is pressed, it calls the provided callback
 * instead of navigating away from the app.
 * 
 * Usage:
 * ```tsx
 * // In a modal component
 * useBackButton(() => setIsOpen(false));
 * 
 * // In a detail view
 * useBackButton(() => navigate('/'));
 * ```
 * 
 * @param onBackButton - Callback to execute when back button is pressed
 */
export function useBackButton(onBackButton: () => void) {
  // Use ref to always have the latest callback without re-registering listener
  const callbackRef = useRef(onBackButton);
  
  // Update ref when callback changes
  useEffect(() => {
    callbackRef.current = onBackButton;
  }, [onBackButton]);
  
  useEffect(() => {
    // Push a new history state when component mounts
    window.history.pushState({ modal: true }, '');
    
    // Handler for popstate event (back button pressed)
    const handlePopState = (event: PopStateEvent) => {
      event.preventDefault();
      
      // Call the current callback
      callbackRef.current();
    };
    
    // Register the event listener
    window.addEventListener('popstate', handlePopState);
    
    // Cleanup on unmount
    return () => {
      window.removeEventListener('popstate', handlePopState);
      
      // Remove the state we pushed (if it's still there)
      if (window.history.state?.modal) {
        window.history.back();
      }
    };
  }, []); // Empty deps - only run on mount/unmount
}
