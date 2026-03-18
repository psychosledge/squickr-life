import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LinkifiedContent } from './LinkifiedContent';

describe('LinkifiedContent', () => {
  it('plain text with no URLs renders text correctly with no <a> elements', () => {
    render(<LinkifiedContent text="Hello world" />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('single URL renders an <a> with correct href, target="_blank", and rel="noopener noreferrer"', () => {
    render(<LinkifiedContent text="https://example.com" />);
    const link = screen.getByRole('link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('single URL renders the URL as the link text', () => {
    render(<LinkifiedContent text="https://example.com" />);
    const link = screen.getByRole('link', { name: 'https://example.com' });
    expect(link).toBeInTheDocument();
  });

  it('mixed content (text + URL + text) renders in correct order', () => {
    const { container } = render(
      <LinkifiedContent text="Check https://example.com for details" />
    );
    // The text content of the container should preserve order
    expect(container.textContent).toBe('Check https://example.com for details');
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('multiple URLs produce multiple <a> elements', () => {
    render(<LinkifiedContent text="Go to https://foo.com or https://bar.com" />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', 'https://foo.com');
    expect(links[1]).toHaveAttribute('href', 'https://bar.com');
  });

  it('URL with trailing dot — the <a> href does not include the dot', () => {
    render(<LinkifiedContent text="See https://example.com. for info" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link.getAttribute('href')).not.toMatch(/\.$/);
  });

  it('bare domain renders as plain text (no <a>)', () => {
    render(<LinkifiedContent text="visit example.com for info" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('visit example.com for info')).toBeInTheDocument();
  });

  it('link has the correct Tailwind classes for styling', () => {
    render(<LinkifiedContent text="https://example.com" />);
    const link = screen.getByRole('link');
    expect(link.className).toContain('text-blue-600');
    expect(link.className).toContain('underline');
  });

  it('optional className is applied to <a> elements', () => {
    render(<LinkifiedContent text="https://example.com" className="custom-class" />);
    const link = screen.getByRole('link');
    expect(link.className).toContain('custom-class');
  });

  it('empty string renders without errors', () => {
    const { container } = render(<LinkifiedContent text="" />);
    expect(container).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
