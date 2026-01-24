import { useState, useEffect } from 'react';
import { EventStore, CreateTaskHandler, TaskListProjection } from '@squickr/shared';
import type { Task } from '@squickr/shared';
import { TaskInput } from './components/TaskInput';
import { TaskList } from './components/TaskList';

/**
 * Main App Component
 * 
 * This demonstrates the complete CQRS + Event Sourcing flow:
 * - Write Side: TaskInput → CreateTaskHandler → TaskCreated event → EventStore
 * - Read Side: EventStore → TaskListProjection → Task[] → TaskList display
 */
function App() {
  // Initialize event sourcing infrastructure
  const [eventStore] = useState(() => new EventStore());
  const [commandHandler] = useState(() => new CreateTaskHandler(eventStore));
  const [projection] = useState(() => new TaskListProjection(eventStore));
  
  // UI state (derived from projections)
  const [tasks, setTasks] = useState<Task[]>([]);

  // Load tasks on mount and rebuild projection
  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    const allTasks = await projection.getTasks();
    setTasks(allTasks);
  };

  const handleCreateTask = async (title: string) => {
    // Send command (write side)
    await commandHandler.handle({ title });
    
    // Refresh view from projection (read side)
    await loadTasks();
  };

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
        <TaskList tasks={tasks} />

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Event-Sourced • CQRS • TDD • Offline-First PWA</p>
          <p className="mt-1">Built by the AI Agent Team</p>
        </div>
      </div>
    </div>
  );
}

export default App;
