import type { IEventStore } from './event-store';
import type {
  CreateHabitCommand,
  UpdateHabitTitleCommand,
  UpdateHabitFrequencyCommand,
  CompleteHabitCommand,
  RevertHabitCompletionCommand,
  ArchiveHabitCommand,
  RestoreHabitCommand,
  ReorderHabitCommand,
  SetHabitNotificationTimeCommand,
  ClearHabitNotificationTimeCommand,
  HabitCreated,
  HabitTitleChanged,
  HabitFrequencyChanged,
  HabitCompleted,
  HabitCompletionReverted,
  HabitArchived,
  HabitRestored,
  HabitReordered,
  HabitNotificationTimeSet,
  HabitNotificationTimeCleared,
} from './habit.types';
import { validateHabitTitle, validateHabitFrequency } from './habit-validation';
import { generateEventMetadata } from './event-helpers';
import type { DomainEvent } from './domain-event';

// ============================================================================
// Internal helpers — compute habit state from raw events
// ============================================================================

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isHabitArchived(events: DomainEvent[]): boolean {
  // Walk events in order; last archive/restore determines state
  let archived = false;
  for (const e of events) {
    if (e.type === 'HabitArchived') archived = true;
    else if (e.type === 'HabitRestored') archived = false;
  }
  return archived;
}

function isHabitCompleted(events: DomainEvent[], date: string): boolean {
  // Net completion status: completed = true, reverted = false
  let completed = false;
  for (const e of events) {
    if (e.type === 'HabitCompleted') {
      const payload = (e as HabitCompleted).payload;
      if (payload.date === date) completed = true;
    } else if (e.type === 'HabitCompletionReverted') {
      const payload = (e as HabitCompletionReverted).payload;
      if (payload.date === date) completed = false;
    }
  }
  return completed;
}

async function loadHabitEvents(
  eventStore: IEventStore,
  habitId: string,
): Promise<DomainEvent[]> {
  return eventStore.getById(habitId);
}

async function requireHabitExists(
  eventStore: IEventStore,
  habitId: string,
): Promise<DomainEvent[]> {
  const events = await loadHabitEvents(eventStore, habitId);
  const created = events.find(e => e.type === 'HabitCreated');
  if (!created) {
    throw new Error(`Habit ${habitId} not found`);
  }
  return events;
}

async function requireHabitActive(
  eventStore: IEventStore,
  habitId: string,
): Promise<DomainEvent[]> {
  const events = await requireHabitExists(eventStore, habitId);
  if (isHabitArchived(events)) {
    throw new Error(`Habit ${habitId} is archived`);
  }
  return events;
}

// ============================================================================
// Commit 2: Create, UpdateTitle, UpdateFrequency
// ============================================================================

/**
 * Create a new habit
 */
export class CreateHabitHandler {
  constructor(private readonly eventStore: IEventStore) {}

  async handle(command: CreateHabitCommand): Promise<string> {
    validateHabitTitle(command.title);
    validateHabitFrequency(command.frequency);

    const habitId = crypto.randomUUID();
    const metadata = generateEventMetadata();

    const event: HabitCreated = {
      ...metadata,
      type: 'HabitCreated',
      aggregateId: habitId,
      payload: {
        habitId,
        title: command.title.trim(),
        frequency: command.frequency,
        order: command.order,
        createdAt: metadata.timestamp,
        ...(command.notificationTime !== undefined
          ? { notificationTime: command.notificationTime }
          : {}),
      },
    };

    await this.eventStore.append(event);
    return habitId;
  }
}

/**
 * Update a habit's title
 */
export class UpdateHabitTitleHandler {
  constructor(private readonly eventStore: IEventStore) {}

  async handle(command: UpdateHabitTitleCommand): Promise<void> {
    validateHabitTitle(command.title);
    await requireHabitActive(this.eventStore, command.habitId);

    const metadata = generateEventMetadata();

    const event: HabitTitleChanged = {
      ...metadata,
      type: 'HabitTitleChanged',
      aggregateId: command.habitId,
      payload: {
        habitId: command.habitId,
        title: command.title.trim(),
        updatedAt: metadata.timestamp,
      },
    };

    await this.eventStore.append(event);
  }
}

/**
 * Update a habit's frequency
 */
export class UpdateHabitFrequencyHandler {
  constructor(private readonly eventStore: IEventStore) {}

  async handle(command: UpdateHabitFrequencyCommand): Promise<void> {
    validateHabitFrequency(command.frequency);
    await requireHabitActive(this.eventStore, command.habitId);

    const metadata = generateEventMetadata();

    const event: HabitFrequencyChanged = {
      ...metadata,
      type: 'HabitFrequencyChanged',
      aggregateId: command.habitId,
      payload: {
        habitId: command.habitId,
        frequency: command.frequency,
        updatedAt: metadata.timestamp,
      },
    };

    await this.eventStore.append(event);
  }
}

// ============================================================================
// Commit 3: Complete, Revert, Archive, Restore, Reorder
// ============================================================================

/**
 * Record a habit completion for a specific date
 */
export class CompleteHabitHandler {
  constructor(private readonly eventStore: IEventStore) {}

  async handle(command: CompleteHabitCommand): Promise<void> {
    if (!DATE_RE.test(command.date)) {
      throw new Error(`Invalid date format: ${command.date}. Expected YYYY-MM-DD`);
    }

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const today = `${yyyy}-${mm}-${dd}`;
    if (command.date > today) {
      throw new Error(`Cannot complete habit for a future date: ${command.date}`);
    }

    const events = await requireHabitActive(this.eventStore, command.habitId);

    // Idempotency: already completed (net) for this date → no-op
    if (isHabitCompleted(events, command.date)) {
      return;
    }

    const metadata = generateEventMetadata();

    const event: HabitCompleted = {
      ...metadata,
      type: 'HabitCompleted',
      aggregateId: command.habitId,
      payload: {
        habitId: command.habitId,
        date: command.date,
        completedAt: metadata.timestamp,
        collectionId: command.collectionId,
      },
    };

    await this.eventStore.append(event);
  }
}

/**
 * Revert a habit completion for a specific date
 */
export class RevertHabitCompletionHandler {
  constructor(private readonly eventStore: IEventStore) {}

  async handle(command: RevertHabitCompletionCommand): Promise<void> {
    if (!DATE_RE.test(command.date)) {
      throw new Error(`Invalid date format: ${command.date}. Expected YYYY-MM-DD`);
    }

    const events = await loadHabitEvents(this.eventStore, command.habitId);

    // Idempotency: not completed (net) for this date → no-op
    if (!isHabitCompleted(events, command.date)) {
      return;
    }

    const metadata = generateEventMetadata();

    const event: HabitCompletionReverted = {
      ...metadata,
      type: 'HabitCompletionReverted',
      aggregateId: command.habitId,
      payload: {
        habitId: command.habitId,
        date: command.date,
        revertedAt: metadata.timestamp,
      },
    };

    await this.eventStore.append(event);
  }
}

/**
 * Archive a habit (soft-delete)
 */
export class ArchiveHabitHandler {
  constructor(private readonly eventStore: IEventStore) {}

  async handle(command: ArchiveHabitCommand): Promise<void> {
    const events = await requireHabitExists(this.eventStore, command.habitId);

    // Idempotency: already archived → no-op
    if (isHabitArchived(events)) {
      return;
    }

    const metadata = generateEventMetadata();

    const event: HabitArchived = {
      ...metadata,
      type: 'HabitArchived',
      aggregateId: command.habitId,
      payload: {
        habitId: command.habitId,
        archivedAt: metadata.timestamp,
      },
    };

    await this.eventStore.append(event);
  }
}

/**
 * Restore an archived habit
 */
export class RestoreHabitHandler {
  constructor(private readonly eventStore: IEventStore) {}

  async handle(command: RestoreHabitCommand): Promise<void> {
    const events = await requireHabitExists(this.eventStore, command.habitId);

    if (!isHabitArchived(events)) {
      throw new Error(`Habit ${command.habitId} is not archived`);
    }

    const metadata = generateEventMetadata();

    const event: HabitRestored = {
      ...metadata,
      type: 'HabitRestored',
      aggregateId: command.habitId,
      payload: {
        habitId: command.habitId,
        restoredAt: metadata.timestamp,
      },
    };

    await this.eventStore.append(event);
  }
}

/**
 * Reorder a habit using a fractional index
 */
export class ReorderHabitHandler {
  constructor(private readonly eventStore: IEventStore) {}

  async handle(command: ReorderHabitCommand): Promise<void> {
    if (!command.order || command.order.trim().length === 0) {
      throw new Error('order must be a non-empty string');
    }

    await requireHabitActive(this.eventStore, command.habitId);

    const metadata = generateEventMetadata();

    const event: HabitReordered = {
      ...metadata,
      type: 'HabitReordered',
      aggregateId: command.habitId,
      payload: {
        habitId: command.habitId,
        order: command.order,
        reorderedAt: metadata.timestamp,
      },
    };

    await this.eventStore.append(event);
  }
}

// ============================================================================
// Phase 3.1: SetHabitNotificationTime, ClearHabitNotificationTime
// ============================================================================

const NOTIFICATION_TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

/**
 * Set (or update) the push notification time for a habit
 */
export class SetHabitNotificationTimeHandler {
  constructor(private readonly eventStore: IEventStore) {}

  async handle(command: SetHabitNotificationTimeCommand): Promise<void> {
    if (!NOTIFICATION_TIME_RE.test(command.notificationTime)) {
      throw new Error(
        `Invalid notificationTime "${command.notificationTime}": expected HH:MM in 24-hour format`,
      );
    }

    await requireHabitActive(this.eventStore, command.habitId);

    const metadata = generateEventMetadata();

    const event: HabitNotificationTimeSet = {
      ...metadata,
      type: 'HabitNotificationTimeSet',
      aggregateId: command.habitId,
      payload: {
        habitId: command.habitId,
        notificationTime: command.notificationTime,
        updatedAt: metadata.timestamp,
      },
    };

    await this.eventStore.append(event);
  }
}

/**
 * Clear the push notification time for a habit (idempotent — no error if already absent)
 */
export class ClearHabitNotificationTimeHandler {
  constructor(private readonly eventStore: IEventStore) {}

  async handle(command: ClearHabitNotificationTimeCommand): Promise<void> {
    await requireHabitActive(this.eventStore, command.habitId);

    const metadata = generateEventMetadata();

    const event: HabitNotificationTimeCleared = {
      ...metadata,
      type: 'HabitNotificationTimeCleared',
      aggregateId: command.habitId,
      payload: {
        habitId: command.habitId,
        clearedAt: metadata.timestamp,
      },
    };

    await this.eventStore.append(event);
  }
}
