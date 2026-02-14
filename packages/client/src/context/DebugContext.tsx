import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { DomainEvent } from '@squickr/domain';
import { useApp } from './AppContext';

interface DebugContextValue {
  events: DomainEvent[];
  isEnabled: boolean;
}

const DebugContext = createContext<DebugContextValue>({
  events: [],
  isEnabled: false,
});

export function useDebug() {
  return useContext(DebugContext);
}

interface DebugProviderProps {
  children: ReactNode;
}

/**
 * DebugProvider - Provides event history to debug tools in development mode
 * 
 * Only active when import.meta.env.DEV is true.
 * Subscribes to event store and provides all events to debug components via context.
 * 
 * This eliminates prop drilling of `allEvents` through component layers.
 */
export function DebugProvider({ children }: DebugProviderProps) {
  const { eventStore } = useApp();
  const [events, setEvents] = useState<DomainEvent[]>([]);
  const isEnabled = import.meta.env.DEV;

  useEffect(() => {
    // Only load events in dev mode
    if (!isEnabled) {
      return;
    }

    // Load initial events
    const loadEvents = async () => {
      const allEvents = await eventStore.getAll();
      setEvents(allEvents);
    };

    loadEvents();

    // Subscribe to new events
    const unsubscribe = eventStore.subscribe(async () => {
      const allEvents = await eventStore.getAll();
      setEvents(allEvents);
    });

    return () => {
      unsubscribe();
    };
  }, [eventStore, isEnabled]);

  return (
    <DebugContext.Provider value={{ events, isEnabled }}>
      {children}
    </DebugContext.Provider>
  );
}
