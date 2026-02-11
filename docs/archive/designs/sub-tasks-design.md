# Sub-Tasks Feature - Final Design Document

**Date:** 2026-02-07  
**Status:** Ready for Implementation  
**Architect:** Architecture Alex  
**Implementer:** Sam (Developer)  
**Reviewer:** Casey (Code Review)

---

## Executive Summary

This document specifies the complete design for the sub-tasks feature—the **primary motivation for building Squickr Life**. Sub-tasks enable users to break down large, overwhelming tasks into actionable steps, solving the core problem of getting stuck on vague projects.

**Key Design Principles:**
- Sub-tasks are **independent entries** that retain parent links across collections
- Migration creates **"symlink" behavior** (children appear in multiple collections)
- Parent completion requires **all children complete** (soft warning with cascade option)
- **Two-level hierarchy** for MVP (can extend to unlimited later with zero tech debt)

---

## Part 1: Recommendation for Initial Sub-Task Collection Assignment

### The Question

When creating a sub-task, should it initially have:
- **Option 1:** `collectionId` = parent's collection (explicit collection membership)
- **Option 2:** `collectionId` = `null` (no collection, "belongs" to parent only)

### Recommendation: **Option 1 - Explicit Collection Membership** ✅

```typescript
// Sub-task created with same collectionId as parent:
TaskCreated {
  aggregateId: 'sub-task-123',
  payload: {
    id: 'sub-task-123',
    title: 'Write blog post',
    parentTaskId: 'parent-456',
    collectionId: 'work-projects', // ← Same as parent initially
    // ... other fields
  }
}
```

### Rationale

**1. Consistency with Existing Architecture**

Your current system already treats all tasks as collection members:
```typescript
// Existing pattern:
TaskCreated { taskId, collectionId, ... } // Every task has collectionId

// Sub-tasks follow same pattern:
TaskCreated { taskId, parentTaskId, collectionId, ... } // Sub-tasks are tasks too
```

**Liskov Substitution Principle:** Sub-tasks are substitutable for tasks everywhere. Setting `collectionId: null` would create a special case (tasks without collections) that breaks this principle.

---

**2. Simpler Cascade Logic**

Option 1 makes cascade migration crystal clear:

```typescript
// Option 1: Explicit comparison
function shouldMigrateChild(child: Task, parent: Task): boolean {
  return child.collectionId === parent.collectionId;
  // Clear: If child is in same collection, it follows parent
}

// Option 2: Null handling adds complexity
function shouldMigrateChild(child: Task, parent: Task): boolean {
  return child.collectionId === null || child.collectionId === parent.collectionId;
  // Requires special null check, less obvious
}
```

---

**3. Projection Query Simplicity**

Your existing projections filter by `collectionId`:

```typescript
// Current projection (works with Option 1):
getEntriesInCollection(collectionId: string): Entry[] {
  return this.entries.filter(e => e.collectionId === collectionId);
  // Sub-tasks included automatically (they have collectionId)
}

// With Option 2, you'd need special handling:
getEntriesInCollection(collectionId: string): Entry[] {
  return this.entries.filter(e => 
    e.collectionId === collectionId 
    || (e.collectionId === null && e.parentTaskId && parentIsInCollection(e.parentTaskId, collectionId))
    // ↑ Complex logic to find "parent-only" tasks
  );
}
```

---

**4. Event Count is Identical**

The user's concern was: *"Maybe it not getting collectionId would prevent extra events when parent migrates?"*

**Answer:** No difference in event count.

**Option 1 (has collectionId):**
```typescript
// Parent migrates → 2 events (parent + unmigrated child)
EntryMovedToCollection { aggregateId: parentId, collectionId: 'monthly' }
EntryMovedToCollection { aggregateId: childId, collectionId: 'monthly' }
```

**Option 2 (no collectionId):**
```typescript
// Parent migrates → Still need to assign collectionId to child
EntryMovedToCollection { aggregateId: parentId, collectionId: 'monthly' }
EntryMovedToCollection { aggregateId: childId, collectionId: 'monthly' } // Same event!
// OR need new event: ChildInheritedCollection { childId, collectionId: 'monthly' }
```

No savings—you still need events to update child state.

---

**5. Future-Proof for Independent Sub-Tasks**

The user said: *"I do see value in the sub-task being used and never being migrated in some cases."*

With Option 1, sub-tasks can be:
- **Never migrated:** Stay in parent's collection forever (simple)
- **Migrated individually:** Get new `collectionId`, become symlink
- **Migrated with parent:** Follow parent when parent moves

All three workflows work seamlessly.

With Option 2, unmigrated sub-tasks are a special category (no collection) that need different rendering/query logic.

---

### Trade-Offs

**Option 1 Downside:**
- Cascade migration generates `EntryMovedToCollection` event for each unmigrated child
- If parent has 10 unmigrated children, that's 11 events (1 parent + 10 children)

**Mitigation:**
- This is **correct event sourcing** (each state change = one event)
- Batch appending (already exists in your architecture) handles this efficiently
- Events are small (~200 bytes each), 11 events ≈ 2KB total

**Option 2 Downside:**
- Special-case logic everywhere (projections, queries, rendering)
- Violates uniformity (some tasks have collections, some don't)
- Harder to reason about ("Where does this task live?")

**Conclusion:** Option 1's explicit membership is cleaner architecture.

---

### Implementation

```typescript
// Creating sub-task - inherits parent's collectionId:
export async function handleCreateSubTask(
  command: CreateSubTaskCommand,
  eventStore: IEventStore
): Promise<TaskCreated> {
  const parent = await getTask(command.parentTaskId, eventStore);
  
  const event: TaskCreated = {
    id: generateId(),
    type: 'TaskCreated',
    aggregateId: command.taskId ?? generateId(),
    timestamp: new Date().toISOString(),
    version: 1,
    payload: {
      id: command.taskId ?? generateId(),
      title: command.title,
      parentTaskId: command.parentTaskId, // ← Links to parent
      collectionId: parent.collectionId,  // ← Inherits parent's collection
      status: 'open',
      createdAt: new Date().toISOString(),
      order: command.order,
      userId: command.userId,
    },
  };
  
  await eventStore.append(event);
  return event;
}
```

---

## Part 2: Complete Design Specification

---

## 1. Event Schema

### 1.1 Modified Events (Extend Existing)

#### TaskCreated (Extended)

```typescript
export interface TaskCreated extends DomainEvent {
  readonly type: 'TaskCreated';
  readonly aggregateId: string;
  readonly payload: {
    readonly id: string;
    readonly title: string;
    readonly createdAt: string;
    readonly status: 'open';
    readonly order?: string;
    readonly collectionId?: string;
    readonly userId?: string;
    readonly parentTaskId?: string; // ← NEW FIELD (optional for backward compatibility)
  };
}
```

**Changes:**
- Add `parentTaskId?: string` field to payload
- If `parentTaskId` is set, this task is a sub-task
- If `parentTaskId` is undefined, this task is a top-level task

**Backward Compatibility:**
- Existing `TaskCreated` events (no `parentTaskId`) → Top-level tasks ✅
- New `TaskCreated` events with `parentTaskId` → Sub-tasks ✅

---

### 1.2 New Events

#### TaskOrphaned

```typescript
/**
 * TaskOrphaned Event
 * Emitted when a parent task is deleted and its children become top-level tasks
 * 
 * Invariants:
 * - aggregateId must match an existing sub-task (task with parentTaskId)
 * - formerParentId must match a deleted task
 */
export interface TaskOrphaned extends DomainEvent {
  readonly type: 'TaskOrphaned';
  readonly aggregateId: string;
  readonly payload: {
    readonly taskId: string;
    readonly formerParentId: string; // Audit trail: which parent was deleted
    readonly orphanedAt: string;
  };
}
```

**Purpose:** When parent is deleted, children's `parentTaskId` is set to `null` (they become top-level tasks).

**Projection handling:**
```typescript
case 'TaskOrphaned':
  const task = this.tasks[event.payload.taskId];
  if (task) {
    this.tasks[event.payload.taskId] = {
      ...task,
      parentTaskId: undefined, // Remove parent link
    };
  }
  break;
```

---

### 1.3 Command Types

#### CreateSubTaskCommand

```typescript
/**
 * CreateSubTask Command
 * Represents the user's intent to create a sub-task under a parent task
 * 
 * Validation rules:
 * - title: Required, will be trimmed, 1-500 characters
 * - parentTaskId: Required, must reference an existing task
 * - Parent task must not be a sub-task itself (max 2 levels)
 */
export interface CreateSubTaskCommand {
  readonly title: string;
  readonly parentTaskId: string; // Required - which task to add sub-task under
  readonly taskId?: string; // Optional - for testing (auto-generated if not provided)
  readonly order?: string; // Optional - fractional index for positioning
  readonly userId?: string;
}
```

---

#### DeleteParentTaskCommand

```typescript
/**
 * DeleteParentTask Command
 * Represents the user's intent to delete a task that has sub-tasks
 * 
 * Behavior:
 * - Shows confirmation warning
 * - Deletes parent (TaskDeleted event)
 * - Orphans all children (TaskOrphaned events for each child)
 */
export interface DeleteParentTaskCommand {
  readonly taskId: string;
  readonly confirmed: boolean; // User must confirm deletion
}
```

---

#### CompleteParentTaskCommand

```typescript
/**
 * CompleteParentTask Command
 * Represents the user's intent to complete a task that has sub-tasks
 * 
 * Behavior:
 * - If all children complete: Complete parent (TaskCompleted event)
 * - If some children incomplete: Show warning, optionally cascade complete
 */
export interface CompleteParentTaskCommand {
  readonly taskId: string;
  readonly cascadeComplete: boolean; // If true, complete all children too
}
```

---

## 2. Data Model

### 2.1 Task Interface (Extended)

```typescript
export interface Task {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
  readonly status: TaskStatus;
  readonly completedAt?: string;
  readonly order?: string;
  readonly collectionId?: string;
  readonly userId?: string;
  readonly migratedTo?: string;
  readonly migratedFrom?: string;
  readonly migratedToCollectionId?: string;
  
  // New fields for sub-tasks:
  readonly parentTaskId?: string; // If set, this is a sub-task
}
```

**No other changes needed.** The `parentTaskId` field is sufficient to represent the parent-child relationship.

---

### 2.2 Derived Properties (Not Stored, Computed by Projection)

```typescript
// In EntryListProjection:
class EntryListProjection {
  // Get all sub-tasks of a parent
  getSubTasks(parentTaskId: string): Task[] {
    return this.getAllTasks().filter(task => task.parentTaskId === parentTaskId);
  }
  
  // Check if a task is a sub-task
  isSubTask(task: Task): boolean {
    return task.parentTaskId !== undefined;
  }
  
  // Check if a task is a parent (has children)
  isParentTask(task: Task): boolean {
    return this.getSubTasks(task.id).length > 0;
  }
  
  // Check if a sub-task is migrated (different collection than parent)
  isSubTaskMigrated(task: Task): boolean {
    if (!task.parentTaskId) return false;
    const parent = this.getTask(task.parentTaskId);
    if (!parent) return false; // Parent deleted (orphaned)
    return task.collectionId !== parent.collectionId;
  }
  
  // Get parent task (if this is a sub-task)
  getParentTask(task: Task): Task | undefined {
    if (!task.parentTaskId) return undefined;
    return this.getTask(task.parentTaskId);
  }
  
  // Get completion status for parent
  getParentCompletionStatus(parentTaskId: string): {
    total: number;
    completed: number;
    allComplete: boolean;
  } {
    const children = this.getSubTasks(parentTaskId);
    const completed = children.filter(c => c.status === 'completed').length;
    return {
      total: children.length,
      completed,
      allComplete: completed === children.length,
    };
  }
}
```

---

## 3. Migration Handler Logic

### 3.1 Cascade Migration Rules

When parent task migrates, children follow **only if they're in the same collection as the parent** (unmigrated children).

```typescript
/**
 * Handle migrating a parent task with sub-tasks
 * 
 * Rules:
 * 1. Parent always migrates (EntryMovedToCollection)
 * 2. Children in SAME collection as parent → migrate too (cascade)
 * 3. Children in DIFFERENT collection → stay put (already migrated, symlink)
 */
export async function handleMoveParentTaskToCollection(
  command: MoveEntryToCollectionCommand,
  eventStore: IEventStore
): Promise<DomainEvent[]> {
  const projection = new EntryListProjection(eventStore);
  const parent = projection.getTask(command.entryId);
  
  if (!parent) {
    throw new Error(`Task not found: ${command.entryId}`);
  }
  
  const events: DomainEvent[] = [];
  
  // 1. Migrate parent
  const parentMoveEvent: EntryMovedToCollection = {
    id: generateId(),
    type: 'EntryMovedToCollection',
    aggregateId: parent.id,
    timestamp: new Date().toISOString(),
    version: 1,
    payload: {
      entryId: parent.id,
      collectionId: command.collectionId,
      movedAt: new Date().toISOString(),
    },
  };
  events.push(parentMoveEvent);
  
  // 2. Get all children
  const children = projection.getSubTasks(parent.id);
  
  // 3. Migrate children in SAME collection as parent (cascade)
  for (const child of children) {
    if (child.collectionId === parent.collectionId) {
      // Unmigrated child → follows parent
      const childMoveEvent: EntryMovedToCollection = {
        id: generateId(),
        type: 'EntryMovedToCollection',
        aggregateId: child.id,
        timestamp: new Date().toISOString(),
        version: 1,
        payload: {
          entryId: child.id,
          collectionId: command.collectionId, // Same as parent's new collection
          movedAt: new Date().toISOString(),
        },
      };
      events.push(childMoveEvent);
    }
    // Else: Child already migrated (different collection) → skip (stays put)
  }
  
  // 4. Append all events as batch
  await eventStore.appendBatch(events); // Assumes batch append exists
  
  return events;
}
```

**Example:**

```
Before:
  Work Projects (work-projects):
    ☐ App launch (collectionId: work-projects)
    ☐ Set up analytics (collectionId: work-projects, parentTaskId: app-launch)
  Today's Log (daily-2026-02-11):
    ☐ Write blog post (collectionId: daily-2026-02-11, parentTaskId: app-launch)

User migrates "App launch" to Monthly Log (monthly-2026-02):

Events generated:
1. EntryMovedToCollection { aggregateId: app-launch, collectionId: monthly-2026-02 }
2. EntryMovedToCollection { aggregateId: set-up-analytics, collectionId: monthly-2026-02 }
// "Write blog post" NOT migrated (already in different collection)

After:
  Monthly Log (monthly-2026-02):
    ☐ App launch (collectionId: monthly-2026-02)
    ☐ Set up analytics (collectionId: monthly-2026-02, parentTaskId: app-launch)
  Today's Log (daily-2026-02-11):
    ☐ Write blog post (collectionId: daily-2026-02-11, parentTaskId: app-launch) ← STAYS
```

---

### 3.2 Individual Sub-Task Migration

When user migrates a sub-task individually, it's a standard `EntryMovedToCollection` event:

```typescript
// User migrates "Write blog post" from Work Projects to Today's Log:
EntryMovedToCollection {
  aggregateId: 'write-blog-post-id',
  payload: {
    entryId: 'write-blog-post-id',
    collectionId: 'daily-2026-02-11', // New collection
    movedAt: '2026-02-11T10:00:00Z',
  }
}

// parentTaskId remains unchanged in task state (still linked to parent)
```

**Result:**
- Sub-task appears in **two places** (symlink behavior):
  1. Today's Log (via `collectionId` query) - as regular task
  2. Work Projects (via parent's `getSubTasks()` query) - under parent with indicator

---

## 4. Completion Logic

### 4.1 Completing Parent with Incomplete Children

**Rule:** Parent can only complete if all children are complete. If user tries to complete parent with incomplete children, show soft warning with cascade option.

```typescript
export async function handleCompleteParentTask(
  command: CompleteParentTaskCommand,
  eventStore: IEventStore
): Promise<DomainEvent[]> {
  const projection = new EntryListProjection(eventStore);
  const parent = projection.getTask(command.taskId);
  
  if (!parent) {
    throw new Error(`Task not found: ${command.taskId}`);
  }
  
  const children = projection.getSubTasks(parent.id);
  const incompleteChildren = children.filter(c => c.status !== 'completed');
  
  const events: DomainEvent[] = [];
  
  // If all children complete OR user confirmed cascade:
  if (incompleteChildren.length === 0 || command.cascadeComplete) {
    
    // 1. Complete incomplete children (if cascade)
    if (command.cascadeComplete) {
      for (const child of incompleteChildren) {
        const childCompleteEvent: TaskCompleted = {
          id: generateId(),
          type: 'TaskCompleted',
          aggregateId: child.id,
          timestamp: new Date().toISOString(),
          version: 1,
          payload: {
            taskId: child.id,
            completedAt: new Date().toISOString(),
          },
        };
        events.push(childCompleteEvent);
      }
    }
    
    // 2. Complete parent
    const parentCompleteEvent: TaskCompleted = {
      id: generateId(),
      type: 'TaskCompleted',
      aggregateId: parent.id,
      timestamp: new Date().toISOString(),
      version: 1,
      payload: {
        taskId: parent.id,
        completedAt: new Date().toISOString(),
      },
    };
    events.push(parentCompleteEvent);
    
    await eventStore.appendBatch(events);
    return events;
  } else {
    // Incomplete children and no cascade confirmation → throw error
    throw new Error(
      `Cannot complete parent task. ${incompleteChildren.length} sub-task(s) incomplete. ` +
      `Call with cascadeComplete: true to complete all.`
    );
  }
}
```

**UI Flow:**

```typescript
// User taps complete on parent task:
const parent = getTask(taskId);
const status = projection.getParentCompletionStatus(taskId);

if (!status.allComplete) {
  // Show confirmation modal:
  showConfirmationModal({
    title: 'Incomplete Sub-Tasks',
    message: `You have ${status.total - status.completed} incomplete sub-task(s). Complete anyway?`,
    actions: [
      { label: 'Cancel', role: 'cancel' },
      { 
        label: 'Complete All', 
        role: 'confirm',
        handler: () => completeParentTask({ taskId, cascadeComplete: true })
      },
    ],
  });
} else {
  // All complete → complete parent without warning
  completeParentTask({ taskId, cascadeComplete: false });
}
```

---

### 4.2 Reverse Completion (Manual)

**Rule:** Completing all children does NOT auto-complete parent. Parent requires manual completion.

**Visual nudge:** When last child completes, show toast notification:

```typescript
// In task completion handler:
const parent = projection.getParentTask(completedTask);
if (parent) {
  const status = projection.getParentCompletionStatus(parent.id);
  if (status.allComplete) {
    // All children now complete → nudge user
    showToast({
      message: `All sub-tasks of "${parent.title}" are complete!`,
      action: {
        label: 'Complete Project',
        handler: () => completeTask(parent.id),
      },
      duration: 5000, // 5 second toast
    });
  }
}
```

**Complete button state:**

```typescript
// Parent task's complete button is:
// - DISABLED if any children incomplete
// - ENABLED if all children complete

const canCompleteParent = (task: Task): boolean => {
  const status = projection.getParentCompletionStatus(task.id);
  return status.allComplete;
};
```

---

## 5. Deletion Logic

### 5.1 Deleting Parent Task

**Rule:** Show soft warning. If confirmed, delete parent and orphan all children.

```typescript
export async function handleDeleteParentTask(
  command: DeleteParentTaskCommand,
  eventStore: IEventStore
): Promise<DomainEvent[]> {
  const projection = new EntryListProjection(eventStore);
  const parent = projection.getTask(command.taskId);
  
  if (!parent) {
    throw new Error(`Task not found: ${command.taskId}`);
  }
  
  const children = projection.getSubTasks(parent.id);
  
  if (children.length > 0 && !command.confirmed) {
    throw new Error(
      `Cannot delete parent task. It has ${children.length} sub-task(s). ` +
      `Call with confirmed: true to orphan children.`
    );
  }
  
  const events: DomainEvent[] = [];
  
  // 1. Delete parent
  const deleteEvent: TaskDeleted = {
    id: generateId(),
    type: 'TaskDeleted',
    aggregateId: parent.id,
    timestamp: new Date().toISOString(),
    version: 1,
    payload: {
      taskId: parent.id,
      deletedAt: new Date().toISOString(),
    },
  };
  events.push(deleteEvent);
  
  // 2. Orphan all children (remove parentTaskId)
  for (const child of children) {
    const orphanEvent: TaskOrphaned = {
      id: generateId(),
      type: 'TaskOrphaned',
      aggregateId: child.id,
      timestamp: new Date().toISOString(),
      version: 1,
      payload: {
        taskId: child.id,
        formerParentId: parent.id,
        orphanedAt: new Date().toISOString(),
      },
    };
    events.push(orphanEvent);
  }
  
  await eventStore.appendBatch(events);
  return events;
}
```

**UI Flow:**

```typescript
// User taps delete on parent task:
const children = projection.getSubTasks(taskId);

if (children.length > 0) {
  showConfirmationModal({
    title: 'Delete Task with Sub-Tasks',
    message: `This task has ${children.length} sub-task(s). Delete anyway? Sub-tasks will become standalone tasks.`,
    actions: [
      { label: 'Cancel', role: 'cancel' },
      { 
        label: 'Delete & Orphan', 
        role: 'destructive',
        handler: () => deleteParentTask({ taskId, confirmed: true })
      },
    ],
  });
} else {
  // No children → standard delete
  deleteTask({ taskId });
}
```

---

## 6. UI Components & Visual Design

### 6.1 Visual Indicators

#### Sub-Task Icon (Migrated vs Unmigrated)

```typescript
function getTaskIcon(task: Task, projection: EntryListProjection): string {
  // Top-level task (no parent)
  if (!task.parentTaskId) {
    return task.status === 'completed' ? '☑' : '☐';
  }
  
  // Sub-task (has parent)
  const isMigrated = projection.isSubTaskMigrated(task);
  
  if (task.status === 'completed') {
    return isMigrated ? '🔗☑' : '☑'; // Migrated completed vs regular completed
  } else {
    return isMigrated ? '🔗☐' : '☐'; // Migrated open vs regular open
  }
}
```

**Alternative:** Use CSS styling instead of emoji:

```css
/* Sub-task indicator - small link icon overlay */
.task-item[data-is-subtask="true"][data-is-migrated="true"]::before {
  content: '🔗';
  font-size: 0.75em;
  margin-right: 4px;
  opacity: 0.6;
}

/* Or use different checkbox style */
.task-item[data-is-subtask="true"] .checkbox {
  border-color: var(--color-link);
}
```

**User preference:** Use 🔗 emoji for migrated sub-tasks, regular checkbox for unmigrated.

---

### 6.2 Context Menu Extensions

#### Top-Level Task Menu (Can Have Sub-Tasks)

```typescript
<ContextMenu>
  <MenuItem onClick={completeTask}>Complete</MenuItem>
  <MenuItem onClick={editTask}>Edit</MenuItem>
  <MenuItem onClick={deleteTask}>Delete</MenuItem>
  <MenuItem onClick={migrateTask}>Migrate</MenuItem>
  
  {/* New sub-task options */}
  <MenuDivider />
  <MenuItem onClick={addSubTask} disabled={task.parentTaskId !== undefined}>
    Add Sub-Task
  </MenuItem>
  {/* Future: Break Down Task (guided workflow) */}
</ContextMenu>
```

**Validation:** Disable "Add Sub-Task" if task is already a sub-task (enforce 2-level limit).

---

#### Sub-Task Menu (Has Parent)

```typescript
<ContextMenu>
  <MenuItem onClick={completeTask}>Complete</MenuItem>
  <MenuItem onClick={editTask}>Edit</MenuItem>
  <MenuItem onClick={deleteTask}>Delete</MenuItem>
  <MenuItem onClick={migrateTask}>Migrate</MenuItem>
  
  {/* New: Navigate to parent */}
  <MenuDivider />
  <MenuItem onClick={goToParent}>
    Go to Parent
  </MenuItem>
</ContextMenu>

// Handler:
function goToParent(task: Task) {
  const parent = projection.getParentTask(task);
  if (parent) {
    // Navigate to parent's collection and focus on parent task
    navigateToCollection(parent.collectionId);
    focusTask(parent.id); // Scroll to and highlight parent
  }
}
```

---

#### Migrated Sub-Task Menu (In Parent's Collection View)

When viewing parent's collection, migrated children show "Go to" option:

```typescript
<ContextMenu>
  <MenuItem onClick={completeTask}>Complete</MenuItem>
  <MenuItem onClick={editTask}>Edit</MenuItem>
  <MenuItem onClick={deleteTask}>Delete</MenuItem>
  
  {/* For migrated sub-tasks: Navigate to current collection */}
  {projection.isSubTaskMigrated(task) && (
    <>
      <MenuDivider />
      <MenuItem onClick={goToCurrentCollection}>
        Go to {getCollectionName(task.collectionId)}
      </MenuItem>
    </>
  )}
</ContextMenu>

// Handler:
function goToCurrentCollection(task: Task) {
  navigateToCollection(task.collectionId);
  focusTask(task.id);
}
```

---

### 6.3 Rendering Behavior

#### Daily Log View (Flat List)

```typescript
function DailyLogView({ collectionId }: Props) {
  const entries = projection.getEntriesInCollection(collectionId);
  
  return (
    <EntryList>
      {entries.map(entry => (
        <EntryListItem 
          key={entry.id}
          entry={entry}
          icon={getTaskIcon(entry, projection)}
          // Sub-tasks appear as regular entries (no grouping)
        />
      ))}
    </EntryList>
  );
}
```

**Result:**
```
Today's Log (2026-02-11):
  🔗☐ Write blog post  ⋮ [menu includes "Go to Parent"]
  ☐ Buy groceries
  🔗☐ Deploy to production  ⋮ [menu includes "Go to Parent"]
  ☐ Call dentist
```

---

#### Parent Collection View (Show All Children)

```typescript
function CollectionView({ collectionId }: Props) {
  const topLevelEntries = projection
    .getEntriesInCollection(collectionId)
    .filter(e => e.parentTaskId === undefined); // Only top-level entries
  
  return (
    <EntryList>
      {topLevelEntries.map(entry => (
        <>
          {/* Top-level entry */}
          <EntryListItem 
            key={entry.id}
            entry={entry}
          />
          
          {/* Sub-tasks (if this is a parent task) */}
          {entry.type === 'task' && (
            <SubTaskList 
              parentTaskId={entry.id}
              projection={projection}
            />
          )}
        </>
      ))}
    </EntryList>
  );
}

function SubTaskList({ parentTaskId, projection }: Props) {
  const children = projection.getSubTasks(parentTaskId);
  
  if (children.length === 0) return null;
  
  return (
    <div className="subtask-list">
      {children.map(child => (
        <SubTaskListItem
          key={child.id}
          task={child}
          isMigrated={projection.isSubTaskMigrated(child)}
          parentCollection={projection.getTask(parentTaskId)?.collectionId}
        />
      ))}
    </div>
  );
}

function SubTaskListItem({ task, isMigrated }: Props) {
  return (
    <div className="subtask-item" data-is-migrated={isMigrated}>
      {getTaskIcon(task, projection)} {task.title}
      {isMigrated && (
        <span className="migration-indicator">
          → {getCollectionName(task.collectionId)}
        </span>
      )}
      <ContextMenu>
        {/* Menu with "Go to" if migrated */}
      </ContextMenu>
    </div>
  );
}
```

**Result:**
```
Work Projects:
  ☐ App launch
    ☐ Set up analytics
    🔗☐ Write blog post → Today's Log  ⋮ [menu includes "Go to Today's Log"]
    🔗☐ Deploy to production → Yesterday's Log  ⋮ [menu includes "Go to Yesterday's Log"]
  ☐ Research competitors
```

---

### 6.4 Parent Completion Status Indicator

Show completion progress on parent tasks:

```typescript
function TaskListItem({ task, projection }: Props) {
  const isParent = projection.isParentTask(task);
  
  return (
    <div className="task-item">
      {getTaskIcon(task, projection)} {task.title}
      
      {isParent && (
        <CompletionBadge 
          status={projection.getParentCompletionStatus(task.id)}
        />
      )}
    </div>
  );
}

function CompletionBadge({ status }: { status: CompletionStatus }) {
  const { completed, total, allComplete } = status;
  
  return (
    <span 
      className={`completion-badge ${allComplete ? 'complete' : 'incomplete'}`}
    >
      {completed}/{total}
      {allComplete && ' ✓'}
    </span>
  );
}
```

**Result:**
```
Work Projects:
  ☐ App launch (2/4)
    ☑ Set up analytics
    🔗☐ Write blog post
    🔗☐ Deploy to production
    ☐ Marketing plan
  
  ☐ Research competitors (3/3) ✓  ← All complete, ready to complete parent
    ☑ Analyze pricing
    ☑ Feature comparison
    ☑ SWOT analysis
```

---

## 7. Implementation Plan

### Phase 1: Core Sub-Task Creation & Display (MVP) - **8-10 hours**

**Goal:** Create sub-tasks and see them under parent. No migration yet.

#### 1A: Domain Layer (3-4 hours)

- [ ] Add `parentTaskId?: string` field to `TaskCreated` event payload
- [ ] Create `CreateSubTaskCommand` interface
- [ ] Implement `handleCreateSubTask()` handler
  - Validate parent exists
  - Validate parent is not a sub-task (2-level limit)
  - Generate `TaskCreated` event with `parentTaskId` and parent's `collectionId`
- [ ] Update `Task` interface with `parentTaskId?: string`
- [ ] Add projection queries:
  - `getSubTasks(parentTaskId: string): Task[]`
  - `isSubTask(task: Task): boolean`
  - `isParentTask(task: Task): boolean`
  - `getParentCompletionStatus(parentTaskId: string)`
- [ ] Write tests (20+ test cases):
  - Create sub-task under top-level task ✅
  - Prevent sub-task of sub-task (2-level limit) ✅
  - Query sub-tasks ✅
  - Parent status calculation ✅

#### 1B: UI Layer (5-6 hours)

- [ ] Add "Add Sub-Task" to task context menu (disabled for sub-tasks)
- [ ] Create `CreateSubTaskModal` component (reuse existing modal patterns)
- [ ] Update `TaskListItem` to show sub-tasks indented below parent
- [ ] Add sub-task icon (🔗 for migrated, regular checkbox for unmigrated)
- [ ] Add completion badge to parent tasks (e.g., "2/4")
- [ ] Write component tests

**Deliverable:** User can create sub-tasks and see them under parent in parent's collection.

---

### Phase 2: Migration Behavior (Symlink) - **6-8 hours**

**Goal:** Migrate sub-tasks individually, see symlink behavior (dual presence).

#### 2A: Domain Layer (2-3 hours)

- [ ] Implement `isSubTaskMigrated(task: Task): boolean` projection query
- [ ] Test existing `EntryMovedToCollection` works for sub-tasks
- [ ] Verify `parentTaskId` preserved after migration ✅
- [ ] Write migration tests:
  - Migrate sub-task to different collection ✅
  - Sub-task appears in both collections (query tests) ✅
  - Parent link maintained ✅

#### 2B: UI Layer (4-5 hours)

- [ ] Update daily log view to show migrated sub-tasks with 🔗 icon
- [ ] Add "Go to Parent" menu option for sub-tasks
  - Navigate to parent's collection
  - Focus/highlight parent task
- [ ] Update parent collection view to show ALL children (cross-collection)
  - Show migration indicator: "→ Today's Log"
  - Add "Go to" menu option for migrated children
- [ ] Test symlink rendering:
  - Sub-task appears in daily log ✅
  - Sub-task also appears under parent in parent's collection ✅
  - Icons/indicators correct ✅

**Deliverable:** User can migrate sub-tasks to daily logs and navigate between locations.

---

### Phase 3: Parent Migration (Cascade) - **4-5 hours**

**Goal:** Migrating parent brings unmigrated children along.

#### 3A: Domain Layer (2-3 hours)

- [ ] Implement `handleMoveParentTaskToCollection()` handler
  - Check if parent has children
  - Migrate parent (standard `EntryMovedToCollection`)
  - Migrate children WHERE `child.collectionId === parent.collectionId`
  - Skip children in different collections (already migrated)
- [ ] Support batch event appending (if not exists)
- [ ] Write cascade migration tests:
  - Parent migrates → unmigrated children follow ✅
  - Parent migrates → migrated children stay put ✅
  - Multiple children in different states ✅

#### 3B: UI Layer (2 hours)

- [ ] Test parent migration works seamlessly (no UI changes needed)
- [ ] Verify cascade events appear in audit log
- [ ] Edge case testing

**Deliverable:** Migrating parent brings unmigrated children along automatically.

---

### Phase 4: Completion Logic (Soft Warning + Cascade) - **5-6 hours**

**Goal:** Complete parent only when all children complete, with cascade option.

#### 4A: Domain Layer (3 hours)

- [ ] Implement `handleCompleteParentTask()` handler
  - Check if all children complete
  - If not, throw error (unless `cascadeComplete: true`)
  - If cascade, generate `TaskCompleted` events for all incomplete children
  - Generate `TaskCompleted` event for parent
- [ ] Write completion tests:
  - Complete parent with all children complete ✅
  - Prevent complete parent with incomplete children ✅
  - Cascade complete parent + children ✅
  - Completion status queries ✅

#### 4B: UI Layer (2-3 hours)

- [ ] Disable complete button on parent if children incomplete
- [ ] Show completion badge on parent ("2/4 complete")
- [ ] Show confirmation modal when completing parent with incomplete children:
  - "You have X incomplete sub-tasks. Complete anyway?"
  - [Cancel] [Complete All]
- [ ] Show toast when last child completes: "All sub-tasks complete! Ready to complete project."
- [ ] Test completion flows

**Deliverable:** Parent completion enforces child completion with cascade option.

---

### Phase 5: Deletion Logic (Soft Warning + Orphan) - **3-4 hours**

**Goal:** Deleting parent orphans children (converts to top-level tasks).

#### 5A: Domain Layer (2 hours)

- [ ] Create `TaskOrphaned` event
- [ ] Implement `handleDeleteParentTask()` handler
  - Check if parent has children
  - If yes, throw error (unless `confirmed: true`)
  - Generate `TaskDeleted` event for parent
  - Generate `TaskOrphaned` events for each child
- [ ] Update projection to handle `TaskOrphaned` (set `parentTaskId = undefined`)
- [ ] Write deletion tests:
  - Delete parent → orphan children ✅
  - Orphaned children become top-level ✅
  - Orphaned children stay in their collections ✅

#### 5B: UI Layer (1-2 hours)

- [ ] Show confirmation modal when deleting parent:
  - "This task has X sub-tasks. Delete anyway? Sub-tasks will become standalone tasks."
  - [Cancel] [Delete & Orphan]
- [ ] Test orphan behavior in UI

**Deliverable:** User can delete parent, children become top-level tasks.

---

### Phase 6: Polish & Edge Cases - **4-5 hours**

- [ ] Long-press gesture for "Add Sub-Task" (alternative to menu)
- [ ] Keyboard shortcuts (e.g., Cmd+Shift+Enter to add sub-task)
- [ ] Accessibility (ARIA labels, screen reader support)
- [ ] Animation (expand/collapse sub-tasks)
- [ ] Error handling (parent deleted while viewing sub-task)
- [ ] Loading states (migrating large parent with many children)
- [ ] Performance optimization (virtualization for 100+ sub-tasks)
- [ ] Documentation (user guide, tooltips)

**Deliverable:** Production-ready sub-tasks feature with polish.

---

### Total Estimated Time: **30-38 hours** (4-5 full work days)

**Phased Rollout:**
- **Week 1:** Phase 1 (core creation) → Ship to production, gather feedback
- **Week 2:** Phase 2-3 (migration) → Ship symlink behavior
- **Week 3:** Phase 4-5 (completion/deletion) → Ship full feature
- **Week 4:** Phase 6 (polish) → Final polish

---

## 8. Future Enhancements (Post-MVP)

### 8.1 Unlimited Nesting (If Needed)

**Effort:** 1-2 hours (remove validation, add recursive tree component)

**Changes:**
- Remove 2-level validation in `handleCreateSubTask()`
- Add recursive `TaskTreeNode` component (optional, can keep flat list)
- Test deep nesting (3+ levels)

**No data model or event schema changes needed** (already supports unlimited nesting).

---

### 8.2 Guided Breakdown Workflow

**Effort:** 6-8 hours

Add "Break Down Task" menu option that opens guided modal:

```
[Break Down Task]
→ Modal: "What steps are needed to complete '{task.title}'?"
  Step 1: [Input]
  Step 2: [Input]
  [+ Add Step]
  [Create All Sub-Tasks]
```

Batch-creates multiple sub-tasks in one flow.

---

### 8.3 Drag-and-Drop Re-Parenting

**Effort:** 8-10 hours

Allow dragging sub-task to different parent:

```
☐ App launch
  ☐ Write blog post  ← Drag this
  ☐ Deploy

☐ Marketing campaign  ← Drop here
  (Write blog post becomes child of Marketing campaign)
```

Requires new event: `TaskReparented { taskId, oldParentId, newParentId }`.

---

### 8.4 Sub-Task Templates

**Effort:** 10-12 hours

Save common sub-task patterns as templates:

```
Template: "App Launch Checklist"
  - Write blog post
  - Update documentation
  - Deploy to production
  - Announce on social media

[Apply Template] → Creates all 4 sub-tasks instantly
```

---

### 8.5 Auto-Complete Parent (Reverse Cascade)

**Effort:** 2-3 hours

Add user preference: "Auto-complete parent when all children complete"

If enabled:
- Last child completes → parent auto-completes
- Show toast: "Project '{parent.title}' completed!"

**Currently:** Manual completion only (user must complete parent explicitly).

---

## 9. Testing Strategy

### 9.1 Domain Layer Tests (Vitest)

**Event Handlers:**
- ✅ Create sub-task under top-level task
- ✅ Prevent sub-task of sub-task (2-level limit)
- ✅ Sub-task inherits parent's `collectionId`
- ✅ Migrate sub-task (standard `EntryMovedToCollection`)
- ✅ Migrate parent → unmigrated children cascade
- ✅ Migrate parent → migrated children stay put
- ✅ Complete parent with all children complete
- ✅ Prevent complete parent with incomplete children
- ✅ Cascade complete parent + all children
- ✅ Delete parent → orphan all children
- ✅ Orphaned children become top-level tasks

**Projections:**
- ✅ `getSubTasks()` returns all children (cross-collection)
- ✅ `isSubTaskMigrated()` detects collection mismatch
- ✅ `getParentCompletionStatus()` counts correctly
- ✅ `TaskOrphaned` event removes `parentTaskId`
- ✅ Replay events rebuilds correct parent-child state

---

### 9.2 UI Component Tests (Vitest + Testing Library)

- ✅ "Add Sub-Task" menu disabled for sub-tasks
- ✅ "Go to Parent" menu appears for sub-tasks
- ✅ Sub-task icon shows 🔗 for migrated, regular for unmigrated
- ✅ Parent shows completion badge ("2/4")
- ✅ Confirmation modal appears when completing parent with incomplete children
- ✅ Confirmation modal appears when deleting parent with children
- ✅ Toast appears when last child completes
- ✅ Navigation works ("Go to Parent", "Go to" for migrated)

---

### 9.3 Integration Tests (Manual QA)

- ✅ Create sub-task → appears under parent in parent's collection
- ✅ Migrate sub-task to daily log → appears in both locations (symlink)
- ✅ Complete all children → parent complete button enabled
- ✅ Complete parent with incomplete children → shows warning modal
- ✅ Migrate parent → unmigrated children follow, migrated stay
- ✅ Delete parent → children become top-level, stay in their collections
- ✅ Offline sync: Create sub-task offline → syncs to Firestore when online
- ✅ Multi-device: Sub-task created on phone appears on desktop

---

## 10. Architectural Principles Validation

### SOLID Principles

✅ **Single Responsibility**
- `TaskCreated` event handles task creation (parent or child)
- `TaskOrphaned` event handles orphaning (separate concern)
- Projections handle queries, handlers handle commands (CQRS)

✅ **Open/Closed**
- Adding sub-tasks extends `TaskCreated` (new field), doesn't modify existing events
- New queries (`getSubTasks`) extend projection, don't modify existing methods
- Can add unlimited nesting later without changing data model

✅ **Liskov Substitution**
- Sub-tasks are tasks (same interface, all task operations work)
- `EntryMovedToCollection` works for tasks and sub-tasks (no special casing)

✅ **Interface Segregation**
- `CreateSubTaskCommand` separate from `CreateTaskCommand` (different intent)
- Projection queries targeted (no bloated "get everything" methods)

✅ **Dependency Inversion**
- UI depends on `EntryListProjection` abstraction
- Handlers depend on `IEventStore` interface
- Migration logic uses projection queries, not direct data access

---

### Event Sourcing Best Practices

✅ **Events are immutable facts**
- `TaskCreated` with `parentTaskId` is a fact (can't change parent later in MVP)
- `TaskOrphaned` is a fact (parent was deleted, child now orphaned)
- `EntryMovedToCollection` preserves `parentTaskId` (link maintained)

✅ **Commands express intent**
- `CreateSubTaskCommand` (intent: add sub-task)
- `CompleteParentTaskCommand` (intent: complete parent, optionally cascade)
- `DeleteParentTaskCommand` (intent: delete parent, confirmed orphaning)

✅ **Projections rebuild from events**
- `getSubTasks()` queries current state (replayed from `TaskCreated` events)
- `isSubTaskMigrated()` derived from comparing `collectionId` fields
- No dual writes, no state inconsistency

✅ **Backward compatibility**
- `parentTaskId?: string` is optional (existing events → top-level tasks)
- Old clients ignore `parentTaskId` (graceful degradation)
- Schema version in `DomainEvent` enables future migrations

---

## 11. Open Questions / Future Decisions

### 11.1 Re-Parenting (Not MVP)

**Question:** Can user move sub-task from one parent to another?

**Example:**
```
☐ App launch
  ☐ Write blog post  ← Move this

☐ Marketing campaign  ← To this parent
```

**Options:**
- **A:** Parent is immutable (like events) → can't re-parent
- **B:** Allow re-parenting via new event: `TaskReparented { taskId, oldParentId, newParentId }`

**Decision:** Defer to user feedback. MVP has immutable parent (can orphan + re-create if needed).

---

### 11.2 Sub-Task Visibility Preferences

**Question:** Should user be able to hide completed sub-tasks under parent?

**Example:**
```
☐ App launch (2/4 complete)
  ☐ Deploy to production
  ☐ Marketing plan
  [+ 2 completed sub-tasks] ← Collapsed by default
```

**Options:**
- **A:** Always show all sub-tasks (transparent)
- **B:** Add collapse/expand toggle (less clutter)
- **C:** User preference per collection

**Decision:** Defer to Phase 6 (polish). Start with always-show (simpler).

---

### 11.3 Sub-Task Sorting

**Question:** How should sub-tasks be ordered under parent?

**Options:**
- **A:** Creation order (chronological)
- **B:** Manual reorder (drag-and-drop, requires `order` field)
- **C:** Completion status (incomplete first, completed last)

**Current:** Sub-tasks have `order` field (inherited from parent's collection). Use existing fractional index system.

**Decision:** Manual reorder (same as top-level tasks). Already supported by existing `TaskReordered` event.

---

## Conclusion

This design provides a complete specification for implementing sub-tasks in Squickr Life. The architecture:

- **Solves the core problem:** Break down overwhelming tasks into actionable steps
- **Maintains event sourcing principles:** Immutable events, projection queries, CQRS
- **Enables symlink behavior:** Sub-tasks appear in multiple collections (dual presence)
- **Zero tech debt for future expansion:** Unlimited nesting requires 1-2 hours (remove validation)
- **Ships in phases:** 4-5 weeks from start to fully polished feature

**Next Steps:**
1. **Casey (Reviewer):** Review this design, provide feedback
2. **Sam (Implementer):** Begin Phase 1 (core creation & display)
3. **User:** Test MVP in production, provide feedback for iteration

**Total Estimated Effort:** 30-38 hours across 6 phases

---

**End of Design Document**
