import { useState, useEffect, useRef } from 'react';
import {
  IndexedDBEventStore,
  // Task handlers
  CreateTaskHandler,
  CompleteTaskHandler,
  ReopenTaskHandler,
  DeleteTaskHandler,
  ReorderTaskHandler,
  UpdateTaskTitleHandler,
  // Note handlers
  CreateNoteHandler,
  UpdateNoteContentHandler,
  DeleteNoteHandler,
  ReorderNoteHandler,
  // Event handlers
  CreateEventHandler,
  UpdateEventContentHandler,
  UpdateEventDateHandler,
  DeleteEventHandler,
  ReorderEventHandler,
  // Projection
  EntryListProjection,
  TaskListProjection
} from '@squickr/shared';
import { EntryInput } from './components/EntryInput';
import { DailyLogsView } from './components/DailyLogsView';

/**
 * Main App Component
 * 
 * This demonstrates the complete CQRS + Event Sourcing flow:
 * - Write Side: EntryInput → Handler → Event → IndexedDBEventStore
 * - Read Side: IndexedDBEventStore → EntryListProjection → Entry[] → EntryList display
 * 
 * Supports three entry types: Tasks, Notes, Events
 * Data persists across page refreshes via IndexedDB!
 */
function App() {
  // Initialize event sourcing infrastructure with IndexedDB persistence
  const [eventStore] = useState(() => new IndexedDBEventStore());
  const [entryProjection] = useState(() => new EntryListProjection(eventStore));
  const [taskProjection] = useState(() => new TaskListProjection(eventStore));
  
  // Task handlers
  const [createTaskHandler] = useState(() => new CreateTaskHandler(eventStore, taskProjection, entryProjection));
  const [completeTaskHandler] = useState(() => new CompleteTaskHandler(eventStore, taskProjection));
  const [reopenTaskHandler] = useState(() => new ReopenTaskHandler(eventStore, taskProjection));
  const [deleteTaskHandler] = useState(() => new DeleteTaskHandler(eventStore, taskProjection));
  const [reorderTaskHandler] = useState(() => new ReorderTaskHandler(eventStore, taskProjection, entryProjection));
  const [updateTaskTitleHandler] = useState(() => new UpdateTaskTitleHandler(eventStore, taskProjection));
  
  // Note handlers
  const [createNoteHandler] = useState(() => new CreateNoteHandler(eventStore, entryProjection));
  const [updateNoteContentHandler] = useState(() => new UpdateNoteContentHandler(eventStore, entryProjection));
  const [deleteNoteHandler] = useState(() => new DeleteNoteHandler(eventStore, entryProjection));
  const [reorderNoteHandler] = useState(() => new ReorderNoteHandler(eventStore, entryProjection, entryProjection));
  
  // Event handlers
  const [createEventHandler] = useState(() => new CreateEventHandler(eventStore, entryProjection));
  const [updateEventContentHandler] = useState(() => new UpdateEventContentHandler(eventStore, entryProjection));
  const [updateEventDateHandler] = useState(() => new UpdateEventDateHandler(eventStore, entryProjection));
  const [deleteEventHandler] = useState(() => new DeleteEventHandler(eventStore, entryProjection));
  const [reorderEventHandler] = useState(() => new ReorderEventHandler(eventStore, entryProjection, entryProjection));
  
  // UI state (for loading indicator only)
  const [isLoading, setIsLoading] = useState(true);
  
  // Track if app is initialized (prevents double-init in React StrictMode)
  const isInitialized = useRef(false);

  // Initialize IndexedDB and load tasks on mount
  useEffect(() => {
    // Prevent double initialization in React StrictMode (dev mode)
    if (isInitialized.current) {
      return;
    }
    isInitialized.current = true;
    
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize IndexedDB connection
      await eventStore.initialize();
    } catch (error) {
      console.error('Failed to initialize app:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Task handlers
  const handleCreateTask = async (title: string) => {
    await createTaskHandler.handle({ title });
  };

  const handleCompleteTask = async (taskId: string) => {
    await completeTaskHandler.handle({ taskId });
  };

  const handleReopenTask = async (taskId: string) => {
    await reopenTaskHandler.handle({ taskId });
  };

  const handleUpdateTaskTitle = async (taskId: string, newTitle: string) => {
    await updateTaskTitleHandler.handle({ taskId, title: newTitle });
  };

  // Note handlers
  const handleCreateNote = async (content: string) => {
    await createNoteHandler.handle({ content });
  };

  const handleUpdateNoteContent = async (noteId: string, newContent: string) => {
    await updateNoteContentHandler.handle({ noteId, content: newContent });
  };

  // Event handlers
  const handleCreateEvent = async (content: string, eventDate?: string) => {
    await createEventHandler.handle({ content, eventDate });
  };

  const handleUpdateEventContent = async (eventId: string, newContent: string) => {
    await updateEventContentHandler.handle({ eventId, content: newContent });
  };

  const handleUpdateEventDate = async (eventId: string, newDate: string | null) => {
    await updateEventDateHandler.handle({ eventId, eventDate: newDate });
  };

  // Common handlers
  const handleDelete = async (entryId: string) => {
    // Find the entry to determine its type
    const entries = await entryProjection.getEntries('all');
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    if (entry.type === 'task') {
      await deleteTaskHandler.handle({ taskId: entryId });
    } else if (entry.type === 'note') {
      await deleteNoteHandler.handle({ noteId: entryId });
    } else if (entry.type === 'event') {
      await deleteEventHandler.handle({ eventId: entryId });
    }
  };

  const handleReorder = async (
    entryId: string,
    previousEntryId: string | null,
    nextEntryId: string | null
  ) => {
    // Find the entry to determine its type
    const entries = await entryProjection.getEntries('all');
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    if (entry.type === 'task') {
      await reorderTaskHandler.handle({ taskId: entryId, previousTaskId: previousEntryId, nextTaskId: nextEntryId });
    } else if (entry.type === 'note') {
      await reorderNoteHandler.handle({ noteId: entryId, previousNoteId: previousEntryId, nextNoteId: nextEntryId });
    } else if (entry.type === 'event') {
      await reorderEventHandler.handle({ eventId: entryId, previousEventId: previousEntryId, nextEventId: nextEntryId });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Squickr Life
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Get shit done quicker with Squickr!
          </p>
        </div>

        {/* Entry Input (Write Side) */}
        <EntryInput 
          onSubmitTask={handleCreateTask}
          onSubmitNote={handleCreateNote}
          onSubmitEvent={handleCreateEvent}
        />

        {/* Daily Logs View (Read Side - Reactive Updates) */}
        <DailyLogsView
          projection={entryProjection}
          onCompleteTask={handleCompleteTask}
          onReopenTask={handleReopenTask}
          onUpdateTaskTitle={handleUpdateTaskTitle}
          onUpdateNoteContent={handleUpdateNoteContent}
          onUpdateEventContent={handleUpdateEventContent}
          onUpdateEventDate={handleUpdateEventDate}
          onDelete={handleDelete}
          onReorder={handleReorder}
        />

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Event-Sourced • CQRS • TDD • Offline-First PWA</p>
          <p className="mt-1">✓ Data persists with IndexedDB</p>
          <p className="mt-1">Built by the AI Agent Team</p>
        </div>
      </div>
    </div>
  );
}

export default App;
