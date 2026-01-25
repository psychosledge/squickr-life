import { useState, useEffect, useRef } from 'react';
import { 
  IndexedDBEventStore, 
  CreateTaskHandler, 
  CompleteTaskHandler,
  ReopenTaskHandler,
  DeleteTaskHandler,
  TaskListProjection 
} from '@squickr/shared';
import type { Task } from '@squickr/shared';
import { TaskInput } from './components/TaskInput';
import { TaskList } from './components/TaskList';

/**
 * Main App Component
 * 
 * This demonstrates the complete CQRS + Event Sourcing flow:
 * - Write Side: TaskInput → CreateTaskHandler → TaskCreated event → IndexedDBEventStore
 * - Read Side: IndexedDBEventStore → TaskListProjection → Task[] → TaskList display
 * 
 * Data persists across page refreshes via IndexedDB!
 */
function App() {
  // Initialize event sourcing infrastructure with IndexedDB persistence
  const [eventStore] = useState(() => new IndexedDBEventStore());
  const [projection] = useState(() => new TaskListProjection(eventStore));
  const [createTaskHandler] = useState(() => new CreateTaskHandler(eventStore));
  const [completeTaskHandler] = useState(() => new CompleteTaskHandler(eventStore, projection));
  const [reopenTaskHandler] = useState(() => new ReopenTaskHandler(eventStore, projection));
  const [deleteTaskHandler] = useState(() => new DeleteTaskHandler(eventStore, projection));
  
  // UI state (derived from projections)
  const [tasks, setTasks] = useState<Task[]>([]);
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
      
      // Load existing tasks from persisted events
      await loadTasks();
    } catch (error) {
      console.error('Failed to initialize app:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTasks = async () => {
    const allTasks = await projection.getTasks();
    setTasks(allTasks);
  };

  const handleCreateTask = async (title: string) => {
    // Send command (write side)
    await createTaskHandler.handle({ title });
    
    // Refresh view from projection (read side)
    await loadTasks();
  };

  const handleCompleteTask = async (taskId: string) => {
    // Send command (write side)
    await completeTaskHandler.handle({ taskId });
    
    // Refresh view from projection (read side)
    await loadTasks();
  };

  const handleReopenTask = async (taskId: string) => {
    // Send command (write side)
    await reopenTaskHandler.handle({ taskId });
    
    // Refresh view from projection (read side)
    await loadTasks();
  };

  const handleDeleteTask = async (taskId: string) => {
    // Send command (write side)
    await deleteTaskHandler.handle({ taskId });
    
    // Refresh view from projection (read side)
    await loadTasks();
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

        {/* Task Input (Write Side) */}
        <TaskInput onSubmit={handleCreateTask} />

        {/* Task List (Read Side) */}
        <TaskList 
          tasks={tasks} 
          onComplete={handleCompleteTask}
          onReopen={handleReopenTask}
          onDelete={handleDeleteTask}
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
