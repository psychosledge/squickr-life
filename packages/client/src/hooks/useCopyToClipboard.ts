import { useState, useCallback, useRef, useEffect } from 'react';

interface UseCopyToClipboardResult {
  copied: boolean;
  copy: (text: string) => Promise<void>;
}

export function useCopyToClipboard(revertDelayMs = 2000): UseCopyToClipboardResult {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the pending timer when the component unmounts
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const copy = useCallback(async (text: string) => {
    // Cancel any in-flight revert timer before starting a new one
    if (timerRef.current) clearTimeout(timerRef.current);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    timerRef.current = setTimeout(() => setCopied(false), revertDelayMs);
  }, [revertDelayMs]);

  return { copied, copy };
}
