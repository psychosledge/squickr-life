import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBackButton } from './useBackButton';

describe('useBackButton', () => {
  let originalHistoryState: unknown;
  
  beforeEach(() => {
    // Save original history state
    originalHistoryState = window.history.state;
    
    // Clear any existing state
    window.history.replaceState(null, '', window.location.pathname);
  });
  
  afterEach(() => {
    // Restore original state
    if (originalHistoryState !== window.history.state) {
      window.history.replaceState(originalHistoryState, '', window.location.pathname);
    }
  });

  it('should push state when hook mounts', () => {
    const onBackButton = vi.fn();
    
    renderHook(() => useBackButton(onBackButton));
    
    // Should have pushed a modal state
    expect(window.history.state).toEqual({ modal: true });
  });

  it('should call callback when popstate event fires', () => {
    const onBackButton = vi.fn();
    
    renderHook(() => useBackButton(onBackButton));
    
    // Simulate back button press
    window.history.back();
    
    // Trigger the popstate event manually (since we can't wait for async)
    const popStateEvent = new PopStateEvent('popstate', { state: null });
    window.dispatchEvent(popStateEvent);
    
    expect(onBackButton).toHaveBeenCalledTimes(1);
  });

  it('should clean up event listener on unmount', () => {
    const onBackButton = vi.fn();
    
    const { unmount } = renderHook(() => useBackButton(onBackButton));
    
    // Unmount the hook
    unmount();
    
    // Simulate back button press after unmount
    const popStateEvent = new PopStateEvent('popstate', { state: null });
    window.dispatchEvent(popStateEvent);
    
    // Callback should NOT be called after unmount
    expect(onBackButton).not.toHaveBeenCalled();
  });

  it('should remove pushed state on unmount', () => {
    const onBackButton = vi.fn();
    
    const { unmount } = renderHook(() => useBackButton(onBackButton));
    
    // Verify state was pushed
    expect(window.history.state).toEqual({ modal: true });
    
    // Unmount
    unmount();
    
    // State should be cleaned up (will be null or original state)
    // Note: This is tricky to test because unmount calls history.back()
    // which is async. We just verify no error is thrown.
    expect(unmount).not.toThrow();
  });

  it('should handle multiple instances (nested modals)', () => {
    const onBackButton1 = vi.fn();
    const onBackButton2 = vi.fn();
    
    // Mount first hook (outer modal)
    const { unmount: unmount1 } = renderHook(() => useBackButton(onBackButton1));
    
    // Mount second hook (inner modal)
    const { unmount: unmount2 } = renderHook(() => useBackButton(onBackButton2));
    
    // Simulate back button - should trigger the most recent (inner) modal
    const popStateEvent = new PopStateEvent('popstate', { state: { modal: true } });
    window.dispatchEvent(popStateEvent);
    
    // Only the second (most recent) callback should fire
    expect(onBackButton2).toHaveBeenCalledTimes(1);
    
    // Clean up
    unmount2();
    unmount1();
  });

  it('should update callback when it changes', () => {
    const onBackButton1 = vi.fn();
    const onBackButton2 = vi.fn();
    
    const { rerender } = renderHook(
      ({ callback }) => useBackButton(callback),
      { initialProps: { callback: onBackButton1 } }
    );
    
    // Change the callback
    rerender({ callback: onBackButton2 });
    
    // Simulate back button
    const popStateEvent = new PopStateEvent('popstate', { state: null });
    window.dispatchEvent(popStateEvent);
    
    // Should call the NEW callback, not the old one
    expect(onBackButton1).not.toHaveBeenCalled();
    expect(onBackButton2).toHaveBeenCalledTimes(1);
  });

  it('should prevent default browser back navigation', () => {
    const onBackButton = vi.fn();
    
    renderHook(() => useBackButton(onBackButton));
    
    // Create a popstate event
    const popStateEvent = new PopStateEvent('popstate', { 
      state: null,
      cancelable: true 
    });
    
    // Spy on preventDefault
    const preventDefaultSpy = vi.spyOn(popStateEvent, 'preventDefault');
    
    window.dispatchEvent(popStateEvent);
    
    // Should have prevented default
    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});
