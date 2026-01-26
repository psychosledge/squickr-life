import { Sun, Moon, Monitor } from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';

export function DarkModeToggle() {
  const { themeMode, cycleThemeMode } = useDarkMode();

  const icons = {
    light: Sun,
    dark: Moon,
    auto: Monitor,
  };

  const labels = {
    light: 'Theme: Light',
    dark: 'Theme: Dark',
    auto: 'Theme: Auto',
  };

  const Icon = icons[themeMode];

  return (
    <button
      onClick={cycleThemeMode}
      className="w-11 h-11 flex items-center justify-center rounded-lg transition-colors duration-200 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800"
      aria-label={labels[themeMode]}
      title={labels[themeMode]}
    >
      <Icon size={20} />
    </button>
  );
}
