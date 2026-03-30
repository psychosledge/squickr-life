/**
 * Hook: useFcmRegistrationStatus
 *
 * Reads the two FCM localStorage keys and returns a derived status:
 *   'registered'   — both FCM_REQUESTED_KEY and FCM_TOKEN_STORED_KEY are set
 *   'pending'      — only FCM_REQUESTED_KEY is set (permission requested but token not yet stored)
 *   'unregistered' — neither key is set (first visit / never prompted)
 *
 * The hook reads localStorage on mount and updates whenever localStorage changes
 * (via the native `storage` event, which fires when another tab or the registerFcmToken
 * function updates the keys). This means the status chip in SettingsModal will reflect
 * the correct state even if registration completes after the component mounts.
 */

import { useState, useEffect } from 'react';
import { FCM_REQUESTED_KEY, FCM_TOKEN_STORED_KEY } from '../firebase/fcm';

// ── Types ─────────────────────────────────────────────────────────────────────

export type FcmRegistrationStatus = 'registered' | 'pending' | 'unregistered';

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useFcmRegistrationStatus(): FcmRegistrationStatus {
  const [status, setStatus] = useState<FcmRegistrationStatus>(() => deriveStatus());

  useEffect(() => {
    // Re-read on mount to pick up any changes that happened before this component rendered
    setStatus(deriveStatus());

    // Listen for storage changes so the chip updates when registerFcmToken writes
    // the keys (works cross-tab and within the same tab via dispatchEvent)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === FCM_REQUESTED_KEY || e.key === FCM_TOKEN_STORED_KEY || e.key === null) {
        setStatus(deriveStatus());
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return status;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function deriveStatus(): FcmRegistrationStatus {
  const hasRequested = !!localStorage.getItem(FCM_REQUESTED_KEY);
  const hasStoredToken = !!localStorage.getItem(FCM_TOKEN_STORED_KEY);

  if (hasRequested && hasStoredToken) return 'registered';
  if (hasRequested) return 'pending';
  return 'unregistered';
}
