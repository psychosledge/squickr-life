import type { TaskFilter } from '@squickr/shared';

interface FilterButtonsProps {
  currentFilter: TaskFilter;
  onFilterChange: (filter: TaskFilter) => void;
}

/**
 * FilterButtons Component
 * 
 * Displays filter buttons for All, Open, and Completed tasks.
 */
export function FilterButtons({ currentFilter, onFilterChange }: FilterButtonsProps) {
  const filters: { value: TaskFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'open', label: 'Open' },
    { value: 'completed', label: 'Completed' },
  ];

  return (
    <div className="flex gap-2 justify-center mb-6">
      {filters.map(filter => {
        const isActive = currentFilter === filter.value;
        return (
          <button
            key={filter.value}
            onClick={() => onFilterChange(filter.value)}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              isActive
                ? 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
            aria-label={filter.label}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
