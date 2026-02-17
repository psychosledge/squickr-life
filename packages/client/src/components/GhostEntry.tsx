import type { Entry, Collection } from '@squickr/domain';
import { BulletIcon } from './BulletIcon';
import { EntryActionsMenu } from './EntryActionsMenu';
import { EventHistoryDebugTool } from './EventHistoryDebugTool';

interface GhostEntryProps {
  entry: Entry & { 
    renderAsGhost: true; 
    ghostNewLocation?: string; 
  };
  onNavigateToCollection: (collectionId: string) => void;
  onDelete: () => void;
  collections: Collection[];
  currentCollectionId?: string;
}

/**
 * GhostEntry Component
 * 
 * Renders a "ghost" entry - a crossed-out representation of a task that has been
 * migrated/moved to another collection. Shows where the task went and provides
 * navigation to the new location via context menu.
 * 
 * Design:
 * - Crossed-out text (strikethrough)
 * - Muted/grayed appearance (lower opacity)
 * - Shows ➜ migration arrow in bullet icon
 * - Context menu (⋯) with "Go to [Collection]" and "Delete" options
 * - NOT interactive for drag-drop
 * - NO checkbox, edit, or migrate buttons
 */
export function GhostEntry({ 
  entry, 
  onNavigateToCollection,
  onDelete,
  collections,
  currentCollectionId,
}: GhostEntryProps) {
  // Find the target collection name
  const targetCollectionId = entry.ghostNewLocation;
  const targetCollection = collections.find(c => c.id === targetCollectionId);
  const targetCollectionName = targetCollection?.name || 'another collection';

  // Get entry title/content based on type
  const getEntryText = () => {
    if (entry.type === 'task') {
      return entry.title;
    }
    if (entry.type === 'note') {
      return entry.content;
    }
    if (entry.type === 'event') {
      return entry.content;
    }
    return '';
  };

  const handleNavigateToMigrated = (collectionId: string | null) => {
    if (collectionId) {
      onNavigateToCollection(collectionId);
    }
  };

  return (
    <div className="relative">
      {/* Ghost content with opacity */}
      <div 
        className="
          py-3 px-4
          bg-white dark:bg-gray-800
          rounded-lg
          border border-gray-200 dark:border-gray-700
          opacity-50
        "
      >
        <div className="flex items-start gap-3">
          {/* Bullet icon - muted, with tooltip */}
          <div className="flex-shrink-0 mt-1 opacity-60">
            <BulletIcon 
              entry={entry}
              isGhost={true}
              title={`Moved to ${targetCollectionName}`}
            />
          </div>

          {/* Ghost entry content */}
          <div className="flex-1 min-w-0">
            {/* Crossed-out text */}
            <div 
              className="
                text-gray-600 dark:text-gray-300
                text-base
                break-words
              "
              style={{ 
                textDecoration: 'line-through',
                textDecorationColor: 'currentColor',
                textDecorationThickness: '2px',
                textDecorationStyle: 'solid'
              }}
            >
              {getEntryText()}
            </div>
          </div>
        </div>
      </div>
      
      {/* Actions Menu - positioned absolutely outside opacity container */}
      <div className="absolute top-4 right-4 z-[100]">
        <EntryActionsMenu
          entry={{ 
            ...entry, 
            migratedTo: entry.ghostNewLocation, // Set migratedTo for menu logic to show "Go to"
            migratedToCollectionId: targetCollectionId 
          }}
          onEdit={() => {}} // No-op for ghost entries
          onMove={() => {}} // No-op for ghost entries
          onDelete={onDelete}
          collections={collections}
          currentCollectionId={currentCollectionId}
          onNavigateToMigrated={handleNavigateToMigrated}
          isGhost={true}
        />
      </div>
      
      {/* Debug tool (dev mode only) */}
      <EventHistoryDebugTool entry={entry} />
    </div>
  );
}
