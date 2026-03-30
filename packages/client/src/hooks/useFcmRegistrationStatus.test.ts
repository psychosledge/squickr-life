/**
 * useFcmRegistrationStatus Tests
 *
 * Tests the hook that reads FCM localStorage keys and derives a status.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFcmRegistrationStatus } from './useFcmRegistrationStatus';
import { FCM_REQUESTED_KEY, FCM_TOKEN_STORED_KEY } from '../firebase/fcm';

// Mock the fcm module so the keys come through without the firebase deps
vi.mock('../firebase/fcm', () => ({
  FCM_REQUESTED_KEY: 'fcm-permission-requested',
  FCM_TOKEN_STORED_KEY: 'fcm-token-stored',
  registerFcmToken: vi.fn(),
}));

describe('useFcmRegistrationStatus', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns "unregistered" when neither key is set', () => {
    const { result } = renderHook(() => useFcmRegistrationStatus());
    expect(result.current).toBe('unregistered');
  });

  it('returns "pending" when only FCM_REQUESTED_KEY is set', () => {
    localStorage.setItem(FCM_REQUESTED_KEY, '1');
    const { result } = renderHook(() => useFcmRegistrationStatus());
    expect(result.current).toBe('pending');
  });

  it('returns "registered" when both keys are set', () => {
    localStorage.setItem(FCM_REQUESTED_KEY, '1');
    localStorage.setItem(FCM_TOKEN_STORED_KEY, '1');
    const { result } = renderHook(() => useFcmRegistrationStatus());
    expect(result.current).toBe('registered');
  });

  it('returns "pending" when only FCM_TOKEN_STORED_KEY is set (requested key absent)', () => {
    // TOKEN_STORED without REQUESTED shouldn't happen in practice but
    // we test the fallback: !hasRequested → 'unregistered' regardless of stored token
    localStorage.setItem(FCM_TOKEN_STORED_KEY, '1');
    const { result } = renderHook(() => useFcmRegistrationStatus());
    expect(result.current).toBe('unregistered');
  });

  it('updates status reactively when a storage event fires for FCM keys', async () => {
    // Start with no keys set → 'unregistered'
    const { result } = renderHook(() => useFcmRegistrationStatus());
    expect(result.current).toBe('unregistered');

    // Simulate registerFcmToken writing FCM_REQUESTED_KEY via dispatchEvent
    localStorage.setItem(FCM_REQUESTED_KEY, '1');
    window.dispatchEvent(
      new StorageEvent('storage', { key: FCM_REQUESTED_KEY, newValue: '1' }),
    );

    await waitFor(() => expect(result.current).toBe('pending'));

    // Now simulate token stored
    localStorage.setItem(FCM_TOKEN_STORED_KEY, '1');
    window.dispatchEvent(
      new StorageEvent('storage', { key: FCM_TOKEN_STORED_KEY, newValue: '1' }),
    );

    await waitFor(() => expect(result.current).toBe('registered'));
  });

  it('does NOT update status when an unrelated storage key changes', async () => {
    localStorage.setItem(FCM_REQUESTED_KEY, '1');
    const { result } = renderHook(() => useFcmRegistrationStatus());
    expect(result.current).toBe('pending');

    // Fire a storage event for an unrelated key
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'some-other-key', newValue: 'foo' }),
    );

    // Status should remain 'pending' — no update triggered
    expect(result.current).toBe('pending');
  });
});
