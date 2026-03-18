export type ContentPart =
  | { type: 'text'; value: string }
  | { type: 'url'; value: string; href: string };

const URL_REGEX = /https?:\/\/[^\s<>"'`(){}\[\]]+/g;

/**
 * Parses a text string and splits it into text and URL parts.
 * Only linkifies http:// and https:// URLs (not bare domains or other schemes).
 * Trailing punctuation is stripped from URLs.
 */
export function parseContentWithUrls(text: string): ContentPart[] {
  if (!text) {
    return [{ type: 'text', value: text }];
  }

  const parts: ContentPart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  URL_REGEX.lastIndex = 0;

  while ((match = URL_REGEX.exec(text)) !== null) {
    const rawUrl = match[0];
    // Strip trailing punctuation
    const url = rawUrl.replace(/[.,;:!?)\]'">`]+$/, '');

    const matchStart = match.index;

    // Text before this URL
    if (matchStart > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, matchStart) });
    }

    // The URL part
    parts.push({ type: 'url', value: url, href: url });

    // Advance lastIndex past the URL (not including stripped trailing punctuation,
    // which will be captured by the next iteration or the final text segment)
    lastIndex = matchStart + url.length;
  }

  // Remaining text after the last URL
  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  // If no URLs were found, return a single text part
  if (parts.length === 0) {
    return [{ type: 'text', value: text }];
  }

  return parts;
}
