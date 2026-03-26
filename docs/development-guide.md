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
│   ├── domain/              # Pure business logic + event sourcing
│   │   └── src/
│   │       ├── event-store.ts
│   │       ├── task.types.ts
│   │       ├── *.handlers.ts         # Command handlers
│   │       ├── entry.projections.ts  # Read models
│   │       ├── date-utils.ts
│   │       └── index.ts
│   │
│   ├── infrastructure/      # Storage implementations
│   │   └── src/
│   │       ├── indexeddb-event-store.ts
│   │       └── index.ts
│   │
│   └── client/              # React UI
│       ├── src/
│       │   ├── App.tsx
│       │   ├── components/
│       │   └── utils/
│       └── tests/
│
├── .opencode/
│   ├── agents/              # Alex, Casey, Sam
│   └── commands/            # /design, /implement, /review
│
└── docs/
    ├── README.md
    ├── opencode-workflow.md
    ├── development-guide.md        # This file
    ├── architecture-decisions.md

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
cd packages/domain
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

# Always review before commit
/review
```

### Running the App

```bash
# Dev server
cd packages/client
pnpm dev
# → http://localhost:3000

# Tests
cd packages/domain
pnpm test run           # Run once
pnpm test              # Watch mode

# Build
cd packages/domain
pnpm run build
```

---

## Testing Patterns

### Handler Tests (Arrange-Act-Assert)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { CreateTaskHandler } from '@squickr/domain';
import { InMemoryEventStore } from '@squickr/infrastructure';

describe('CreateTaskHandler', () => {
  let eventStore: InMemoryEventStore;
  let handler: CreateTaskHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
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

### Testing Date/Time-Dependent Code

**Critical:** Tests that depend on the current date or time must mock the system clock. Never rely on `new Date()` returning "today's date" in tests.

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';

describe('Auto-Favorited Daily Logs', () => {
  afterEach(() => {
    // ALWAYS restore real timers after each test
    vi.useRealTimers();
  });

  it('should recognize today as a recent daily log', () => {
    // Mock system time to a specific date
    const testDate = new Date('2026-02-09T12:00:00.000Z');
    vi.setSystemTime(testDate);

    // Now new Date() will return Feb 9, 2026
    const today = new Date();
    expect(today.toISOString()).toContain('2026-02-09');

    // Test your date-dependent logic
    const isRecent = isRecentDailyLog('2026-02-09');
    expect(isRecent).toBe(true);
  });
});
```

**Why this matters:**
- A test written on Feb 9 with hardcoded `'2026-02-09'` will pass on Feb 9
- The same test will fail on Feb 11 when `new Date()` returns Feb 11
- This causes **intermittent CI failures** that are hard to debug

**When to mock time:**
- ✅ Any test with `new Date()` in production code
- ✅ Tests comparing dates (today, yesterday, tomorrow)
- ✅ Tests using `Date.now()` or `performance.now()`
- ✅ Tests with timeouts or intervals

**Cleanup is mandatory:**
```typescript
afterEach(() => {
  vi.useRealTimers(); // Prevents time mocking from leaking to other tests
});
```

### CI Timezone Rule: Always Anchor to UTC Noon

**CI runs on UTC.** Any test that pins the clock with `vi.setSystemTime()` and then computes a local date string must follow this rule:

> **Use UTC noon (`T12:00:00Z`) as the anchor.** At noon UTC, `getFullYear/getMonth/getDate` return the same calendar date in every timezone from UTC-11 to UTC+11.

**Compute expected date strings dynamically — never hardcode them:**

```typescript
// ✅ Correct — works on UTC CI and any local machine
vi.useFakeTimers();
vi.setSystemTime(new Date('2026-03-26T12:00:00Z')); // UTC noon

const now = new Date();
const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
// localToday === '2026-03-26' in any timezone

expect(result.lastEntry.date).toBe(localToday); // ✅ always passes

// ❌ Wrong — only works on UTC− machines, fails on CI
vi.setSystemTime(new Date('2026-03-26T02:00:00Z'));
const localToday = '2026-03-25'; // hardcoded: assumes UTC-3 or more negative
expect(result.lastEntry.date).toBe(localToday); // ❌ fails on UTC runner
```

**Testing tomorrow/yesterday relative to a mocked today:**

```typescript
vi.useFakeTimers();
vi.setSystemTime(new Date('2026-03-26T12:00:00Z'));

const now = new Date();
const pad = (n: number) => String(n).padStart(2, '0');
const localToday    = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

const tomorrow = new Date(now);
tomorrow.setDate(tomorrow.getDate() + 1);
const localTomorrow = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
```

**Why not test the UTC/local boundary directly?**
The UTC-boundary edge case (e.g. "UTC is March 26 but local is still March 25") can only be exercised on a machine with a real UTC− offset. On a UTC CI runner the two dates are always equal, so the test can never be green. Trust the code review that `getFullYear/getMonth/getDate` is correct; test the observable behaviour (today succeeds, tomorrow throws) portably instead.

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

## Session End Workflow

At the end of each coding session:

### 1. Update Documentation
```bash
# Update CHANGELOG.md with shipped changes
# Include version, features, fixes, breaking changes

# Update next-session-roadmap.md
# Move completed items to done, add new backlog items
```

### 2. Clean Up Session Notes
```bash
# Keep last 2-3 session notes (recent context)
# Delete older session notes (preserved in git history)
git rm docs/session-2026-[old-dates]*.md
git commit -m "chore: clean up old session notes"
```

### 3. Commit Changes
```bash
# Review what's changed
git status
git diff --stat

# Commit with clear message
git add .
git commit -m "feat: description of what shipped"
git push origin master
```

### 4. Deploy (if ready)
```bash
# See docs/deployment-guide.md for full process
# 1. Bump version in package.json
# 2. Create PR: master → production
# 3. Merge after validation passes
```

**Why clean up session notes?**
- Reduces token budget for next session startup
- Git history preserves everything
- Keeps docs/ focused on current work

---

## Quick Commands

```bash
# Run tests
cd C:/Repos/squickr/life
cd packages/domain && pnpm test run

# Start dev server
cd packages/client && pnpm dev

# Build
cd packages/domain && pnpm run build

# Git
git status
git log --oneline -10
git diff
```

---

## Further Reading

- **Architecture decisions:** `docs/architecture-decisions.md`
- **Agent workflow:** `docs/opencode-workflow.md`
- **Code:** `packages/domain/src/` (TypeScript is self-documenting)
