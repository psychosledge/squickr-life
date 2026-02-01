import { useState, useMemo, useEffect } from 'react';
import type { Collection } from '@squickr/shared';

export interface HierarchyNode {
  type: 'year' | 'month' | 'day' | 'custom';
  id: string; // Unique ID for React keys (e.g., "year-2026", "month-2026-02", collection.id)
  label: string; // Display name (e.g., "2026 Logs", "February", "Saturday, February 1")
  date?: string; // Original date for temporal nodes
  collection?: Collection; // Only for leaf nodes (day/custom)
  children: HierarchyNode[];
  isExpanded: boolean;
  count?: number; // For collapsed nodes: "January (31 logs)"
}

const STORAGE_KEY = 'collection-hierarchy-expanded';

/**
 * Format a daily log date as "Weekday, Month Day"
 * e.g., "2026-02-01" -> "Saturday, February 1"
 */
export function formatDayLabel(date: string | undefined): string {
  if (!date) return 'Unknown Date';
  
  const parts = date.split('-');
  const year = parseInt(parts[0]!, 10);
  const month = parseInt(parts[1]!, 10) - 1; // 0-indexed
  const day = parseInt(parts[2]!, 10);
  
  const dateObj = new Date(year, month, day);
  
  // Format: "Weekday, Month Day"
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
  
  return formatter.format(dateObj);
}

/**
 * Format a month as "Month"
 * e.g., "2026-02" -> "February"
 */
export function formatMonthLabel(yearMonth: string | undefined): string {
  if (!yearMonth) return 'Unknown Month';
  
  const parts = yearMonth.split('-');
  const year = parseInt(parts[0]!, 10);
  const month = parseInt(parts[1]!, 10) - 1; // 0-indexed
  
  const dateObj = new Date(year, month, 1);
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'long'
  });
  
  return formatter.format(dateObj);
}

/**
 * Format a year as "YYYY Logs"
 * e.g., "2026" -> "2026 Logs"
 */
export function formatYearLabel(year: string | undefined): string {
  if (!year) return 'Unknown Year';
  return `${year} Logs`;
}

/**
 * Get current year and month as YYYY and YYYY-MM
 */
export function getCurrentYearMonth(): { year: string; yearMonth: string } {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const yearMonth = `${year}-${month}`;
  
  return { year, yearMonth };
}

/**
 * Build hierarchical structure from flat collections
 */
function buildHierarchy(
  collections: Collection[],
  expandedSet: Set<string>
): HierarchyNode[] {
  const nodes: HierarchyNode[] = [];
  
  // Separate daily logs from custom collections
  const dailyLogs = collections.filter(c => c.type === 'daily' && c.date);
  const customCollections = collections.filter(c => 
    c.type === 'custom' || c.type === 'log' || c.type === 'tracker'
  );
  
  // Separate pinned from unpinned custom collections
  const pinnedCustoms = customCollections.filter(c => c.isFavorite);
  const unpinnedCustoms = customCollections.filter(c => !c.isFavorite);
  
  // Add pinned custom collections first
  pinnedCustoms.forEach(collection => {
    nodes.push({
      type: 'custom',
      id: collection.id,
      label: collection.name,
      collection,
      children: [],
      isExpanded: false, // Leaf nodes don't expand
    });
  });
  
  // Group daily logs by year, then by month
  const yearMap = new Map<string, Map<string, Collection[]>>();
  
  dailyLogs.forEach(log => {
    if (!log.date) return;
    
    const year = log.date.substring(0, 4); // "2026"
    const yearMonth = log.date.substring(0, 7); // "2026-02"
    
    if (!yearMap.has(year)) {
      yearMap.set(year, new Map());
    }
    
    const monthMap = yearMap.get(year)!;
    if (!monthMap.has(yearMonth)) {
      monthMap.set(yearMonth, []);
    }
    
    monthMap.get(yearMonth)!.push(log);
  });
  
  // Build year nodes (sorted newest first)
  const years = Array.from(yearMap.keys()).sort((a, b) => b.localeCompare(a));
  
  years.forEach(year => {
    const monthMap = yearMap.get(year)!;
    const yearId = `year-${year}`;
    const isYearExpanded = expandedSet.has(yearId);
    
    // Count total logs in this year
    let totalLogs = 0;
    monthMap.forEach(logs => totalLogs += logs.length);
    
    const yearNode: HierarchyNode = {
      type: 'year',
      id: yearId,
      label: formatYearLabel(year),
      children: [],
      isExpanded: isYearExpanded,
      count: isYearExpanded ? undefined : totalLogs,
    };
    
    if (isYearExpanded) {
      // Build month nodes (sorted newest first)
      const yearMonths = Array.from(monthMap.keys()).sort((a, b) => b.localeCompare(a));
      
      yearMonths.forEach(yearMonth => {
        const logs = monthMap.get(yearMonth)!;
        const monthId = `month-${yearMonth}`;
        const isMonthExpanded = expandedSet.has(monthId);
        
        const monthNode: HierarchyNode = {
          type: 'month',
          id: monthId,
          label: formatMonthLabel(yearMonth),
          date: yearMonth,
          children: [],
          isExpanded: isMonthExpanded,
          count: isMonthExpanded ? undefined : logs.length,
        };
        
        if (isMonthExpanded) {
          // Add day nodes (sorted newest first)
          const sortedLogs = [...logs].sort((a, b) => 
            (b.date || '').localeCompare(a.date || '')
          );
          
          sortedLogs.forEach(log => {
            monthNode.children.push({
              type: 'day',
              id: log.id,
              label: formatDayLabel(log.date!),
              date: log.date,
              collection: log,
              children: [],
              isExpanded: false, // Leaf nodes don't expand
            });
          });
        }
        
        yearNode.children.push(monthNode);
      });
    }
    
    nodes.push(yearNode);
  });
  
  // Add unpinned custom collections last
  unpinnedCustoms.forEach(collection => {
    nodes.push({
      type: 'custom',
      id: collection.id,
      label: collection.name,
      collection,
      children: [],
      isExpanded: false, // Leaf nodes don't expand
    });
  });
  
  return nodes;
}

/**
 * Hook to manage collection hierarchy state
 */
export function useCollectionHierarchy(collections: Collection[]) {
  // Load expanded state from localStorage
  const [expandedSet, setExpandedSet] = useState<Set<string>>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const arr = JSON.parse(stored) as string[];
        return new Set(arr);
      } catch {
        return new Set();
      }
    }
    
    // Auto-expand current year and month on first load
    const { year, yearMonth } = getCurrentYearMonth();
    return new Set([`year-${year}`, `month-${yearMonth}`]);
  });
  
  // Persist expanded state to localStorage
  useEffect(() => {
    const arr = Array.from(expandedSet);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }, [expandedSet]);
  
  // Toggle expansion state
  const toggleExpand = (nodeId: string) => {
    setExpandedSet(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };
  
  // Check if a node is expanded
  const isExpanded = (nodeId: string): boolean => {
    return expandedSet.has(nodeId);
  };
  
  // Build hierarchy (memoized)
  const nodes = useMemo(
    () => buildHierarchy(collections, expandedSet),
    [collections, expandedSet]
  );
  
  return {
    nodes,
    toggleExpand,
    isExpanded,
  };
}
