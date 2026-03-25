/**
 * CollectionDebugPanel
 * ADR-022: Collection-scoped debug panel
 *
 * Shows all domain events related to a specific collection:
 *   - Collection lifecycle events (CollectionCreated, CollectionRenamed, etc.)
 *   - Membership events where payload.collectionId / payload.targetCollectionId matches
 *   - All events for entries that were ever attributed to this collection
 *
 * Dev-only: returns null unless DebugContext.isEnabled is true.
 */

import { useState } from 'react';
import type { DomainEvent } from '@squickr/domain';
import { useDebug } from '../context/DebugContext';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';

interface CollectionDebugPanelProps {
  collectionId: string;
}

// ── Event-type buckets ──────────────────────────────────────────────────────

const COLLECTION_LIFECYCLE_TYPES = new Set([
  'CollectionCreated',
  'CollectionRenamed',
  'CollectionReordered',
  'CollectionDeleted',
  'CollectionRestored',
  'CollectionSettingsUpdated',
  'CollectionFavorited',
  'CollectionUnfavorited',
  'CollectionAccessed',
]);

const MEMBERSHIP_EVENT_TYPES = new Set([
  'TaskCreated',
  'NoteCreated',
  'EventCreated',
  'TaskAddedToCollection',
  'TaskRemovedFromCollection',
  'NoteAddedToCollection',
  'NoteRemovedFromCollection',
  'EventAddedToCollection',
  'EventRemovedFromCollection',
  'EntryMovedToCollection',
  'TaskMigrated',
]);

// ── Helpers ─────────────────────────────────────────────────────────────────

function getPayload(event: DomainEvent): Record<string, unknown> {
  const e = event as DomainEvent & { payload?: Record<string, unknown> };
  return (e.payload && typeof e.payload === 'object') ? e.payload : {};
}

/**
 * Build the set of entry IDs ever attributed to `collectionId` via membership events.
 * Also collects all events that directly reference the collection so we can return them.
 */
function buildCollectionEvents(
  events: DomainEvent[],
  collectionId: string
): DomainEvent[] {
  // ── Pass 1: find all entry IDs attributed to this collection ───────────
  const entryIds = new Set<string>();

  for (const event of events) {
    if (!MEMBERSHIP_EVENT_TYPES.has(event.type)) continue;

    const payload = getPayload(event);

    const matchesCollection =
      payload['collectionId'] === collectionId ||
      payload['targetCollectionId'] === collectionId;

    if (matchesCollection) {
      // Register the entry ID so Pass 2 can pull in all its events
      entryIds.add(event.aggregateId);
    }
  }

  // ── Pass 2: collect relevant events ────────────────────────────────────
  const result: DomainEvent[] = [];

  for (const event of events) {
    // (a) Collection lifecycle events for this collection
    if (
      COLLECTION_LIFECYCLE_TYPES.has(event.type) &&
      event.aggregateId === collectionId
    ) {
      result.push(event);
      continue;
    }

    // (b) Membership events that reference this collection
    if (MEMBERSHIP_EVENT_TYPES.has(event.type)) {
      const payload = getPayload(event);
      if (
        payload['collectionId'] === collectionId ||
        payload['targetCollectionId'] === collectionId
      ) {
        result.push(event);
        continue;
      }
    }

    // (c) Any event for an entry historically in this collection
    if (entryIds.has(event.aggregateId)) {
      result.push(event);
    }
  }

  return result;
}

// ── Component ───────────────────────────────────────────────────────────────

export function CollectionDebugPanel({ collectionId }: CollectionDebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { events, isEnabled } = useDebug();
  const { copied, copy } = useCopyToClipboard();

  if (!isEnabled) return null;

  const collectionEvents = buildCollectionEvents(events, collectionId);

  const formatEvent = (event: DomainEvent) => {
    const timestamp = new Date(event.timestamp).toLocaleString();
    return (
      <div key={event.id} className="border-b border-gray-600 pb-2 mb-2">
        <div className="font-bold text-blue-300">{event.type}</div>
        <div className="text-xs text-gray-400">{timestamp}</div>
        <pre className="text-xs bg-gray-800 p-2 mt-1 rounded overflow-x-auto">
          {JSON.stringify(event, null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <div>
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded shadow text-xs"
          title="View collection events"
        >
          🐛 {collectionEvents.length}
        </button>
      ) : (
        <div className="fixed top-4 right-4 bg-gray-900 text-white rounded shadow-2xl w-96 max-h-[80vh] overflow-y-auto z-[999]">
          {/* Sticky header */}
          <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-3 flex justify-between items-center">
            <h3 className="font-bold text-sm">Collection Events</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => copy(JSON.stringify(collectionEvents, null, 2))}
                className="text-gray-400 hover:text-white text-xs"
                title="Copy all events as JSON"
              >
                {copied ? '✓ Copied!' : '📋 Copy'}
              </button>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-3">
            <div className="text-xs text-gray-400 mb-4">
              Collection ID:{' '}
              <span className="text-blue-300 font-mono">{collectionId}</span>
            </div>

            {collectionEvents.length === 0 ? (
              <div className="text-gray-500 text-sm">No collection events found</div>
            ) : (
              <div>
                <div className="text-xs font-bold text-gray-400 mb-2">
                  {collectionEvents.length} Event
                  {collectionEvents.length !== 1 ? 's' : ''}
                </div>
                {collectionEvents.map(formatEvent)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
