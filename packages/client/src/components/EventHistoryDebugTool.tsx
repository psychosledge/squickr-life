import { useState } from 'react';
import type { Entry, DomainEvent } from '@squickr/domain';
import { useDebug } from '../context/DebugContext';

/**
 * Debug tool for viewing the complete event history of an entry.
 * Only available in development mode.
 * 
 * Uses DebugContext to access event history (no prop drilling).
 * 
 * Position: Top-right corner of each entry (inline with actions menu)
 * to avoid overlapping with FAB (Floating Action Button) in bottom-right.
 */
interface EventHistoryDebugToolProps {
  entry: Entry;
}

/**
 * Type guard to check if event payload has a specific ID field
 */
function hasPayloadField(
  event: DomainEvent,
  field: string,
  value: string
): boolean {
  // Cast to any to access payload field (DomainEvent base doesn't have payload)
  const eventWithPayload = event as DomainEvent & { payload?: Record<string, unknown> };
  
  if (!eventWithPayload.payload || typeof eventWithPayload.payload !== 'object') {
    return false;
  }
  
  return eventWithPayload.payload[field] === value;
}

export const EventHistoryDebugTool: React.FC<EventHistoryDebugToolProps> = ({ entry }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { events, isEnabled } = useDebug();

  // Only show in development mode
  if (!isEnabled) {
    return null;
  }

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  const getEventHistory = () => {
    // Find all events related to this entry
    // Check aggregateId or various payload ID fields
    return events.filter(event => {
      // Direct aggregateId match
      if (event.aggregateId === entry.id) {
        return true;
      }
      
      // Check payload fields based on entry type
      switch (entry.type) {
        case 'task':
          return hasPayloadField(event, 'taskId', entry.id) ||
                 hasPayloadField(event, 'id', entry.id);
        case 'note':
          return hasPayloadField(event, 'noteId', entry.id) ||
                 hasPayloadField(event, 'id', entry.id);
        case 'event':
          return hasPayloadField(event, 'eventId', entry.id) ||
                 hasPayloadField(event, 'id', entry.id);
        default:
          return false;
      }
    });
  };

  const formatEvent = (event: DomainEvent, index: number) => {
    const timestamp = new Date(event.timestamp).toLocaleString();
    return (
      <div key={index} className="border-b border-gray-600 pb-2 mb-2">
        <div className="font-bold text-blue-300">{event.type}</div>
        <div className="text-xs text-gray-400">{timestamp}</div>
        <pre className="text-xs bg-gray-800 p-2 mt-1 rounded overflow-x-auto">
          {JSON.stringify(event, null, 2)}
        </pre>
      </div>
    );
  };

  const eventHistory = getEventHistory();

  return (
    <div className="absolute top-4 right-12 z-[99]">
      {!isExpanded ? (
        <button
          onClick={handleToggle}
          className="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded shadow text-xs"
          title="View event history for this entry"
        >
          🐛 {eventHistory.length}
        </button>
      ) : (
        <div className="fixed top-4 right-4 bg-gray-900 text-white rounded shadow-2xl w-96 max-h-[80vh] overflow-y-auto z-[999]">
          <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-3 flex justify-between items-center">
            <h3 className="font-bold text-sm">Event History</h3>
            <button
              onClick={handleToggle}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="p-3">
            <div className="text-xs text-gray-400 mb-2">
              Entry ID: <span className="text-blue-300 font-mono">{entry.id}</span>
            </div>
            <div className="text-xs text-gray-400 mb-2">
              Type: <span className="text-green-300">{entry.type}</span>
            </div>
            <div className="text-xs text-gray-400 mb-4">
              Collection: <span className="text-yellow-300">{entry.collectionId || 'None'}</span>
            </div>
            
            {eventHistory.length === 0 ? (
              <div className="text-gray-500 text-sm">No events found for this entry</div>
            ) : (
              <div>
                <div className="text-xs font-bold text-gray-400 mb-2">
                  {eventHistory.length} Event{eventHistory.length !== 1 ? 's' : ''}
                </div>
                {eventHistory.map(formatEvent)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
