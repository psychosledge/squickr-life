import type { IEventStore } from './event-store';
import type { EntryListProjection } from './entry.projections';
import type { ReorderEntryCommand } from './base-entry.types';
import { ReorderTaskHandler } from './task.handlers';
import { ReorderNoteHandler } from './note.handlers';
import { ReorderEventHandler } from './event.handlers';

/**
 * ReorderEntryHandler — unified reorder handler that dispatches to the
 * appropriate type-specific handler based on the entry's runtime type.
 *
 * The three type-specific handlers (ReorderTaskHandler, ReorderNoteHandler,
 * ReorderEventHandler) remain in place for backward compatibility and are
 * used internally by this handler.
 */
export class ReorderEntryHandler {
  private readonly reorderTask: ReorderTaskHandler;
  private readonly reorderNote: ReorderNoteHandler;
  private readonly reorderEvent: ReorderEventHandler;

  constructor(
    eventStore: IEventStore,
    private readonly entryProjection: EntryListProjection,
  ) {
    this.reorderTask = new ReorderTaskHandler(eventStore, entryProjection);
    // ReorderNoteHandler takes (eventStore, noteProjection, entryProjection).
    // entryProjection implements INoteProjection so it is passed twice — the same
    // pattern used in useCollectionHandlers.ts line 184.
    this.reorderNote = new ReorderNoteHandler(eventStore, entryProjection, entryProjection);
    // ReorderEventHandler takes (eventStore, eventProjection, entryProjection).
    // entryProjection implements IEventProjection so it is passed twice.
    this.reorderEvent = new ReorderEventHandler(eventStore, entryProjection, entryProjection);
  }

  /**
   * Handle a ReorderEntry command.
   *
   * Looks up the entry by ID to determine its type, then delegates to the
   * appropriate type-specific handler.
   *
   * @param command - The ReorderEntry command
   * @throws Error if the entry is not found
   */
  async handle(command: ReorderEntryCommand): Promise<void> {
    const entry = await this.entryProjection.getEntryById(command.entryId);
    if (!entry) throw new Error(`Entry ${command.entryId} not found`);

    if (entry.type === 'task') {
      await this.reorderTask.handle({
        taskId: command.entryId,
        previousTaskId: command.previousEntryId,
        nextTaskId: command.nextEntryId,
      });
    } else if (entry.type === 'note') {
      await this.reorderNote.handle({
        noteId: command.entryId,
        previousNoteId: command.previousEntryId,
        nextNoteId: command.nextEntryId,
      });
    } else if (entry.type === 'event') {
      await this.reorderEvent.handle({
        eventId: command.entryId,
        previousEventId: command.previousEntryId,
        nextEventId: command.nextEntryId,
      });
    }
  }
}
