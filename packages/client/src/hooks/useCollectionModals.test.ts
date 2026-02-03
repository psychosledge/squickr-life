/**
 * Tests for useCollectionModals hook
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCollectionModals } from './useCollectionModals';

describe('useCollectionModals', () => {
  it('should initialize all modal states to false', () => {
    const { result } = renderHook(() => useCollectionModals());

    expect(result.current.isModalOpen).toBe(false);
    expect(result.current.isRenameModalOpen).toBe(false);
    expect(result.current.isDeleteModalOpen).toBe(false);
    expect(result.current.isSettingsModalOpen).toBe(false);
    expect(result.current.isCompletedExpanded).toBe(false);
  });

  it('should open and close the entry input modal', () => {
    const { result } = renderHook(() => useCollectionModals());

    act(() => {
      result.current.openModal();
    });

    expect(result.current.isModalOpen).toBe(true);

    act(() => {
      result.current.closeModal();
    });

    expect(result.current.isModalOpen).toBe(false);
  });

  it('should open and close the rename modal', () => {
    const { result } = renderHook(() => useCollectionModals());

    act(() => {
      result.current.openRenameModal();
    });

    expect(result.current.isRenameModalOpen).toBe(true);

    act(() => {
      result.current.closeRenameModal();
    });

    expect(result.current.isRenameModalOpen).toBe(false);
  });

  it('should open and close the delete modal', () => {
    const { result } = renderHook(() => useCollectionModals());

    act(() => {
      result.current.openDeleteModal();
    });

    expect(result.current.isDeleteModalOpen).toBe(true);

    act(() => {
      result.current.closeDeleteModal();
    });

    expect(result.current.isDeleteModalOpen).toBe(false);
  });

  it('should open and close the settings modal', () => {
    const { result } = renderHook(() => useCollectionModals());

    act(() => {
      result.current.openSettingsModal();
    });

    expect(result.current.isSettingsModalOpen).toBe(true);

    act(() => {
      result.current.closeSettingsModal();
    });

    expect(result.current.isSettingsModalOpen).toBe(false);
  });

  it('should toggle completed tasks expansion', () => {
    const { result } = renderHook(() => useCollectionModals());

    expect(result.current.isCompletedExpanded).toBe(false);

    act(() => {
      result.current.toggleCompletedExpanded();
    });

    expect(result.current.isCompletedExpanded).toBe(true);

    act(() => {
      result.current.toggleCompletedExpanded();
    });

    expect(result.current.isCompletedExpanded).toBe(false);
  });

  it('should handle multiple modals being open simultaneously', () => {
    const { result } = renderHook(() => useCollectionModals());

    act(() => {
      result.current.openModal();
      result.current.openRenameModal();
      result.current.toggleCompletedExpanded();
    });

    expect(result.current.isModalOpen).toBe(true);
    expect(result.current.isRenameModalOpen).toBe(true);
    expect(result.current.isCompletedExpanded).toBe(true);
    expect(result.current.isDeleteModalOpen).toBe(false);
    expect(result.current.isSettingsModalOpen).toBe(false);
  });

  it('should maintain independent state for each modal', () => {
    const { result } = renderHook(() => useCollectionModals());

    // Open delete modal
    act(() => {
      result.current.openDeleteModal();
    });

    expect(result.current.isDeleteModalOpen).toBe(true);
    expect(result.current.isModalOpen).toBe(false);
    expect(result.current.isRenameModalOpen).toBe(false);

    // Close delete modal and open settings modal
    act(() => {
      result.current.closeDeleteModal();
      result.current.openSettingsModal();
    });

    expect(result.current.isDeleteModalOpen).toBe(false);
    expect(result.current.isSettingsModalOpen).toBe(true);
    expect(result.current.isModalOpen).toBe(false);
    expect(result.current.isRenameModalOpen).toBe(false);
  });
});
