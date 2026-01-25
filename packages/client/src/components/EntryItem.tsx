import type { Entry } from '@squickr/shared';
import { TaskEntryItem } from './TaskEntryItem';
import { NoteEntryItem } from './NoteEntryItem';
import { EventEntryItem } from './EventEntryItem';

interface EntryItemProps {
  entry: Entry;
  // Task handlers
  onCompleteTask?: (taskId: string) => void | Promise<void>;
  onReopenTask?: (taskId: string) => void | Promise<void>;
  onUpdateTaskTitle?: (taskId: string, newTitle: string) => void | Promise<void>;
  // Note handlers
  onUpdateNoteContent?: (noteId: string, newContent: string) => void | Promise<void>;
  // Event handlers
  onUpdateEventContent?: (eventId: string, newContent: string) => void | Promise<void>;
  onUpdateEventDate?: (eventId: string, newDate: string | null) => void | Promise<void>;
  // Common handlers
  onDelete: (entryId: string) => void;
}

/**
 * EntryItem Component
 * 
 * Type dispatcher that routes to the appropriate type-specific component:
 * - Tasks → TaskEntryItem
 * - Notes → NoteEntryItem
 * - Events → EventEntryItem
 */
export function EntryItem({ 
  entry, 
  onCompleteTask, 
  onReopenTask, 
  onUpdateTaskTitle,
  onUpdateNoteContent,
  onUpdateEventContent,
  onUpdateEventDate,
  onDelete 
}: EntryItemProps) {
  // Route to the appropriate type-specific component
  if (entry.type === 'task') {
    return (
      <TaskEntryItem
        entry={entry}
        onCompleteTask={onCompleteTask}
        onReopenTask={onReopenTask}
        onUpdateTaskTitle={onUpdateTaskTitle}
        onDelete={onDelete}
      />
    );
  }

  if (entry.type === 'note') {
    return (
      <NoteEntryItem
        entry={entry}
        onUpdateNoteContent={onUpdateNoteContent}
        onDelete={onDelete}
      />
    );
  }

  if (entry.type === 'event') {
    return (
      <EventEntryItem
        entry={entry}
        onUpdateEventContent={onUpdateEventContent}
        onUpdateEventDate={onUpdateEventDate}
        onDelete={onDelete}
      />
    );
  }

  // TypeScript exhaustiveness check
  const _exhaustiveCheck: never = entry;
  return _exhaustiveCheck;
}
