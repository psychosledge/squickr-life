import type { IEventStore } from './event-store';
import type { EntryListProjection } from './entry.projections';
import type {
  SetTaskReminderCommand,
  ClearTaskReminderCommand,
  TaskReminderSet,
  TaskReminderCleared,
} from './task.types';
import { generateEventMetadata } from './event-helpers';
import { isValidISODate } from './content-validation';

/**
 * Command Handler for SetTaskReminder (ADR-029)
 *
 * Validation rules:
 * - reminderAt must be a non-empty, valid ISO 8601 datetime
 * - reminderAt must be at least 1 minute in the future
 * - task must exist
 */
export class SetTaskReminderHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly entryProjection: EntryListProjection
  ) {}

  async handle(command: SetTaskReminderCommand): Promise<void> {
    // Validate task exists
    const task = await this.entryProjection.getTaskById(command.taskId);
    if (!task) {
      throw new Error(`Task ${command.taskId} not found`);
    }

    // Validate reminderAt
    if (!command.reminderAt || !command.reminderAt.trim()) {
      throw new Error('reminderAt cannot be empty');
    }

    if (!isValidISODate(command.reminderAt)) {
      throw new Error('reminderAt must be a valid ISO 8601 datetime');
    }

    const reminderDate = new Date(command.reminderAt);
    const now = new Date();
    const diffMs = reminderDate.getTime() - now.getTime();

    if (diffMs < 0) {
      throw new Error('reminderAt must not be in the past');
    }

    if (diffMs < 60_000) {
      throw new Error('reminderAt must be at least 1 minute in the future');
    }

    const metadata = generateEventMetadata();

    const event: TaskReminderSet = {
      ...metadata,
      type: 'TaskReminderSet',
      aggregateId: command.taskId,
      payload: {
        taskId: command.taskId,
        reminderAt: command.reminderAt,
        setAt: metadata.timestamp,
      },
    };

    await this.eventStore.append(event);
  }
}

/**
 * Command Handler for ClearTaskReminder (ADR-029)
 *
 * Idempotent — works even if no reminder is currently set.
 * Requires task to exist.
 */
export class ClearTaskReminderHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly entryProjection: EntryListProjection
  ) {}

  async handle(command: ClearTaskReminderCommand): Promise<void> {
    // Validate task exists
    const task = await this.entryProjection.getTaskById(command.taskId);
    if (!task) {
      throw new Error(`Task ${command.taskId} not found`);
    }

    const metadata = generateEventMetadata();

    const event: TaskReminderCleared = {
      ...metadata,
      type: 'TaskReminderCleared',
      aggregateId: command.taskId,
      payload: {
        taskId: command.taskId,
        clearedAt: metadata.timestamp,
        reason: command.reason,
      },
    };

    await this.eventStore.append(event);
  }
}
