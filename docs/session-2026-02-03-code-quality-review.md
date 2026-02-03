# Session 7: Comprehensive Code Quality Review & Improvements

**Date:** February 3, 2026  
**Status:** 📋 PLANNED  
**Goal:** Address technical debt identified by Casey's comprehensive code review

---

## 🔍 Casey's Comprehensive Code Review

**Overall Code Quality Rating:** 7.5/10

**Strengths:**
- ✅ Excellent test coverage (772 tests passing across 48 test files)
- ✅ Good use of TypeScript for type safety
- ✅ Clean separation of concerns (projections, handlers, components)
- ✅ Strong accessibility foundation (ARIA labels, roles)
- ✅ Well-documented code with clear comments

**Areas for Improvement:**
- ❌ Large files approaching line limits
- ❌ Missing drag-and-drop test coverage
- ❌ Some performance optimization opportunities
- ❌ Console.log statements in production code
- ❌ Handler initialization patterns could be extracted

---

## 📋 Implementation Plan

### Phase 1: Quick Wins (1-2 hours total)

#### Task 1.1: Extract Handler Initialization with useMemo
**File:** `packages/client/src/views/CollectionDetailView.tsx` (lines 66-86)  
**Priority:** 🔴 HIGH  
**Effort:** 30 minutes  
**Issue:** 17 handler instances recreated on every render (performance anti-pattern)

**Current Code (Anti-pattern):**
```typescript
export function CollectionDetailView() {
  // ❌ These are recreated on EVERY render
  const createTaskHandler = new CreateTaskHandler(eventStore, taskProjection, entryProjection);
  const createNoteHandler = new CreateNoteHandler(eventStore, entryProjection);
  // ... 15 more handlers
}
```

**Fix:**
```typescript
export function CollectionDetailView() {
  const handlers = useMemo(() => ({
    createTask: new CreateTaskHandler(eventStore, taskProjection, entryProjection),
    createNote: new CreateNoteHandler(eventStore, entryProjection),
    updateTask: new UpdateTaskHandler(eventStore, taskProjection, entryProjection),
    updateNote: new UpdateNoteHandler(eventStore, entryProjection),
    updateEvent: new UpdateEventHandler(eventStore, entryProjection),
    deleteTask: new DeleteTaskHandler(eventStore, taskProjection, entryProjection),
    deleteNote: new DeleteNoteHandler(eventStore, entryProjection),
    deleteEvent: new DeleteEventHandler(eventStore, entryProjection),
    completeTask: new CompleteTaskHandler(eventStore, taskProjection, entryProjection),
    uncompleteTask: new UncompleteTaskHandler(eventStore, taskProjection, entryProjection),
    migrateTask: new MigrateTaskHandler(eventStore, taskProjection, entryProjection),
    migrateNote: new MigrateNoteHandler(eventStore, entryProjection),
    migrateEvent: new MigrateEventHandler(eventStore, entryProjection),
    renameCollection: new RenameCollectionHandler(eventStore, collectionProjection),
    deleteCollection: new DeleteCollectionHandler(eventStore, collectionProjection, taskProjection, entryProjection),
    reorderEntry: new ReorderEntryHandler(eventStore, entryProjection),
    updateCollectionSettings: new UpdateCollectionSettingsHandler(eventStore, collectionProjection),
  }), [eventStore, taskProjection, entryProjection, collectionProjection]);
}
```

**Benefits:**
- Prevents unnecessary object allocation
- Avoids potential memory leaks
- Prevents child component re-renders

---

#### Task 1.2: Optimize Drag Sensor Creation
**File:** `packages/client/src/components/EntryList.tsx` (lines 53-68)  
**Priority:** 🟡 MEDIUM  
**Effort:** 15 minutes  
**Issue:** Sensor configuration recreated on every render

**Current Code:**
```typescript
export function EntryList({ entries, onReorder, ... }: EntryListProps) {
  // ❌ Recreated on EVERY render
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
}
```

**Fix:**
```typescript
const mouseSensor = useSensor(MouseSensor, {
  activationConstraint: { distance: 8 },
});
const touchSensor = useSensor(TouchSensor, {
  activationConstraint: { delay: 250, tolerance: 5 },
});
const keyboardSensor = useSensor(KeyboardSensor, {
  coordinateGetter: sortableKeyboardCoordinates,
});

const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);
```

**Note:** Apply same fix to `HierarchicalCollectionList.tsx`

---

#### Task 1.3: Replace Console Statements with Logger Utility
**Files:** Multiple (36 instances across codebase)  
**Priority:** 🔴 HIGH  
**Effort:** 30 minutes  

**Issues Found:**
- `packages/client/src/firebase/syncEvents.ts`: 14 console.log statements (lines 31-221)
- `packages/client/src/firebase/config.ts`: console.log/error (lines 59-61)
- `packages/client/src/App.tsx`: console.log statements (lines 85-98)
- `packages/shared/src/task.projections.ts`: console.warn (lines 151-224)

**Problems:**
- Exposes internal logic to users via browser console
- Performance overhead in production
- Makes debugging harder (noise in console)

**Solution:**

**Step 1: Create Logger Utility**
```typescript
// packages/client/src/utils/logger.ts
const isDevelopment = import.meta.env.DEV;

export const logger = {
  debug: (message: string, ...args: any[]) => {
    if (isDevelopment) console.log(`[DEBUG] ${message}`, ...args);
  },
  info: (message: string, ...args: any[]) => {
    if (isDevelopment) console.log(`[INFO] ${message}`, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
};
```

**Step 2: Replace All Console Statements**
- Replace `console.log` → `logger.debug`
- Replace `console.warn` → `logger.warn`
- Replace `console.error` → `logger.error`
- Keep errors and warnings visible in production
- Hide debug/info logs in production

---

#### Task 1.4: Extract Duplicate Drag Handle Component
**Files:** 
- `packages/client/src/components/SortableEntryItem.tsx` (lines 68-96)
- `packages/client/src/components/SortableCollectionItem.tsx` (lines 38-67)
- `packages/client/src/components/CollectionTreeNode.tsx` (lines 110-140)

**Priority:** 🟢 LOW  
**Effort:** 30 minutes  
**Issue:** Identical drag handle SVG and styling repeated in 3 files (29 lines each)

**Solution:**

**Step 1: Create Shared Component**
```typescript
// packages/client/src/components/DragHandle.tsx
interface DragHandleProps {
  attributes?: any;
  listeners?: any;
  className?: string;
}

export function DragHandle({ attributes, listeners, className = '' }: DragHandleProps) {
  return (
    <div
      {...attributes}
      {...listeners}
      className={`
        absolute right-2 top-1/2 -translate-y-1/2
        md:right-auto md:left-0 md:-translate-x-8
        w-12 h-12 md:w-8 md:h-8 
        flex items-center justify-center
        text-gray-500 dark:text-gray-400
        cursor-grab active:cursor-grabbing
        opacity-100 md:opacity-30 
        md:group-hover:opacity-100
        transition-all duration-200
        ${className}
      `}
      style={{ touchAction: 'none' }}
      aria-label="Drag to reorder"
      title="Drag to reorder"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="w-6 h-6 md:w-5 md:h-5"
      >
        <path d="M7 2a1 1 0 011 1v2a1 1 0 11-2 0V3a1 1 0 011-1zM14 12a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1zM7 8a1 1 0 011 1v2a1 1 0 11-2 0V9a1 1 0 011-1zM14 6a1 1 0 011 1v2a1 1 0 11-2 0V7a1 1 0 011-1zM7 14a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1zM14 2a1 1 0 011 1v2a1 1 0 11-2 0V3a1 1 0 011-1z" />
      </svg>
    </div>
  );
}
```

**Step 2: Replace in All Files**
```typescript
// Before
<div {...attributes} {...listeners} className="..." ...>
  <svg>...</svg>
</div>

// After
import { DragHandle } from './DragHandle';
<DragHandle attributes={attributes} listeners={listeners} />
```

**Step 3: Add Tests**
```typescript
// packages/client/src/components/DragHandle.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DragHandle } from './DragHandle';

describe('DragHandle', () => {
  it('should render with proper accessibility attributes', () => {
    render(<DragHandle />);
    
    const handle = screen.getByLabelText('Drag to reorder');
    expect(handle).toBeInTheDocument();
    expect(handle).toHaveAttribute('title', 'Drag to reorder');
  });

  it('should apply custom className', () => {
    const { container } = render(<DragHandle className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should pass attributes and listeners to container', () => {
    const attributes = { 'data-test': 'handle' };
    const listeners = { onPointerDown: vi.fn() };
    
    const { container } = render(
      <DragHandle attributes={attributes} listeners={listeners} />
    );
    
    expect(container.firstChild).toHaveAttribute('data-test', 'handle');
  });

  it('should have touch-action none for mobile drag', () => {
    const { container } = render(<DragHandle />);
    expect(container.firstChild).toHaveStyle({ touchAction: 'none' });
  });
});
```

---

### Phase 2: High-Impact Refactoring (2-3 hours)

#### Task 2.1: Refactor CollectionDetailView into Custom Hooks
**File:** `packages/client/src/views/CollectionDetailView.tsx` (479 lines)  
**Priority:** 🔴 HIGH  
**Effort:** 2-3 hours  
**Issue:** File approaching 500-line threshold, hard to maintain

**Current Structure:**
- Lines 66-86: Handler initialization (17 handlers)
- Lines 56-64: 8 separate state variables (modals)
- Lines 146-302: 9 separate handler functions (5-20 lines each)

**Solution: Extract into 3 Custom Hooks**

**Hook 1: useCollectionHandlers.ts**
```typescript
// packages/client/src/hooks/useCollectionHandlers.ts
import { useMemo } from 'react';
import { EventStore } from '@squickr/shared';
import { 
  TaskProjection, 
  EntryProjection, 
  CollectionProjection 
} from '@squickr/shared';
import {
  CreateTaskHandler,
  CreateNoteHandler,
  UpdateTaskHandler,
  // ... all other handlers
} from '@squickr/shared';

export function useCollectionHandlers(
  eventStore: EventStore,
  taskProjection: TaskProjection,
  entryProjection: EntryProjection,
  collectionProjection: CollectionProjection
) {
  return useMemo(() => ({
    createTask: new CreateTaskHandler(eventStore, taskProjection, entryProjection),
    createNote: new CreateNoteHandler(eventStore, entryProjection),
    updateTask: new UpdateTaskHandler(eventStore, taskProjection, entryProjection),
    updateNote: new UpdateNoteHandler(eventStore, entryProjection),
    updateEvent: new UpdateEventHandler(eventStore, entryProjection),
    deleteTask: new DeleteTaskHandler(eventStore, taskProjection, entryProjection),
    deleteNote: new DeleteNoteHandler(eventStore, entryProjection),
    deleteEvent: new DeleteEventHandler(eventStore, entryProjection),
    completeTask: new CompleteTaskHandler(eventStore, taskProjection, entryProjection),
    uncompleteTask: new UncompleteTaskHandler(eventStore, taskProjection, entryProjection),
    migrateTask: new MigrateTaskHandler(eventStore, taskProjection, entryProjection),
    migrateNote: new MigrateNoteHandler(eventStore, entryProjection),
    migrateEvent: new MigrateEventHandler(eventStore, entryProjection),
    renameCollection: new RenameCollectionHandler(eventStore, collectionProjection),
    deleteCollection: new DeleteCollectionHandler(
      eventStore,
      collectionProjection,
      taskProjection,
      entryProjection
    ),
    reorderEntry: new ReorderEntryHandler(eventStore, entryProjection),
    updateCollectionSettings: new UpdateCollectionSettingsHandler(
      eventStore,
      collectionProjection
    ),
  }), [eventStore, taskProjection, entryProjection, collectionProjection]);
}
```

**Hook 2: useCollectionModals.ts**
```typescript
// packages/client/src/hooks/useCollectionModals.ts
import { useState, useCallback } from 'react';

export type ModalType = 
  | 'create-task'
  | 'create-note' 
  | 'create-event'
  | 'rename'
  | 'delete'
  | 'migrate'
  | 'settings';

interface ModalState {
  isOpen: boolean;
  type: ModalType | null;
  data?: any;
}

export function useCollectionModals() {
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    type: null,
  });

  const openModal = useCallback((type: ModalType, data?: any) => {
    setModalState({ isOpen: true, type, data });
  }, []);

  const closeModal = useCallback(() => {
    setModalState({ isOpen: false, type: null, data: undefined });
  }, []);

  return {
    isOpen: modalState.isOpen,
    modalType: modalState.type,
    modalData: modalState.data,
    openModal,
    closeModal,
  };
}
```

**Hook 3: useEntryOperations.ts**
```typescript
// packages/client/src/hooks/useEntryOperations.ts
import { useCallback } from 'react';
import { Entry, Task, Note, EventEntry } from '@squickr/shared';

interface EntryOperationsProps {
  handlers: ReturnType<typeof useCollectionHandlers>;
  collectionId: string;
  entries: Entry[];
  onEntryCreated?: () => void;
  onEntryUpdated?: () => void;
  onEntryDeleted?: () => void;
}

export function useEntryOperations({
  handlers,
  collectionId,
  entries,
  onEntryCreated,
  onEntryUpdated,
  onEntryDeleted,
}: EntryOperationsProps) {
  const handleCreateTask = useCallback(
    async (title: string) => {
      const lastEntry = entries[entries.length - 1];
      const previousEntryId = lastEntry?.id || null;

      await handlers.createTask.handle({
        title,
        collectionId,
        previousEntryId,
        nextEntryId: null,
      });

      onEntryCreated?.();
    },
    [handlers.createTask, collectionId, entries, onEntryCreated]
  );

  const handleCreateNote = useCallback(
    async (content: string) => {
      const lastEntry = entries[entries.length - 1];
      const previousEntryId = lastEntry?.id || null;

      await handlers.createNote.handle({
        content,
        collectionId,
        previousEntryId,
        nextEntryId: null,
      });

      onEntryCreated?.();
    },
    [handlers.createNote, collectionId, entries, onEntryCreated]
  );

  const handleUpdateTask = useCallback(
    async (task: Task, updates: { title: string }) => {
      await handlers.updateTask.handle({
        id: task.id,
        title: updates.title,
      });

      onEntryUpdated?.();
    },
    [handlers.updateTask, onEntryUpdated]
  );

  const handleUpdateNote = useCallback(
    async (note: Note, updates: { content: string }) => {
      await handlers.updateNote.handle({
        id: note.id,
        content: updates.content,
      });

      onEntryUpdated?.();
    },
    [handlers.updateNote, onEntryUpdated]
  );

  const handleCompleteTask = useCallback(
    async (taskId: string) => {
      await handlers.completeTask.handle({ id: taskId });
      onEntryUpdated?.();
    },
    [handlers.completeTask, onEntryUpdated]
  );

  const handleUncompleteTask = useCallback(
    async (taskId: string) => {
      await handlers.uncompleteTask.handle({ id: taskId });
      onEntryUpdated?.();
    },
    [handlers.uncompleteTask, onEntryUpdated]
  );

  const handleDeleteEntry = useCallback(
    async (entry: Entry) => {
      if (entry.type === 'task') {
        await handlers.deleteTask.handle({ id: entry.id });
      } else if (entry.type === 'note') {
        await handlers.deleteNote.handle({ id: entry.id });
      } else if (entry.type === 'event') {
        await handlers.deleteEvent.handle({ id: entry.id });
      }

      onEntryDeleted?.();
    },
    [handlers, onEntryDeleted]
  );

  const handleReorderEntry = useCallback(
    async (entryId: string, previousEntryId: string | null, nextEntryId: string | null) => {
      await handlers.reorderEntry.handle({
        id: entryId,
        previousEntryId,
        nextEntryId,
      });
    },
    [handlers.reorderEntry]
  );

  return {
    handleCreateTask,
    handleCreateNote,
    handleUpdateTask,
    handleUpdateNote,
    handleCompleteTask,
    handleUncompleteTask,
    handleDeleteEntry,
    handleReorderEntry,
  };
}
```

**Updated CollectionDetailView.tsx (Reduced to ~200 lines)**
```typescript
export function CollectionDetailView() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();
  
  // Projections
  const eventStore = useEventStore();
  const collectionProjection = useCollectionProjection();
  const taskProjection = useTaskProjection();
  const entryProjection = useEntryProjection();

  // State
  const [collection, setCollection] = useState<Collection | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Custom hooks (extracted complexity)
  const handlers = useCollectionHandlers(
    eventStore,
    taskProjection,
    entryProjection,
    collectionProjection
  );

  const { isOpen, modalType, modalData, openModal, closeModal } = useCollectionModals();

  const entryOps = useEntryOperations({
    handlers,
    collectionId: collectionId!,
    entries,
    onEntryCreated: () => loadData(),
    onEntryUpdated: () => loadData(),
    onEntryDeleted: () => loadData(),
  });

  // Data loading (same as before)
  const loadData = useCallback(async () => {
    if (!collectionId) return;
    
    setIsLoading(true);
    const [coll, ents] = await Promise.all([
      collectionProjection.getCollection(collectionId),
      entryProjection.getEntriesByCollection(collectionId),
    ]);
    
    setCollection(coll);
    setEntries(ents);
    setIsLoading(false);
  }, [collectionId, collectionProjection, entryProjection]);

  useEffect(() => {
    loadData();
    
    const unsubscribeCollection = collectionProjection.subscribe(loadData);
    const unsubscribeEntry = entryProjection.subscribe(loadData);
    
    return () => {
      unsubscribeCollection();
      unsubscribeEntry();
    };
  }, [collectionId, collectionProjection, entryProjection, loadData]);

  if (isLoading) return <div>Loading...</div>;
  if (!collection) return <div>Collection not found</div>;

  return (
    <div className="flex flex-col h-screen">
      <CollectionHeader
        collection={collection}
        onRename={() => openModal('rename')}
        onDelete={() => openModal('delete')}
        onSettings={() => openModal('settings')}
      />

      <EntryList
        entries={entries}
        onComplete={entryOps.handleCompleteTask}
        onUncomplete={entryOps.handleUncompleteTask}
        onDelete={entryOps.handleDeleteEntry}
        onReorder={entryOps.handleReorderEntry}
        collapseCompleted={collection.settings?.collapseCompletedTasks}
      />

      {/* FAB buttons */}
      <FloatingActionButtons
        onCreateTask={() => openModal('create-task')}
        onCreateNote={() => openModal('create-note')}
        onCreateEvent={() => openModal('create-event')}
      />

      {/* Modals */}
      {isOpen && modalType === 'create-task' && (
        <CreateTaskModal
          onSubmit={entryOps.handleCreateTask}
          onClose={closeModal}
        />
      )}
      
      {/* ... other modals */}
    </div>
  );
}
```

**Testing Strategy:**
1. Write tests for `useCollectionHandlers.ts` (5-8 tests)
2. Write tests for `useCollectionModals.ts` (5-8 tests)
3. Write tests for `useEntryOperations.ts` (10-15 tests)
4. Update existing `CollectionDetailView.test.tsx` to work with new structure

**Expected Results:**
- CollectionDetailView: 479 lines → ~200 lines
- 3 new reusable hooks
- Better testability
- Improved performance (memoization)

---

### Phase 3: Test Coverage Improvements (2-3 hours)

#### Task 3.1: Add Comprehensive Drag-and-Drop Tests
**Files:** 
- `packages/client/src/components/EntryList.tsx`
- `packages/client/src/components/HierarchicalCollectionList.tsx`

**Priority:** 🔴 HIGH  
**Effort:** 2-3 hours  
**Issue:** Critical drag-and-drop functionality has ZERO test coverage

**Current Gap:**
- EntryList.tsx lines 70-99: `handleDragEnd` logic UNTESTED
- HierarchicalCollectionList.tsx: Drag behavior UNTESTED
- Fractional index calculation during reordering UNTESTED
- Section constraints (cannot drag between sections) UNTESTED

**Solution:**

**Test File 1: EntryList.test.tsx (Add to existing file)**
```typescript
describe('EntryList - Drag and Drop', () => {
  const mockOnReorder = vi.fn();
  
  const createEntries = () => [
    { id: 'task-1', type: 'task', title: 'Task 1', order: 'a0', ... },
    { id: 'task-2', type: 'task', title: 'Task 2', order: 'a1', ... },
    { id: 'task-3', type: 'task', title: 'Task 3', order: 'a2', ... },
  ];

  beforeEach(() => {
    mockOnReorder.mockClear();
  });

  it('should calculate correct prev/next IDs when dragging down', async () => {
    const entries = createEntries();
    render(<EntryList entries={entries} onReorder={mockOnReorder} />);
    
    // Simulate dragging task-1 to position after task-2 (between task-2 and task-3)
    // Old index: 0, New index: 2
    // Expected: previousId = task-2, nextId = task-3
    
    // Note: Use @dnd-kit testing utilities
    const { drag } = setupDragTest();
    await drag('task-1', { afterId: 'task-2' });
    
    expect(mockOnReorder).toHaveBeenCalledWith('task-1', 'task-2', 'task-3');
  });

  it('should calculate correct prev/next IDs when dragging up', async () => {
    const entries = createEntries();
    render(<EntryList entries={entries} onReorder={mockOnReorder} />);
    
    // Simulate dragging task-3 to first position (before task-1)
    // Old index: 2, New index: 0
    // Expected: previousId = null, nextId = task-1
    
    const { drag } = setupDragTest();
    await drag('task-3', { beforeId: 'task-1' });
    
    expect(mockOnReorder).toHaveBeenCalledWith('task-3', null, 'task-1');
  });

  it('should handle dragging to first position', async () => {
    const entries = createEntries();
    render(<EntryList entries={entries} onReorder={mockOnReorder} />);
    
    // Drag task-2 to first position
    // Expected: previousId = null, nextId = task-1
    
    const { drag } = setupDragTest();
    await drag('task-2', { beforeId: 'task-1' });
    
    expect(mockOnReorder).toHaveBeenCalledWith('task-2', null, 'task-1');
  });

  it('should handle dragging to last position', async () => {
    const entries = createEntries();
    render(<EntryList entries={entries} onReorder={mockOnReorder} />);
    
    // Drag task-1 to last position
    // Expected: previousId = task-3, nextId = null
    
    const { drag } = setupDragTest();
    await drag('task-1', { afterId: 'task-3' });
    
    expect(mockOnReorder).toHaveBeenCalledWith('task-1', 'task-3', null);
  });

  it('should not call onReorder if item dropped in same position', async () => {
    const entries = createEntries();
    render(<EntryList entries={entries} onReorder={mockOnReorder} />);
    
    const { drag } = setupDragTest();
    await drag('task-2', { afterId: 'task-1' }); // Already in this position
    
    expect(mockOnReorder).not.toHaveBeenCalled();
  });

  it('should respect mouse activation constraint (8px distance)', async () => {
    const entries = createEntries();
    render(<EntryList entries={entries} onReorder={mockOnReorder} />);
    
    const dragHandle = screen.getAllByLabelText('Drag to reorder')[0];
    
    // Drag less than 8px - should not activate
    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: dragHandle },
      { coords: { x: 5, y: 5 } }, // Only 5px movement
      { keys: '[/MouseLeft]' },
    ]);
    
    expect(mockOnReorder).not.toHaveBeenCalled();
  });

  it('should respect touch activation constraint (250ms delay)', async () => {
    vi.useFakeTimers();
    const entries = createEntries();
    render(<EntryList entries={entries} onReorder={mockOnReorder} />);
    
    const dragHandle = screen.getAllByLabelText('Drag to reorder')[0];
    
    // Touch and release before 250ms - should not activate
    fireEvent.touchStart(dragHandle);
    vi.advanceTimersByTime(100); // Only 100ms
    fireEvent.touchEnd(dragHandle);
    
    expect(mockOnReorder).not.toHaveBeenCalled();
    
    vi.useRealTimers();
  });
});
```

**Test File 2: HierarchicalCollectionList.test.tsx (NEW FILE)**
```typescript
// packages/client/src/components/HierarchicalCollectionList.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HierarchicalCollectionList } from './HierarchicalCollectionList';

describe('HierarchicalCollectionList - Drag and Drop', () => {
  const mockOnReorder = vi.fn();
  
  const createCollections = () => [
    { 
      id: 'coll-1', 
      name: 'Favorites 1', 
      type: 'custom',
      isFavorite: true,
      order: 'a0',
    },
    { 
      id: 'coll-2', 
      name: 'Favorites 2', 
      type: 'custom',
      isFavorite: true,
      order: 'a1',
    },
    { 
      id: 'coll-3', 
      name: 'Custom 1', 
      type: 'custom',
      isFavorite: false,
      order: 'b0',
    },
    { 
      id: 'coll-4', 
      name: 'Custom 2', 
      type: 'custom',
      isFavorite: false,
      order: 'b1',
    },
  ];

  beforeEach(() => {
    mockOnReorder.mockClear();
  });

  it('should allow reordering within Favorites section', async () => {
    const collections = createCollections();
    render(
      <HierarchicalCollectionList 
        collections={collections} 
        onReorder={mockOnReorder}
        selectedCollectionId={null}
      />
    );
    
    // Drag coll-1 after coll-2 (both in Favorites section)
    const { drag } = setupDragTest();
    await drag('coll-1', { afterId: 'coll-2' });
    
    expect(mockOnReorder).toHaveBeenCalledWith('coll-1', 'coll-2', null);
  });

  it('should allow reordering within Other Customs section', async () => {
    const collections = createCollections();
    render(
      <HierarchicalCollectionList 
        collections={collections} 
        onReorder={mockOnReorder}
        selectedCollectionId={null}
      />
    );
    
    // Drag coll-3 after coll-4 (both in Other Customs section)
    const { drag } = setupDragTest();
    await drag('coll-3', { afterId: 'coll-4' });
    
    expect(mockOnReorder).toHaveBeenCalledWith('coll-3', 'coll-4', null);
  });

  it('should NOT allow dragging between Favorites and Other Customs sections', async () => {
    const collections = createCollections();
    render(
      <HierarchicalCollectionList 
        collections={collections} 
        onReorder={mockOnReorder}
        selectedCollectionId={null}
      />
    );
    
    // Try to drag coll-1 (Favorites) into Other Customs section
    const { drag } = setupDragTest();
    await drag('coll-1', { afterId: 'coll-3' }); // Should be blocked
    
    expect(mockOnReorder).not.toHaveBeenCalled();
  });

  it('should NOT allow dragging temporal nodes (year/month/day)', async () => {
    const collections = [
      ...createCollections(),
      { 
        id: 'daily-2026-02-01', 
        name: '2026-02-01', 
        type: 'daily',
        date: '2026-02-01',
      },
    ];
    
    render(
      <HierarchicalCollectionList 
        collections={collections} 
        onReorder={mockOnReorder}
        selectedCollectionId={null}
      />
    );
    
    // Temporal nodes (year/month) should not have drag handles
    const yearNode = screen.queryByText('2026');
    expect(yearNode).toBeInTheDocument();
    
    // Should not have drag handle
    const dragHandles = screen.queryAllByLabelText('Drag to reorder');
    expect(dragHandles).toHaveLength(4); // Only the 4 custom collections
  });

  it('should render drag handles for custom collections only', () => {
    const collections = createCollections();
    render(
      <HierarchicalCollectionList 
        collections={collections} 
        onReorder={mockOnReorder}
        selectedCollectionId={null}
      />
    );
    
    const dragHandles = screen.getAllByLabelText('Drag to reorder');
    expect(dragHandles).toHaveLength(4); // All 4 custom collections have drag handles
  });

  it('should show visual separators between sections', () => {
    const collections = createCollections();
    render(
      <HierarchicalCollectionList 
        collections={collections} 
        onReorder={mockOnReorder}
        selectedCollectionId={null}
      />
    );
    
    // Check for section headers/separators
    expect(screen.getByText(/Favorites/i)).toBeInTheDocument();
    expect(screen.getByText(/Date Hierarchy/i)).toBeInTheDocument();
    expect(screen.getByText(/Other Customs/i)).toBeInTheDocument();
  });
});
```

**Drag Test Utilities (Shared Helper)**
```typescript
// packages/client/src/test-utils/dragHelpers.ts
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { fireEvent } from '@testing-library/react';

export function setupDragTest() {
  return {
    drag: async (
      activeId: string, 
      target: { beforeId?: string; afterId?: string }
    ) => {
      // Simulate drag start
      const dragHandle = screen.getByTestId(`drag-handle-${activeId}`);
      fireEvent.pointerDown(dragHandle);
      
      // Simulate drag move
      fireEvent.pointerMove(dragHandle, { clientX: 100, clientY: 100 });
      
      // Simulate drop
      const dropTarget = target.beforeId 
        ? screen.getByTestId(`drop-zone-${target.beforeId}`)
        : screen.getByTestId(`drop-zone-${target.afterId}`);
      
      fireEvent.pointerUp(dropTarget);
    },
  };
}
```

**Expected Test Coverage:**
- EntryList drag-and-drop: +7 tests
- HierarchicalCollectionList drag-and-drop: +6 tests
- **Total new tests:** 13 tests

---

### Phase 4: Accessibility & UX Improvements (1-2 hours)

#### Task 4.1: Add Keyboard Navigation to Dropdown Menus
**Files:**
- `packages/client/src/components/CollectionHeader.tsx`
- `packages/client/src/components/EntryActionsMenu.tsx`
- `packages/client/src/components/UserProfileMenu.tsx`

**Priority:** 🟡 MEDIUM  
**Effort:** 1-2 hours  
**Issue:** Menus don't support Escape key, arrow key navigation, or focus trapping

**Current Issues:**
- No Escape key to close menu
- No arrow keys to navigate menu items
- No focus trap (keyboard focus can leave menu)
- No auto-focus on first menu item when opened

**Solution:**

**Keyboard Navigation Hook**
```typescript
// packages/client/src/hooks/useMenuKeyboardNavigation.ts
import { useEffect, useRef, RefObject } from 'react';

interface UseMenuKeyboardNavigationProps {
  isOpen: boolean;
  onClose: () => void;
  menuRef: RefObject<HTMLDivElement>;
}

export function useMenuKeyboardNavigation({
  isOpen,
  onClose,
  menuRef,
}: UseMenuKeyboardNavigationProps) {
  const focusedIndexRef = useRef(0);

  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const menuItems = Array.from(
      menuRef.current.querySelectorAll('[role="menuitem"]')
    ) as HTMLElement[];

    if (menuItems.length === 0) return;

    // Auto-focus first menu item
    menuItems[0].focus();
    focusedIndexRef.current = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: Close menu
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Arrow Down: Focus next item
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusedIndexRef.current = (focusedIndexRef.current + 1) % menuItems.length;
        menuItems[focusedIndexRef.current].focus();
      }

      // Arrow Up: Focus previous item
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusedIndexRef.current =
          (focusedIndexRef.current - 1 + menuItems.length) % menuItems.length;
        menuItems[focusedIndexRef.current].focus();
      }

      // Home: Focus first item
      if (e.key === 'Home') {
        e.preventDefault();
        focusedIndexRef.current = 0;
        menuItems[0].focus();
      }

      // End: Focus last item
      if (e.key === 'End') {
        e.preventDefault();
        focusedIndexRef.current = menuItems.length - 1;
        menuItems[menuItems.length - 1].focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, menuRef]);
}
```

**Usage in Components**
```typescript
// CollectionHeader.tsx
export function CollectionHeader({ ... }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Add keyboard navigation
  useMenuKeyboardNavigation({
    isOpen: isMenuOpen,
    onClose: () => setIsMenuOpen(false),
    menuRef,
  });

  return (
    <>
      {isMenuOpen && (
        <div 
          ref={menuRef}
          role="menu"
          className="..."
        >
          <button role="menuitem" onClick={...}>Rename</button>
          <button role="menuitem" onClick={...}>Delete</button>
          {/* ... */}
        </div>
      )}
    </>
  );
}
```

**Tests**
```typescript
// useMenuKeyboardNavigation.test.ts
describe('useMenuKeyboardNavigation', () => {
  it('should close menu on Escape key', async () => {
    const mockOnClose = vi.fn();
    const { user } = renderHook(() =>
      useMenuKeyboardNavigation({
        isOpen: true,
        onClose: mockOnClose,
        menuRef: createMenuRef(),
      })
    );

    await user.keyboard('{Escape}');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should focus next item on Arrow Down', async () => {
    const menuRef = createMenuRef([
      <button role="menuitem">Item 1</button>,
      <button role="menuitem">Item 2</button>,
      <button role="menuitem">Item 3</button>,
    ]);

    const { user } = renderHook(() =>
      useMenuKeyboardNavigation({
        isOpen: true,
        onClose: vi.fn(),
        menuRef,
      })
    );

    // Should start focused on first item
    expect(document.activeElement).toBe(menuRef.current.children[0]);

    // Arrow Down should focus second item
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(menuRef.current.children[1]);

    // Arrow Down should focus third item
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(menuRef.current.children[2]);

    // Arrow Down should wrap to first item
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(menuRef.current.children[0]);
  });

  it('should focus previous item on Arrow Up', async () => {
    // Similar test for Arrow Up navigation
  });

  it('should focus first item on Home key', async () => {
    // Test Home key behavior
  });

  it('should focus last item on End key', async () => {
    // Test End key behavior
  });
});
```

---

#### Task 4.2: Fix Subscription Memory Leak & Performance
**File:** `packages/client/src/views/CollectionDetailView.tsx` (lines 128-143)  
**Priority:** 🟡 MEDIUM  
**Effort:** 1 hour  
**Issue:** Subscriptions trigger on ALL events, no debouncing, potential race conditions

**Current Code:**
```typescript
useEffect(() => {
  loadData(); // Called on mount AND in subscription
  
  const unsubscribeCollection = collectionProjection.subscribe(() => {
    loadData(); // Triggers on EVERY event, even unrelated ones
  });
  
  const unsubscribeEntry = entryProjection.subscribe(() => {
    loadData(); // Triggers on EVERY event, even unrelated ones
  });
  
  return () => {
    unsubscribeCollection();
    unsubscribeEntry();
  };
}, [collectionId, collectionProjection, entryProjection]);
```

**Problems:**
- `loadData()` called on mount AND in subscription (duplicate load)
- No filtering - reloads on ALL events (even for other collections)
- No debouncing - rapid events cause multiple reloads
- Potential race conditions with concurrent `loadData()` calls

**Fix:**
```typescript
useEffect(() => {
  let isMounted = true;
  let timeoutId: NodeJS.Timeout | null = null;
  
  const loadData = async () => {
    if (!collectionId || !isMounted) return;
    
    setIsLoading(true);
    
    try {
      const [coll, ents] = await Promise.all([
        collectionProjection.getCollection(collectionId),
        entryProjection.getEntriesByCollection(collectionId),
      ]);
      
      if (isMounted) {
        setCollection(coll);
        setEntries(ents);
        setIsLoading(false);
      }
    } catch (error) {
      if (isMounted) {
        logger.error('Failed to load collection data:', error);
        setIsLoading(false);
      }
    }
  };
  
  // Initial load
  loadData();
  
  // Debounced reload on events
  const debouncedLoad = () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      loadData();
    }, 100); // Wait 100ms after last event
  };
  
  const unsubscribeCollection = collectionProjection.subscribe(debouncedLoad);
  const unsubscribeEntry = entryProjection.subscribe(debouncedLoad);
  
  return () => {
    isMounted = false;
    if (timeoutId) clearTimeout(timeoutId);
    unsubscribeCollection();
    unsubscribeEntry();
  };
}, [collectionId, collectionProjection, entryProjection]);
```

**Benefits:**
- Prevents race conditions with `isMounted` flag
- Debounces rapid events (100ms window)
- Proper cleanup on unmount
- Error handling added
- Single load on mount

---

### Phase 5: Low-Priority Code Quality (1 hour)

#### Task 5.1: Extract Magic Numbers to Constants
**Files:** Multiple  
**Priority:** 🟢 LOW  
**Effort:** 30 minutes  

**Issues:**
- `EntryList.tsx` line 112: `pb-32` (8rem FAB clearance)
- `HierarchicalCollectionList.tsx` line 125: `md:ml-12` (3rem drag handle offset)
- `SyncManager.ts`: 5 minutes, 30 seconds (hardcoded intervals)

**Solution:**

**UI Constants**
```typescript
// packages/client/src/constants/ui.ts
export const UI_CONSTANTS = {
  // Layout
  FAB_BOTTOM_CLEARANCE: 'pb-32', // 8rem clearance for floating action buttons
  DRAG_HANDLE_OFFSET: 'md:ml-12', // 3rem offset for drag handles on desktop
  
  // Touch targets (WCAG 2.1 Level AAA)
  MIN_TOUCH_TARGET_SIZE: 48, // pixels
  
  // Animations
  DEFAULT_TRANSITION_DURATION: 200, // milliseconds
  
  // Z-index layers
  Z_INDEX: {
    MODAL_BACKDROP: 50,
    MODAL_CONTENT: 60,
    DROPDOWN_MENU: 40,
    FAB: 30,
    HEADER: 20,
  },
} as const;
```

**Sync Constants**
```typescript
// packages/client/src/constants/sync.ts
export const SYNC_CONSTANTS = {
  SYNC_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
  DEBOUNCE_DELAY_MS: 30 * 1000, // 30 seconds
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_BACKOFF_MS: 1000, // 1 second
} as const;
```

**Usage:**
```typescript
// Before
<div className="pb-32">...</div>

// After
import { UI_CONSTANTS } from '../constants/ui';
<div className={UI_CONSTANTS.FAB_BOTTOM_CLEARANCE}>...</div>
```

---

#### Task 5.2: Add Error Boundaries
**Files:** React component tree  
**Priority:** 🟢 LOW  
**Effort:** 1 hour  

**Solution:**

**Error Boundary Component**
```typescript
// packages/client/src/components/ErrorBoundary.tsx
import React from 'react';
import { logger } from '../utils/logger';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Uncaught error in component tree:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center max-w-md p-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Something went wrong
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Usage in App**
```typescript
// packages/client/src/main.tsx
import { ErrorBoundary } from './components/ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
```

**Tests**
```typescript
// ErrorBoundary.test.tsx
describe('ErrorBoundary', () => {
  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Test Content</div>
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should render fallback UI when error occurs', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };
    
    // Suppress console.error for this test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
    
    spy.mockRestore();
  });

  it('should render custom fallback when provided', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };
    
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <ErrorBoundary fallback={<div>Custom Fallback</div>}>
        <ThrowError />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Custom Fallback')).toBeInTheDocument();
    
    spy.mockRestore();
  });

  it('should allow reload on button click', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };
    
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadSpy },
      writable: true,
    });
    
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    
    const reloadButton = screen.getByRole('button', { name: /reload app/i });
    fireEvent.click(reloadButton);
    
    expect(reloadSpy).toHaveBeenCalled();
    
    spy.mockRestore();
  });
});
```

---

## 📊 Summary: Session 7 Work Plan

### Estimated Time Breakdown

| Phase | Tasks | Effort | Priority |
|-------|-------|--------|----------|
| **Phase 1: Quick Wins** | 4 tasks | 1-2 hours | 🔴 HIGH |
| 1.1 | Extract handler initialization with useMemo | 30 min | 🔴 |
| 1.2 | Optimize drag sensor creation | 15 min | 🟡 |
| 1.3 | Replace console statements with logger | 30 min | 🔴 |
| 1.4 | Extract duplicate drag handle component | 30 min | 🟢 |
| **Phase 2: Refactoring** | 1 task | 2-3 hours | 🔴 HIGH |
| 2.1 | Refactor CollectionDetailView into hooks | 2-3 hours | 🔴 |
| **Phase 3: Test Coverage** | 1 task | 2-3 hours | 🔴 HIGH |
| 3.1 | Add comprehensive drag-and-drop tests | 2-3 hours | 🔴 |
| **Phase 4: Accessibility** | 2 tasks | 2-3 hours | 🟡 MEDIUM |
| 4.1 | Add keyboard navigation to dropdown menus | 1-2 hours | 🟡 |
| 4.2 | Fix subscription memory leak & performance | 1 hour | 🟡 |
| **Phase 5: Code Quality** | 2 tasks | 1 hour | 🟢 LOW |
| 5.1 | Extract magic numbers to constants | 30 min | 🟢 |
| 5.2 | Add error boundaries | 1 hour | 🟢 |

**Total Estimated Time:** 8-12 hours

---

## 🎯 Success Criteria

### Code Quality Metrics
- ✅ All files under 500 lines (CollectionDetailView: 479 → ~200)
- ✅ Zero console.log statements in production code
- ✅ All critical functionality has test coverage (drag-and-drop)
- ✅ Accessibility: WCAG 2.1 Level AA compliance (keyboard navigation)

### Test Coverage
- ✅ Add 13+ new tests for drag-and-drop
- ✅ Add 20+ new tests for extracted hooks
- ✅ Add 5+ new tests for keyboard navigation
- ✅ Target: 820+ tests passing (up from 772)

### Performance
- ✅ Eliminate handler recreation on every render
- ✅ Debounce projection subscriptions
- ✅ Memoize expensive computations

### Developer Experience
- ✅ Reusable hooks for common patterns
- ✅ Centralized constants for magic numbers
- ✅ Better error messages
- ✅ Graceful error handling with boundaries

---

## 📝 Definition of Done

- [ ] All 12 tasks implemented
- [ ] All new code has tests
- [ ] All tests passing (target: 820+)
- [ ] TypeScript compiles without errors
- [ ] Production build successful
- [ ] Casey reviews and approves (target: 9+/10)
- [ ] Documentation updated
- [ ] Deployed to production

---

## 🔄 Work Loop

1. ✅ Casey comprehensive code review (COMPLETE)
2. ✅ Document implementation plan (COMPLETE)
3. 🔜 Get user approval before implementation
4. 🔜 Sam implements Phase 1 (Quick Wins)
5. 🔜 Sam implements Phase 2 (Refactoring)
6. 🔜 Sam implements Phase 3 (Test Coverage)
7. 🔜 Sam implements Phase 4 (Accessibility)
8. 🔜 Sam implements Phase 5 (Code Quality)
9. 🔜 Casey final review
10. 🔜 User manual testing
11. 🔜 User approval to deploy

---

---

## ✅ User Approval - February 3, 2026

**Approved Scope:** All 12 tasks across 5 phases  
**Additional Items:** 3 critical bugs from user feedback (see `user-feedback-2026-02-03.md`)

### Final Session 7 Scope

**Part A: Critical Bug Fixes (2-3 hours)**
1. Fix daily log creation via migration (creates custom instead of daily) - 0.5-1 hr
2. Fix page navigation ordering (doesn't match collection index) - 1-2 hrs
3. Fix drag handle position on mobile (move closer to edge) - 0.5 hr

**Part B: Casey's Code Quality Plan (8-12 hours)**
- All 12 tasks from comprehensive code review
- See detailed implementation plans above

**Total Estimated Time:** 10-15 hours

**Agent Team:** Sam (implement) → Casey (review)

**Success Criteria:**
- All 3 bugs fixed and tested
- All 12 code quality tasks complete
- Test count: 820+ tests passing (up from 772)
- Casey's final rating: 9+/10
- All tests passing, production build successful
- User manual testing and approval

---

## 🔄 Multi-Session Plan Approved

### Session 7: Bug Fixes + Code Quality ✅ APPROVED
- **Team:** Sam → Casey
- **Time:** 10-15 hours
- **Focus:** Fix bugs, clean up tech debt

### Session 8: UX Enhancements 📅 PLANNED
- **Team:** Alex → Sam → Casey
- **Time:** 6-9 hours
- **Focus:** Collection stats, completed task sorting, monthly logs
- **Design First:** Alex designs UX before Sam implements

### Session 9: Advanced Features 📅 PLANNED
- **Team:** Alex → Sam → Casey
- **Time:** 4-6 hours + design
- **Focus:** Bulk migration
- **Design First:** Alex designs interaction patterns

### Future Sessions: Sub-tasks + Monthly Log Advanced Features
- **Team:** Alex (full design session) → Sam → Casey
- **Time:** 10-15 hours
- **Focus:** Hierarchical tasks, event visibility, smart migration

---

**Last Updated:** February 3, 2026  
**Status:** ✅ APPROVED - Ready for Session 7 implementation  
**Next Action:** Hand off to Sam for implementation
