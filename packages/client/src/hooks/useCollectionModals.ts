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
 */

import { useState } from 'react';

export interface CollectionModalsState {
  // Modal open states
  isModalOpen: boolean;
  isRenameModalOpen: boolean;
  isDeleteModalOpen: boolean;
  isSettingsModalOpen: boolean;
  isCompletedExpanded: boolean;
  
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

  return {
    // States
    isModalOpen,
    isRenameModalOpen,
    isDeleteModalOpen,
    isSettingsModalOpen,
    isCompletedExpanded,
    
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
  };
}
