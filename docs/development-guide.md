# Development Guide

Practical guide for working with the Squickr Life codebase.

## Table of Contents
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing Patterns](#testing-patterns)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)
- [Windows-Specific Notes](#windows-specific-notes)

---

## Project Structure

```
squickr/life/
├── packages/
│   ├── shared/          # Domain logic + event sourcing
│   │   ├── src/
│   │   │   ├── event-store.ts           # Core event store
│   │   │   ├── task.types.ts            # Type definitions
│   │   │   ├── task.handlers.ts         # Task command handlers
│   │   │   ├── note.handlers.ts         # Note command handlers
│   │   │   ├── event.handlers.ts        # Event command handlers
│   │   │   ├── entry-list.projection.ts # Unified projection
│   │   │   ├── content-validation.ts    # Shared validators
│   │   │   └── index.ts                 # Public API
│   │   └── tests/
│   │       ├── task.handlers.test.ts
│   │       ├── note.handlers.test.ts
│   │       ├── event.handlers.test.ts
│   │       └── entry-list.projection.test.ts
│   │
│   └── client/          # React UI
│       ├── src/
│       │   ├── components/
│       │   │   ├── TaskInput.tsx    # (Will become EntryInput)
│       │   │   ├── TaskList.tsx     # (Will become EntryList)
│       │   │   └── TaskItem.tsx     # (Will become EntryItem)
│       │   ├── hooks/
│       │   │   └── useDragAndDrop.ts
│       │   └── App.tsx
│       └── tests/
│
└── docs/
    ├── current-status.md           # Living status document
    ├── development-guide.md        # This file
    ├── opencode-workflow.md        # Agent workflow guide
    ├── architecture-decisions.md   # ADRs with status
    └── README.md                   # Documentation index
```

### Key Files to Know

**Domain Layer (`packages/shared/src/`):**
- `event-store.ts` - In-memory event store with persistence
- `*.handlers.ts` - Command handlers (create, update, complete, reorder)
- `entry-list.projection.ts` - Unified view of all entries (tasks, notes, events)
- `content-validation.ts` - Shared validation logic

**Client Layer (`packages/client/src/`):**
- `App.tsx` - Main application, initializes handlers and projections
- `components/*.tsx` - React components (currently task-focused, will support all entry types)
- `hooks/useDragAndDrop.ts` - Drag-and-drop logic for reordering

---

## Development Workflow

### 1. Making Changes

Follow Test-Driven Development (TDD):

```bash
# 1. Write failing test
# Edit: packages/shared/tests/[feature].test.ts

# 2. Run tests (should fail)
cd packages/shared
pnpm test run

# 3. Implement feature
# Edit: packages/shared/src/[feature].ts

# 4. Run tests again (should pass)
pnpm test run

# 5. Refactor if needed
# Keep tests green

# 6. Build to check TypeScript
pnpm run build
```

### 2. Code Review Workflow

When a feature is complete:

1. OpenCode says: **"Ready for code review"**
2. User says: **"review"**
3. OpenCode launches review agent
4. Agent provides feedback
5. User does manual review + testing
6. User says: **"commit"**
7. OpenCode commits changes

### 3. Running the Application

```bash
# Terminal 1: Start client dev server
cd packages/client
pnpm dev
# Opens browser to http://localhost:5173

# Terminal 2: Run tests in watch mode (optional)
cd packages/shared
pnpm test
```

---

## Testing Patterns

### Testing Command Handlers

**Pattern:** Arrange → Act → Assert on events

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { EventStore } from '../src/event-store';
import { CreateTaskHandler } from '../src/task.handlers';

describe('CreateTaskHandler', () => {
  let eventStore: EventStore;
  let handler: CreateTaskHandler;

  beforeEach(() => {
    eventStore = new EventStore();
    handler = new CreateTaskHandler(eventStore);
  });

  it('should create a task with valid input', () => {
    // Arrange
    const command = {
      type: 'create-task' as const,
      taskId: 'task-1',
      title: 'Buy milk',
    };

    // Act
    handler.handle(command);

    // Assert
    const events = eventStore.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'task-created',
      aggregateId: 'task-1',
      data: {
        taskId: 'task-1',
        title: 'Buy milk',
        status: 'open',
      },
    });
  });

  it('should throw for invalid input', () => {
    const command = {
      type: 'create-task' as const,
      taskId: 'task-1',
      title: '',  // Invalid: empty title
    };

    expect(() => handler.handle(command)).toThrow('Title cannot be empty');
  });
});
```

### Testing Projections

**Pattern:** Given events → When projection replays → Then state is correct

```typescript
describe('EntryListProjection', () => {
  let eventStore: EventStore;
  let projection: EntryListProjection;

  beforeEach(() => {
    eventStore = new EventStore();
    projection = new EntryListProjection(eventStore);
  });

  it('should project tasks, notes, and events', () => {
    // Given: Events in the store
    eventStore.append({
      type: 'task-created',
      aggregateId: 'task-1',
      data: { taskId: 'task-1', title: 'Buy milk', status: 'open' },
      timestamp: new Date().toISOString(),
    });
    
    eventStore.append({
      type: 'note-created',
      aggregateId: 'note-1',
      data: { noteId: 'note-1', content: 'Remember to call mom' },
      timestamp: new Date().toISOString(),
    });

    // When: Projection rebuilds
    projection.rebuild();

    // Then: State contains both entries
    const entries = projection.getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ type: 'task', id: 'task-1' });
    expect(entries[1]).toMatchObject({ type: 'note', id: 'note-1' });
  });
});
```

### Testing React Components

**Pattern:** Render → Interact → Assert on UI changes

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TaskInput } from '../src/components/TaskInput';

describe('TaskInput', () => {
  it('should call onSubmit when form is submitted', () => {
    const onSubmit = vi.fn();
    render(<TaskInput onSubmit={onSubmit} />);

    const input = screen.getByPlaceholderText(/new task/i);
    fireEvent.change(input, { target: { value: 'Buy milk' } });
    fireEvent.submit(input.closest('form')!);

    expect(onSubmit).toHaveBeenCalledWith('Buy milk');
  });
});
```

---

## Common Tasks

### Adding a New Command Handler

**Example:** Adding a "DeleteTaskHandler"

1. **Define command type** (`packages/shared/src/task.types.ts`):
```typescript
export type DeleteTaskCommand = {
  type: 'delete-task';
  taskId: string;
};
```

2. **Define event type** (`packages/shared/src/task.types.ts`):
```typescript
export type TaskDeleted = {
  type: 'task-deleted';
  aggregateId: string;
  data: {
    taskId: string;
  };
  timestamp: string;
};
```

3. **Write test** (`packages/shared/tests/task.handlers.test.ts`):
```typescript
describe('DeleteTaskHandler', () => {
  it('should delete an existing task', () => {
    // Arrange: Create task first
    const createHandler = new CreateTaskHandler(eventStore);
    createHandler.handle({ type: 'create-task', taskId: 'task-1', title: 'Buy milk' });

    // Act: Delete it
    const deleteHandler = new DeleteTaskHandler(eventStore);
    deleteHandler.handle({ type: 'delete-task', taskId: 'task-1' });

    // Assert: TaskDeleted event appended
    const events = eventStore.getEvents();
    expect(events[1].type).toBe('task-deleted');
  });
});
```

4. **Implement handler** (`packages/shared/src/task.handlers.ts`):
```typescript
export class DeleteTaskHandler {
  constructor(private eventStore: EventStore) {}

  handle(command: DeleteTaskCommand): void {
    const { taskId } = command;

    // Validate task exists
    const events = this.eventStore.getEvents();
    const taskExists = events.some(
      e => e.aggregateId === taskId && e.type === 'task-created'
    );
    if (!taskExists) throw new Error('Task not found');

    // Append event
    this.eventStore.append({
      type: 'task-deleted',
      aggregateId: taskId,
      data: { taskId },
      timestamp: new Date().toISOString(),
    });
  }
}
```

5. **Update projection** to handle new event
6. **Export** from `index.ts`
7. **Wire up** in `App.tsx`

### Adding a New Aggregate Type

Already have Task, Note, Event. If you need a fourth type (e.g., "Goal"):

1. Define types in `task.types.ts` (or create `goal.types.ts`)
2. Create handlers in `goal.handlers.ts`
3. Update `entry-list.projection.ts` to include Goals
4. Write tests for all handlers
5. Update UI components to handle `type: 'goal'`

### Running Specific Tests

```bash
# Run all tests
pnpm test run

# Run specific test file
pnpm test run task.handlers.test.ts

# Run tests matching pattern
pnpm test run --grep "CreateTaskHandler"

# Run tests in watch mode
pnpm test
```

### Debugging Event Store

Add temporary logging to see event stream:

```typescript
// In App.tsx or any component
useEffect(() => {
  const events = eventStore.getEvents();
  console.log('All events:', events);
}, []);
```

Or use browser DevTools:
1. Open Console
2. Type: `localStorage.getItem('squickr-life-events')`
3. See raw event JSON

---

## Troubleshooting

### Tests Fail After Adding New Handler

**Problem:** New handler works but breaks existing tests.

**Solution:** Check if you modified shared types. Update all affected tests.

```bash
# Run all tests to see full picture
pnpm test run
```

### TypeScript Errors: "Type X is not assignable to type Y"

**Problem:** Discriminated union type mismatch.

**Solution:** Ensure all entry types have correct `type` discriminant:

```typescript
// Correct
const task: Entry = {
  type: 'task',  // Must be literal 'task'
  id: 'task-1',
  title: 'Buy milk',
  status: 'open',
  order: 0,
};

// Wrong
const task: Entry = {
  type: taskType,  // Variable - breaks type narrowing
  ...
};
```

### UI Not Updating After Command

**Problem:** Called handler but UI doesn't reflect change.

**Solution:** Check:
1. Did handler append event to event store?
2. Did projection subscribe to event store?
3. Did React component trigger re-render?

```typescript
// Verify projection is subscribed
projection.rebuild();  // Force rebuild
console.log(projection.getEntries());  // Check state
```

### Drag-and-Drop Not Working

**Problem:** Items don't reorder when dragged.

**Solution:** Check:
1. Are items setting `draggable={true}`?
2. Is `useDragAndDrop` hook being used?
3. Does ReorderHandler exist for this entry type?
4. Check browser console for errors

### Build Fails with "Cannot find module"

**Problem:** Import paths broken after moving files.

**Solution:** 
1. Check `packages/shared/src/index.ts` exports
2. Verify relative import paths
3. Run `pnpm install` in workspace root

```bash
# Clean install
rm -rf node_modules packages/*/node_modules
pnpm install
```

### localStorage Data Corruption

**Problem:** App crashes on load with "Unexpected token" or similar.

**Solution:** Clear localStorage:

```javascript
// In browser console
localStorage.removeItem('squickr-life-events');
location.reload();
```

---

## Windows-Specific Notes

### Using PowerShell for Commands

**Problem:** Commands fail in Windows Command Prompt.

**Solution:** Use PowerShell and proper quoting:

```powershell
# Correct
powershell.exe -Command "cd 'C:\Repos\squickr\life\packages\shared'; pnpm test run"

# Wrong
cd C:\Repos\squickr\life\packages\shared && pnpm test run
```

### Path Separators

Use forward slashes in npm scripts, backslashes for Windows commands:

```json
// package.json (use forward slashes)
"scripts": {
  "test": "vitest"
}
```

```powershell
# PowerShell (use backslashes or quotes)
cd C:\Repos\squickr\life
cd "C:\Repos\squickr\life"
```

### Line Endings

Git may auto-convert CRLF ↔ LF. Set consistent line endings:

```bash
# .gitattributes
* text=auto
*.ts eol=lf
*.tsx eol=lf
```

---

## Best Practices

### 1. Event Naming

Use past tense: `TaskCreated`, `TaskCompleted` (not `CreateTask`, `CompleteTask`)

### 2. Command Naming

Use imperative: `CreateTaskCommand`, `CompleteTaskCommand`

### 3. Validation

Put validation in handlers, not in UI:

```typescript
// Good
class CreateTaskHandler {
  handle(command: CreateTaskCommand) {
    if (!command.title?.trim()) {
      throw new Error('Title cannot be empty');
    }
    // ...
  }
}

// Bad (validation in UI only)
<input onChange={e => {
  if (!e.target.value) alert('Title required');
}} />
```

### 4. Type Safety

Always use discriminated unions for polymorphic data:

```typescript
// Good
type Entry = 
  | (Task & { type: 'task' })
  | (Note & { type: 'note' })
  | (Event & { type: 'event' });

// Bad
type Entry = Task | Note | Event;  // No way to discriminate
```

### 5. Testing

Test behavior, not implementation:

```typescript
// Good - tests behavior
it('should mark task as completed', () => {
  handler.handle({ type: 'complete-task', taskId: 'task-1' });
  const events = eventStore.getEvents();
  expect(events.some(e => e.type === 'task-completed')).toBe(true);
});

// Bad - tests implementation details
it('should call eventStore.append', () => {
  const spy = vi.spyOn(eventStore, 'append');
  handler.handle({ type: 'complete-task', taskId: 'task-1' });
  expect(spy).toHaveBeenCalled();
});
```

---

## Quick Reference

### Run Tests
```bash
cd packages/shared
pnpm test run
```

### Run Dev Server
```bash
cd packages/client
pnpm dev
```

### Build Everything
```bash
cd packages/shared
pnpm run build

cd ../client
pnpm run build
```

### Check Types
```bash
cd packages/shared
pnpm run build  # Runs tsc
```

### Format Code
```bash
# If prettier configured
pnpm run format
```

---

For architecture decisions, see `architecture-decisions.md`.  
For current implementation status, see `current-status.md`.  
For OpenCode workflow, see `opencode-workflow.md`.
