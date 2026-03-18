import { parseContentWithUrls } from '../utils/urlParser';

interface LinkifiedContentProps {
  text: string;
  className?: string;
}

/**
 * LinkifiedContent renders text with any http:// or https:// URLs turned into
 * clickable <a> links that open in a new tab.
 */
export function LinkifiedContent({ text, className }: LinkifiedContentProps) {
  const parts = parseContentWithUrls(text);

  return (
    <>
      {parts.map((part, index) => {
        if (part.type === 'url') {
          return (
            <a
              key={index}
              href={part.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-200${className ? ` ${className}` : ''}`}
              onClick={(e) => e.stopPropagation()}
            >
              {part.value}
            </a>
          );
        }
        return <span key={index}>{part.value}</span>;
      })}
    </>
  );
}
