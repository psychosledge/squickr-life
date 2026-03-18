import { describe, it, expect } from 'vitest';
import { parseContentWithUrls } from './urlParser';
import type { ContentPart } from './urlParser';

describe('parseContentWithUrls', () => {
  it('plain text with no URL returns a single text part', () => {
    const result = parseContentWithUrls('Hello world');
    expect(result).toEqual<ContentPart[]>([{ type: 'text', value: 'Hello world' }]);
  });

  it('empty string returns single text part with empty value', () => {
    const result = parseContentWithUrls('');
    expect(result).toEqual<ContentPart[]>([{ type: 'text', value: '' }]);
  });

  it('single URL only returns a single url part', () => {
    const result = parseContentWithUrls('https://example.com');
    expect(result).toEqual<ContentPart[]>([
      { type: 'url', value: 'https://example.com', href: 'https://example.com' },
    ]);
  });

  it('URL at the start of text', () => {
    const result = parseContentWithUrls('https://example.com is a site');
    expect(result).toEqual<ContentPart[]>([
      { type: 'url', value: 'https://example.com', href: 'https://example.com' },
      { type: 'text', value: ' is a site' },
    ]);
  });

  it('URL at the end of text (no trailing punctuation)', () => {
    const result = parseContentWithUrls('visit https://example.com');
    expect(result).toEqual<ContentPart[]>([
      { type: 'text', value: 'visit ' },
      { type: 'url', value: 'https://example.com', href: 'https://example.com' },
    ]);
  });

  it('URL at end with trailing dot — dot not included in href', () => {
    const result = parseContentWithUrls('visit https://example.com.');
    expect(result).toHaveLength(3);
    const urlPart = result.find((p): p is Extract<ContentPart, { type: 'url' }> => p.type === 'url');
    expect(urlPart).toBeDefined();
    expect(urlPart?.href).toBe('https://example.com');
    // The href should not end with a dot
    expect(urlPart?.href.endsWith('.')).toBe(false);
    // The trailing dot should remain as text
    const lastPart = result[result.length - 1];
    expect(lastPart).toEqual({ type: 'text', value: '.' });
  });

  it('URL at end with trailing closing parenthesis', () => {
    const result = parseContentWithUrls('see (https://example.com)');
    const urlPart = result.find(p => p.type === 'url');
    expect(urlPart).toBeDefined();
    expect(urlPart!.href).toBe('https://example.com');
    expect(urlPart!.href).not.toContain(')');
  });

  it('URL at end with trailing comma', () => {
    const result = parseContentWithUrls('visit https://example.com, then go home');
    const urlPart = result.find(p => p.type === 'url');
    expect(urlPart).toBeDefined();
    expect(urlPart!.href).toBe('https://example.com');
    expect(urlPart!.href).not.toContain(',');
  });

  it('URL mid-sentence', () => {
    const result = parseContentWithUrls('Check https://example.com for details');
    expect(result).toEqual<ContentPart[]>([
      { type: 'text', value: 'Check ' },
      { type: 'url', value: 'https://example.com', href: 'https://example.com' },
      { type: 'text', value: ' for details' },
    ]);
  });

  it('multiple URLs in one string', () => {
    const result = parseContentWithUrls('Go to https://foo.com or https://bar.com');
    const urlParts = result.filter((p): p is Extract<ContentPart, { type: 'url' }> => p.type === 'url');
    expect(urlParts).toHaveLength(2);
    expect(urlParts[0]?.href).toBe('https://foo.com');
    expect(urlParts[1]?.href).toBe('https://bar.com');
  });

  it('http:// scheme (not just https)', () => {
    const result = parseContentWithUrls('http://example.com is plain http');
    const urlPart = result.find(p => p.type === 'url');
    expect(urlPart).toBeDefined();
    expect(urlPart!.href).toBe('http://example.com');
  });

  it('URL with path', () => {
    const result = parseContentWithUrls('https://github.com/foo/bar');
    expect(result).toEqual<ContentPart[]>([
      { type: 'url', value: 'https://github.com/foo/bar', href: 'https://github.com/foo/bar' },
    ]);
  });

  it('URL with query string', () => {
    const result = parseContentWithUrls('https://example.com/q?a=1&b=2');
    expect(result).toEqual<ContentPart[]>([
      { type: 'url', value: 'https://example.com/q?a=1&b=2', href: 'https://example.com/q?a=1&b=2' },
    ]);
  });

  it('URL with fragment', () => {
    const result = parseContentWithUrls('https://example.com/page#section');
    expect(result).toEqual<ContentPart[]>([
      { type: 'url', value: 'https://example.com/page#section', href: 'https://example.com/page#section' },
    ]);
  });

  it('bare domain (e.g. example.com) is treated as plain text, not linkified', () => {
    const result = parseContentWithUrls('visit example.com for info');
    expect(result).toEqual<ContentPart[]>([{ type: 'text', value: 'visit example.com for info' }]);
    const urlPart = result.find(p => p.type === 'url');
    expect(urlPart).toBeUndefined();
  });

  it('javascript: scheme is not linkified (requires https?://)', () => {
    const result = parseContentWithUrls('javascript:alert(1)');
    expect(result).toEqual<ContentPart[]>([{ type: 'text', value: 'javascript:alert(1)' }]);
    const urlPart = result.find(p => p.type === 'url');
    expect(urlPart).toBeUndefined();
  });

  it('text with two URLs separated by text returns parts in correct order', () => {
    const result = parseContentWithUrls('First https://a.com then https://b.com done');
    expect(result).toEqual<ContentPart[]>([
      { type: 'text', value: 'First ' },
      { type: 'url', value: 'https://a.com', href: 'https://a.com' },
      { type: 'text', value: ' then ' },
      { type: 'url', value: 'https://b.com', href: 'https://b.com' },
      { type: 'text', value: ' done' },
    ]);
  });

  it('URL with trailing colon — colon not included in href', () => {
    const result = parseContentWithUrls('see https://example.com: for more');
    const urlPart = result.find(p => p.type === 'url');
    expect(urlPart).toBeDefined();
    expect(urlPart!.href).toBe('https://example.com');
    // The href should not end with a colon
    expect(urlPart!.href.endsWith(':')).toBe(false);
  });

  it('URL with trailing exclamation mark — exclamation not included in href', () => {
    const result = parseContentWithUrls('check https://example.com!');
    const urlPart = result.find(p => p.type === 'url');
    expect(urlPart).toBeDefined();
    expect(urlPart!.href).toBe('https://example.com');
  });
});
