import { useState, useMemo, useEffect } from 'react';
import type { Collection, UserPreferences } from '@squickr/domain';
import { formatMonthlyLogName, getCollectionDisplayName } from '../utils/formatters';
import { isEffectivelyFavorited } from '../utils/collectionUtils';

export type HierarchyNode =
  | {
      type: 'year';
      id: string;
      label: string;
      children: HierarchyNode[];
      isExpanded: boolean;
      count?: number;
    }
  | {
      type: 'month';
      id: string;
      label: string;
      date: string; // YYYY-MM format
      monthlyLog?: Collection; // Optional monthly log collection for this month
      children: HierarchyNode[];
      isExpanded: boolean;
      count?: number;
    }
  | {
      type: 'monthly' | 'day' | 'custom';
      id: string;
      label: string;
      date?: string;
      collection: Collection;
      children: HierarchyNode[];
      isExpanded: boolean;
    };

const STORAGE_KEY = 'collection-hierarchy-expanded';

/**
 * Format a daily log date with today/yesterday/tomorrow detection
 * e.g., "2026-02-03" -> "Today, February 3, 2026" (if today)
 * e.g., "2026-02-01" -> "Sunday, February 1, 2026" (if not today/yesterday/tomorrow)
 */
export function formatDayLabel(date: string | undefined): string {
  if (!date) return 'Unknown Date';
  
  // Use getCollectionDisplayName with current date as reference
  const collection = {
    name: '',
    type: 'daily' as const,
    date
  };
  
  return getCollectionDisplayName(collection, new Date());
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
  expandedSet: Set<string>,
  userPreferences: UserPreferences,
  now: Date
): HierarchyNode[] {
  const nodes: HierarchyNode[] = [];
  
  // Separate daily logs, monthly logs, and custom collections
  // For daily logs: exclude auto-favorited dailies from calendar hierarchy (they appear in favorites section)
  // For monthly logs: include ALL monthly logs (even favorited ones) for potential attachment to month nodes
  const dailyLogs = collections.filter(c => 
    c.type === 'daily' && 
    c.date &&
    !isEffectivelyFavorited(c, userPreferences, now)
  );
  const allMonthlyLogs = collections.filter(c => 
    c.type === 'monthly' && 
    c.date
  );
  const customCollections = collections.filter(c => 
    !c.type || c.type === 'custom' || c.type === 'log' || c.type === 'tracker'
  );
  
  // Separate pinned from unpinned custom collections
  const pinnedCustoms = customCollections.filter(c => c.isFavorite);
  const unpinnedCustoms = customCollections.filter(c => !c.isFavorite);
  
  // Sort both by order field (fractional index string, lexicographic comparison)
  pinnedCustoms.sort((a, b) => (a.order || '').localeCompare(b.order || ''));
  unpinnedCustoms.sort((a, b) => (a.order || '').localeCompare(b.order || ''));
  
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
  
  // Create a map of monthly logs by yearMonth for easy lookup
  const monthlyLogMap = new Map<string, Collection>();
  allMonthlyLogs.forEach(log => {
    if (log.date) {
      monthlyLogMap.set(log.date, log); // date is YYYY-MM format
    }
  });
  
  // Group monthly logs by year (only for standalone monthly logs)
  const monthlyLogsByYear = new Map<string, Collection[]>();
  
  allMonthlyLogs.forEach(log => {
    if (!log.date) return;
    
    const year = log.date.substring(0, 4); // "2026" from "2026-02"
    
    if (!monthlyLogsByYear.has(year)) {
      monthlyLogsByYear.set(year, []);
    }
    
    monthlyLogsByYear.get(year)!.push(log);
  });
  
  // Get all years from both daily and monthly logs
  const allYears = new Set([
    ...Array.from(yearMap.keys()),
    ...Array.from(monthlyLogsByYear.keys())
  ]);
  
  // Build year nodes (sorted oldest first)
  const years = Array.from(allYears).sort((a, b) => a.localeCompare(b));
  
  years.forEach(year => {
    const monthMap = yearMap.get(year);
    const monthlyLogsForYear = monthlyLogsByYear.get(year) || [];
    const yearId = `year-${year}`;
    const isYearExpanded = expandedSet.has(yearId);
    
    // Count total logs in this year (daily + monthly)
    let totalLogs = monthlyLogsForYear.length;
    if (monthMap) {
      monthMap.forEach(logs => totalLogs += logs.length);
    }
    
    const yearNode: HierarchyNode = {
      type: 'year',
      id: yearId,
      label: formatYearLabel(year),
      children: [],
      isExpanded: isYearExpanded,
      count: isYearExpanded ? undefined : totalLogs,
    };
    
    if (isYearExpanded) {
      // Build a set of yearMonths that have daily logs (will get month nodes)
      const yearMonthsWithDailyLogs = monthMap ? new Set(monthMap.keys()) : new Set<string>();
      
      // Add standalone monthly logs FIRST (sorted oldest first by date)
      // Only for months that DON'T have daily logs
      const sortedMonthlyLogs = [...monthlyLogsForYear].sort((a, b) => 
        (a.date || '').localeCompare(b.date || '')
      );
      
      sortedMonthlyLogs.forEach(log => {
        const yearMonth = log.date!; // YYYY-MM format
        
        // Only add as standalone if no daily logs exist for this month
        if (!yearMonthsWithDailyLogs.has(yearMonth)) {
          yearNode.children.push({
            type: 'monthly',
            id: log.id,
            label: formatMonthlyLogName(log.date!),
            date: log.date,
            collection: log,
            children: [],
            isExpanded: false, // Leaf nodes don't expand
          });
        }
      });
      
      // Then build month nodes for daily logs (sorted oldest first)
      if (monthMap) {
        const yearMonths = Array.from(monthMap.keys()).sort((a, b) => a.localeCompare(b));
        
        yearMonths.forEach(yearMonth => {
          const logs = monthMap.get(yearMonth)!;
          const monthId = `month-${yearMonth}`;
          const isMonthExpanded = expandedSet.has(monthId);
          
          // Check if there's a monthly log for this month
          const monthlyLog = monthlyLogMap.get(yearMonth);
          
          const monthNode: HierarchyNode = {
            type: 'month',
            id: monthId,
            label: formatMonthLabel(yearMonth),
            date: yearMonth,
            monthlyLog, // Attach monthly log if it exists (even if favorited)
            children: [],
            isExpanded: isMonthExpanded,
            count: isMonthExpanded ? undefined : logs.length,
          };
          
          if (isMonthExpanded) {
            // Add day nodes (sorted oldest first)
            const sortedLogs = [...logs].sort((a, b) => 
              (a.date || '').localeCompare(b.date || '')
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
export function useCollectionHierarchy(
  collections: Collection[],
  userPreferences: UserPreferences
) {
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
  
  // Use current time for auto-favorite detection
  const now = useMemo(() => new Date(), []);
  
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
    () => buildHierarchy(collections, expandedSet, userPreferences, now),
    [collections, expandedSet, userPreferences, now]
  );
  
  return {
    nodes,
    toggleExpand,
    isExpanded,
  };
}
