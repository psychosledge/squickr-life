/**
 * Hook: useCollectionModals
 * 
 * Manages the state of all modals used in the collection detail view.
 * This includes:
 * - Entry input modal (FAB)
 * - Rename collection modal
 * - Delete collection modal
 * - Collection settings modal
 * - Completed tasks expansion state
 * - Confirm complete parent modal (Phase 4)
 */

import { useState } from 'react';

export interface CollectionModalsState {
  // Modal open states
  isModalOpen: boolean;
  isRenameModalOpen: boolean;
  isDeleteModalOpen: boolean;
  isSettingsModalOpen: boolean;
  isCompletedExpanded: boolean;
  isConfirmCompleteParentOpen: boolean; // Phase 4
  confirmCompleteParentData: { // Phase 4
    taskId: string;
    incompleteCount: number;
    onConfirm: () => void;
  } | null;
  
  // Modal control functions
  openModal: () => void;
  closeModal: () => void;
  openRenameModal: () => void;
  closeRenameModal: () => void;
  openDeleteModal: () => void;
  closeDeleteModal: () => void;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  toggleCompletedExpanded: () => void;
  openConfirmCompleteParent: (taskId: string, incompleteCount: number, onConfirm: () => void) => void; // Phase 4
  closeConfirmCompleteParent: () => void; // Phase 4
}

/**
 * Manages all modal states for the collection detail view
 */
export function useCollectionModals(): CollectionModalsState {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false);
  
  // Phase 4: Confirm complete parent modal state
  const [isConfirmCompleteParentOpen, setIsConfirmCompleteParentOpen] = useState(false);
  const [confirmCompleteParentData, setConfirmCompleteParentData] = useState<{
    taskId: string;
    incompleteCount: number;
    onConfirm: () => void;
  } | null>(null);

  return {
    // States
    isModalOpen,
    isRenameModalOpen,
    isDeleteModalOpen,
    isSettingsModalOpen,
    isCompletedExpanded,
    isConfirmCompleteParentOpen,
    confirmCompleteParentData,
    
    // Entry input modal controls
    openModal: () => setIsModalOpen(true),
    closeModal: () => setIsModalOpen(false),
    
    // Rename modal controls
    openRenameModal: () => setIsRenameModalOpen(true),
    closeRenameModal: () => setIsRenameModalOpen(false),
    
    // Delete modal controls
    openDeleteModal: () => setIsDeleteModalOpen(true),
    closeDeleteModal: () => setIsDeleteModalOpen(false),
    
    // Settings modal controls
    openSettingsModal: () => setIsSettingsModalOpen(true),
    closeSettingsModal: () => setIsSettingsModalOpen(false),
    
    // Completed tasks expansion controls
    toggleCompletedExpanded: () => setIsCompletedExpanded(prev => !prev),
    
    // Phase 4: Confirm complete parent controls
    openConfirmCompleteParent: (taskId: string, incompleteCount: number, onConfirm: () => void) => {
      setConfirmCompleteParentData({ taskId, incompleteCount, onConfirm });
      setIsConfirmCompleteParentOpen(true);
    },
    closeConfirmCompleteParent: () => {
      setIsConfirmCompleteParentOpen(false);
      setConfirmCompleteParentData(null);
    },
  };
}
