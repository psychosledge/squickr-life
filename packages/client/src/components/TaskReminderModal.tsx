import { useState, useEffect, FormEvent } from 'react';

interface TaskReminderModalProps {
  existingReminderAt?: string; // UTC ISO-8601
  onSave: (reminderAt: string) => void;
  onClear: () => void;
  onClose: () => void;
  /** External error from the handler (e.g. domain validation that slipped past client checks) */
  externalError?: string;
}

/**
 * TaskReminderModal
 *
 * Lets the user set (or clear) a date+time reminder for a task.
 * Combines local date + time inputs and converts to UTC ISO-8601 on save.
 */
export function TaskReminderModal({
  existingReminderAt,
  onSave,
  onClear,
  onClose,
  externalError,
}: TaskReminderModalProps) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState('');

  // Sync external error (e.g. from handler rejection) into the error display
  useEffect(() => {
    if (externalError) {
      setError(externalError);
    }
  }, [externalError]);

  // Pre-populate from existingReminderAt (formatted to local date/time)
  useEffect(() => {
    if (existingReminderAt) {
      const d = new Date(existingReminderAt);
      // Build local date string YYYY-MM-DD
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      setDate(`${year}-${month}-${day}`);
      // Build local time string HH:MM
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      setTime(`${hours}:${minutes}`);
    }
  }, [existingReminderAt]);

  const isSaveDisabled = !date || !time;

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if (isSaveDisabled) return;

    // Combine local date + time into a Date object (interpreted as local time)
    const combined = new Date(`${date}T${time}:00`);

    if (isNaN(combined.getTime())) {
      setError('Please enter a valid date and time');
      return;
    }

    if (combined.getTime() <= Date.now()) {
      setError('Reminder must be in the future');
      return;
    }

    if (combined.getTime() < Date.now() + 60_000) {
      setError('Reminder must be at least 1 minute in the future');
      return;
    }

    setError('');
    onSave(combined.toISOString());
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Set Reminder
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4 space-y-3">
            <div>
              <label
                htmlFor="reminder-date"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Date
              </label>
              <input
                id="reminder-date"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setError('');
                }}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="reminder-time"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Time
              </label>
              <input
                id="reminder-time"
                type="time"
                value={time}
                onChange={(e) => {
                  setTime(e.target.value);
                  setError('');
                }}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            {existingReminderAt && (
              <button
                type="button"
                onClick={onClear}
                className="px-4 py-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20
                           hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors
                           focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Clear reminder
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700
                         hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors
                         focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaveDisabled}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg
                         transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
                         focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
