/**
 * Format timestamp as relative time
 * e.g., "just now", "2 minutes ago", "3 hours ago"
 */
export function formatTimestamp(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 10) {
    return 'just now';
  } else if (diffSeconds < 60) {
    return `${diffSeconds} seconds ago`;
  } else if (diffMinutes < 60) {
    return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  } else {
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  }
}

/**
 * Format date string (YYYY-MM-DD) as readable date
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString + 'T00:00:00'); // Ensure local timezone
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return dateString;
    }
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch {
    return dateString;
  }
}

/**
 * Format monthly log date string (YYYY-MM) as "Month Year"
 * e.g., "2026-02" -> "February 2026"
 */
export function formatMonthlyLogName(dateStr: string): string {
  const [year, month] = dateStr.split('-');
  const date = new Date(parseInt(year!), parseInt(month!) - 1, 1);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Get display name for a collection
 * For daily logs, formats the date as "Weekday, Month Day" (e.g., "Saturday, February 1")
 * For monthly logs, formats the date as "Month Year" (e.g., "February 2026")
 * For custom collections, returns the collection name as-is
 */
export function getCollectionDisplayName(collection: { 
  name: string; 
  type?: string; 
  date?: string 
}): string {
  // For daily logs, format the date nicely
  if (collection.type === 'daily' && collection.date) {
    const parts = collection.date.split('-');
    const year = parseInt(parts[0]!, 10);
    const month = parseInt(parts[1]!, 10) - 1; // 0-indexed
    const day = parseInt(parts[2]!, 10);
    
    const dateObj = new Date(year, month, day);
    const formatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
    
    return formatter.format(dateObj);
  }
  
  // For monthly logs, format the date as "Month Year"
  if (collection.type === 'monthly' && collection.date) {
    return formatMonthlyLogName(collection.date);
  }
  
  // For custom collections (or legacy collections without type), return name as-is
  return collection.name;
}
