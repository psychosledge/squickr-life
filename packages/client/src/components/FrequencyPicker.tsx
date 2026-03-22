/**
 * FrequencyPicker Component
 *
 * Renders the frequency selector for habit creation/editing.
 * Supports: daily, weekly (day-of-week toggle), every-n-days (number input).
 */

// ── Constants ─────────────────────────────────────────────────────────────────

export const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;
export const DAY_FULL_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export type FrequencyType = 'daily' | 'weekly' | 'every-n-days';

export interface FrequencyPickerProps {
  frequencyType: FrequencyType;
  onFrequencyTypeChange: (type: FrequencyType) => void;
  targetDays: number[]; // [0..6], used for 'weekly'
  onTargetDaysChange: (days: number[]) => void;
  nDays: number; // 2..30, used for 'every-n-days'
  onNDaysChange: (n: number) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FrequencyPicker({
  frequencyType,
  onFrequencyTypeChange,
  targetDays,
  onTargetDaysChange,
  nDays,
  onNDaysChange,
}: FrequencyPickerProps) {
  return (
    <>
      {/* Frequency type selector */}
      <div className="mb-4">
        <label
          htmlFor="habit-frequency"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Frequency
        </label>
        <select
          id="habit-frequency"
          value={frequencyType}
          onChange={(e) => onFrequencyTypeChange(e.target.value as FrequencyType)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="every-n-days">Every N Days</option>
        </select>
      </div>

      {/* Day-of-week picker — shown only for weekly frequency */}
      {frequencyType === 'weekly' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Days of Week
          </label>
          <div className="flex gap-1" role="group" aria-label="Days of week">
            {DAY_LABELS.map((label, dayIndex) => {
              const isSelected = targetDays.includes(dayIndex);
              return (
                <button
                  key={dayIndex}
                  type="button"
                  aria-label={DAY_FULL_LABELS[dayIndex]}
                  aria-pressed={isSelected}
                  onClick={() => {
                    if (isSelected && targetDays.length === 1) {
                      // Prevent de-selecting the last day
                      return;
                    }
                    onTargetDaysChange(
                      isSelected
                        ? targetDays.filter((d) => d !== dayIndex)
                        : [...targetDays, dayIndex].sort((a, b) => a - b),
                    );
                  }}
                  className={`w-9 h-9 rounded-full text-sm font-medium transition-colors
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                    ${
                      isSelected
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Every-N-Days interval input */}
      {frequencyType === 'every-n-days' && (
        <div className="mb-4">
          <label
            htmlFor="habit-n-days"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Repeat interval (days)
          </label>
          <input
            id="habit-n-days"
            type="number"
            min={2}
            max={30}
            value={nDays}
            onChange={(e) => {
              const raw = parseInt(e.target.value, 10);
              const clamped = isNaN(raw) ? 2 : Math.min(30, Math.max(2, raw));
              onNDaysChange(clamped);
            }}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}
    </>
  );
}
