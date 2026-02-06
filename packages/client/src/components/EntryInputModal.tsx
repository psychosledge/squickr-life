import { useEffect, useRef } from 'react';
import { EntryInput } from './EntryInput';

interface EntryInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitTask: (title: string) => Promise<void>;
  onSubmitNote: (content: string) => Promise<void>;
  onSubmitEvent: (content: string, eventDate?: string) => Promise<void>;
}

export function EntryInputModal({
  isOpen,
  onClose,
  onSubmitTask,
  onSubmitNote,
  onSubmitEvent
}: EntryInputModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus input when modal opens (after animation)
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        const input = modalRef.current?.querySelector('input');
        input?.focus();
      }, 350);
      
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
    return undefined;
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
    return undefined;
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop - clicks do NOT close modal */}
      <div 
        className={`
          fixed inset-0 bg-black/40 z-[100]
          transition-opacity duration-200
          ${isOpen ? 'opacity-100' : 'opacity-0'}
        `}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`
          fixed bottom-0 left-0 right-0
          md:top-1/2 md:-translate-y-1/2 md:bottom-auto
          md:left-1/2 md:-translate-x-1/2
          md:max-w-2xl md:w-full
          bg-white dark:bg-gray-800
          rounded-t-2xl md:rounded-2xl
          shadow-2xl
          z-[101]
          max-h-[90vh] overflow-y-auto
          transition-transform duration-300 ease-out
          ${isOpen ? 'translate-y-0' : 'translate-y-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 p-6 pb-4">
          <h2 
            id="modal-title"
            className="text-lg font-semibold text-gray-900 dark:text-white"
          >
            Add Entry
          </h2>
          <button
            onClick={onClose}
            className="
              p-2 -m-2
              text-gray-500 dark:text-gray-400
              hover:text-gray-700 dark:hover:text-gray-200
              hover:bg-gray-100 dark:hover:bg-gray-700
              rounded-lg
              transition-colors
              focus:outline-none focus:ring-2 focus:ring-blue-500
            "
            aria-label="Close modal"
            type="button"
          >
            <svg 
              className="w-6 h-6" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                d="M6 18L18 6M6 6l12 12" 
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 pt-4">
          <EntryInput
            variant="modal"
            onSubmitTask={onSubmitTask}
            onSubmitNote={onSubmitNote}
            onSubmitEvent={onSubmitEvent}
            onSuccess={onClose}
          />
        </div>
      </div>
    </>
  );
}
