# Development Guide

Practical guide for working with the Squickr Life codebase.

## Table of Contents
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing Patterns](#testing-patterns)
- [Common Tasks](#common-tasks)

---

## Project Structure

```
squickr/life/
├── packages/
│   ├── shared/              # Domain logic + event sourcing
│   │   ├── src/
│   │   │   ├── event-store.ts
│   │   │   ├── indexeddb-event-store.ts
│   │   │   ├── task.types.ts
│   │   │   ├── *.handlers.ts         # Command handlers
│   │   │   ├── entry.projections.ts  # Read models
│   │   │   ├── date-utils.ts
│   │   │   └── index.ts
│   │   └── tests/
│   │
│   └── client/              # React UI
│       ├── src/
│       │   ├── App.tsx
│       │   ├── components/
│       │   └── utils/
│       └── tests/
│
├── .opencode/
│   ├── agents/              # Alex, Casey, Sam, Diane
│   └── commands/            # /design, /implement, /debug, /review
│
└── docs/
    ├── README.md
    ├── opencode-workflow.md
    ├── development-guide.md        # This file
    ├── architecture-decisions.md
    └── event-models.md
```

### Key Files

**Domain Layer:**
- `event-store.ts` / `indexeddb-event-store.ts` - Event persistence
- `*.handlers.ts` - Command handlers (create, update, delete, reorder)
- `entry.projections.ts` - Read models (reactive subscriptions)
- `task.types.ts` - All type definitions

**Client Layer:**
- `App.tsx` - Initializes handlers and projections
- `components/DailyLogsView.tsx` - Main UI container
- `components/Entry*.tsx` - Entry components

---

## Development Workflow

### TDD Red-Green-Refactor

```bash
# 1. RED: Write failing test
cd packages/shared
# Edit: tests/[feature].test.ts

# 2. Run tests (should fail)
pnpm test run

# 3. GREEN: Implement minimal code
# Edit: src/[feature].ts

# 4. Run tests (should pass)
pnpm test run

# 5. REFACTOR: Clean up, keep tests green
```

### With Agents

Use slash commands from OpenCode:

```bash
# Design first (if complex)
/design event model for recurring tasks

# Implement with TDD
/implement add recurring tasks feature

# Debug if issues
/debug tasks duplicating on submit

# Always review before commit
/review
```

### Running the App

```bash
# Dev server
cd packages/client
pnpm dev
# → http://localhost:3002

# Tests
cd packages/shared
pnpm test run           # Run once
pnpm test              # Watch mode

# Build
cd packages/shared
pnpm run build
```

---

## Testing Patterns

### Handler Tests (Arrange-Act-Assert)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { EventStore, CreateTaskHandler } from '@squickr/shared';

describe('CreateTaskHandler', () => {
  let eventStore: EventStore;
  let handler: CreateTaskHandler;

  beforeEach(() => {
    eventStore = new EventStore();
    handler = new CreateTaskHandler(eventStore);
  });

  it('should create task and append event', () => {
    // Arrange
    const command = { title: 'Buy milk' };

    // Act
    handler.handle(command);

    // Assert
    const events = eventStore.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'task-created',
      data: { title: 'Buy milk', status: 'open' }
    });
  });

  it('should throw for empty title', () => {
    expect(() => handler.handle({ title: '' }))
      .toThrow('Title cannot be empty');
  });
});
```

### Projection Tests (Given-When-Then)

```typescript
describe('EntryListProjection', () => {
  let eventStore: EventStore;
  let projection: EntryListProjection;

  beforeEach(() => {
    eventStore = new EventStore();
    projection = new EntryListProjection(eventStore);
  });

  it('should rebuild state from events', async () => {
    // Given: Events in store
    await eventStore.append({
      type: 'task-created',
      aggregateId: 'task-1',
      data: { taskId: 'task-1', title: 'Buy milk', status: 'open' },
      timestamp: new Date().toISOString()
    });

    // When: Get entries from projection
    const entries = await projection.getEntries();

    // Then: State matches events
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      type: 'task',
      id: 'task-1',
      title: 'Buy milk'
    });
  });
});
```

### React Component Tests

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { EntryInput } from './EntryInput';

describe('EntryInput', () => {
  it('should call onSubmit when Enter pressed', () => {
    const onSubmit = vi.fn();
    render(<EntryInput onSubmit={onSubmit} />);

    const input = screen.getByPlaceholderText(/add entry/i);
    fireEvent.change(input, { target: { value: 'Buy milk' } });
    fireEvent.submit(input.closest('form')!);

    expect(onSubmit).toHaveBeenCalledWith('Buy milk');
    expect(onSubmit).toHaveBeenCalledTimes(1); // Prevent double-submit!
  });
});
```

---

## Common Tasks

### Adding a New Handler

**Example:** Create `DeleteTaskHandler`

1. **Define types** (`task.types.ts`):
```typescript
export type DeleteTaskCommand = {
  type: 'delete-task';
  taskId: string;
};

export type TaskDeleted = {
  type: 'task-deleted';
  aggregateId: string;
  data: { taskId: string };
  timestamp: string;
};
```

2. **Write test** (`tests/task.handlers.test.ts`):
```typescript
it('should delete existing task', () => {
  // Arrange: Create task
  createHandler.handle({ title: 'Buy milk' });
  const taskId = eventStore.getEvents()[0].aggregateId;

  // Act: Delete it
  deleteHandler.handle({ taskId });

  // Assert: TaskDeleted event
  const events = eventStore.getEvents();
  expect(events[1].type).toBe('task-deleted');
});
```

3. **Implement handler** (`task.handlers.ts`):
```typescript
export class DeleteTaskHandler {
  constructor(private eventStore: IEventStore) {}

  async handle(command: DeleteTaskCommand): Promise<void> {
    const { taskId } = command;

    // Validate task exists
    const events = await this.eventStore.getEvents();
    const exists = events.some(
      e => e.aggregateId === taskId && e.type === 'task-created'
    );
    if (!exists) throw new Error('Task not found');

    // Append event
    await this.eventStore.append({
      type: 'task-deleted',
      aggregateId: taskId,
      data: { taskId },
      timestamp: new Date().toISOString()
    });
  }
}
```

4. **Update projection** to handle `task-deleted`
5. **Export** from `index.ts`
6. **Wire up** in `App.tsx`

---

### Adding a New Aggregate Type

We have: Task, Note, Event. To add a fourth (e.g., "Collection"):

1. Define types in `collection.types.ts`
2. Create handlers in `collection.handlers.ts`
3. Update `Entry` union type in `task.types.ts`
4. Update `EntryListProjection` to handle collection events
5. Write tests for all handlers
6. Update UI components to render collections

---

### Event Sourcing Best Practices

**Event Naming:**
- ✅ Past tense: `TaskCreated`, `TaskCompleted`
- ❌ Not imperative: `CreateTask`, `CompleteTask`

**Command Naming:**
- ✅ Imperative: `CreateTaskCommand`
- ❌ Not past tense: `TaskCreatedCommand`

**Validation:**
```typescript
// ✅ Good: Validate in handler
class CreateTaskHandler {
  handle(command: CreateTaskCommand) {
    if (!command.title?.trim()) {
      throw new Error('Title cannot be empty');
    }
    // ...
  }
}

// ❌ Bad: Validation only in UI
<input onChange={e => {
  if (!e.target.value) alert('Required');
}} />
```

**Type Safety:**
```typescript
// ✅ Good: Discriminated union
type Entry = 
  | (Task & { type: 'task' })
  | (Note & { type: 'note' })
  | (Event & { type: 'event' });

// ❌ Bad: No discriminant
type Entry = Task | Note | Event;
```

**Reactive Projections:**
```typescript
// ✅ Good: Subscribe to event store
constructor(private eventStore: IEventStore) {
  this.eventStore.subscribe(() => {
    this.notifySubscribers(); // Tell UI to reload
  });
}

// ❌ Bad: Manually reload after each command
await createTaskHandler.handle(command);
await projection.rebuild(); // Fragile, easy to forget
```

---

## Quick Commands

```bash
# Run tests
cd C:/Repos/squickr/life
cd packages/shared && pnpm test run

# Start dev server
cd packages/client && pnpm dev

# Build
cd packages/shared && pnpm run build

# Git
git status
git log --oneline -10
git diff
```

---

## Further Reading

- **Architecture decisions:** `docs/architecture-decisions.md`
- **Event model reference:** `docs/event-models.md`
- **Agent workflow:** `docs/opencode-workflow.md`
- **Code:** `packages/shared/src/` (TypeScript is self-documenting)
