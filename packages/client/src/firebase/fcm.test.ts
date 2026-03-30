/**
 * FCM Token Registration Tests
 *
 * Tests for `registerFcmToken` — the function that:
 *  1. Gates on localStorage so we never re-request permission
 *  2. Requests notification permission
 *  3. Checks firebase/messaging is supported
 *  4. Retrieves an FCM token
 *  5. Writes the token doc to Firestore under users/{userId}/fcmTokens/{sha256(token)}
 *  6. Fails silently throughout — never throws to the caller
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';

// ── Module mocks ────────────────────────────────────────────────────────────
// These must be declared before any import of the module under test because
// Vitest hoists vi.mock() calls to the top of the file.

vi.mock('firebase/messaging', () => ({
  isSupported: vi.fn(),
  getMessaging: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _isServerTimestamp: true })),
  // keep the existing global mock fields for safety
  initializeFirestore: vi.fn(() => ({})),
  persistentLocalCache: vi.fn(() => ({})),
  collection: vi.fn(),
  getDocs: vi.fn(),
  writeBatch: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

// Mock navigator.serviceWorker
const mockSwRegistration = { scope: '/' };
const mockRegister = vi.fn().mockResolvedValue(mockSwRegistration);
Object.defineProperty(globalThis, 'navigator', {
  writable: true,
  value: {
    ...globalThis.navigator,
    serviceWorker: {
      register: mockRegister,
    },
  },
});

// ── Import module under test (after mocks are hoisted) ─────────────────────
import { registerFcmToken, FCM_REQUESTED_KEY, FCM_TOKEN_STORED_KEY } from './fcm';
import { isSupported, getMessaging, getToken } from 'firebase/messaging';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

// ── Helpers ─────────────────────────────────────────────────────────────────

function setupGranted() {
  vi.spyOn(Notification, 'requestPermission').mockResolvedValue('granted');
  (isSupported as Mock).mockResolvedValue(true);
  (getMessaging as Mock).mockReturnValue({ name: 'messaging' });
  (getToken as Mock).mockResolvedValue('fake-fcm-token-abc123');
  (doc as Mock).mockReturnValue({ path: 'users/user1/fcmTokens/hashed' });
  (setDoc as Mock).mockResolvedValue(undefined);
}

// ── Test suite ───────────────────────────────────────────────────────────────

describe('registerFcmToken', () => {
  beforeEach(() => {
    // Clear localStorage gate before each test
    localStorage.clear();

    // Reset all mocks
    vi.clearAllMocks();
    mockRegister.mockResolvedValue(mockSwRegistration);

    // Default: Notification API present
    if (!('Notification' in globalThis)) {
      Object.defineProperty(globalThis, 'Notification', {
        writable: true,
        configurable: true,
        value: { requestPermission: vi.fn() },
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Test 1 (rewritten) ─────────────────────────────────────────────────
  it('does NOT call Notification.requestPermission when FCM_REQUESTED_KEY already set (retry path)', async () => {
    localStorage.setItem(FCM_REQUESTED_KEY, '1');
    setupGranted();
    const spy = vi.spyOn(Notification, 'requestPermission');
    await registerFcmToken('user1');
    expect(spy).not.toHaveBeenCalled();
    expect(setDoc).toHaveBeenCalledTimes(1);
  });

  // ── Test 2 ──────────────────────────────────────────────────────────────
  it('does NOT write to Firestore if permission is "denied"', async () => {
    vi.spyOn(Notification, 'requestPermission').mockResolvedValue('denied');

    await registerFcmToken('user1');

    expect(setDoc).not.toHaveBeenCalled();
  });

  // ── Test 3 ──────────────────────────────────────────────────────────────
  it('does NOT write to Firestore if permission is "default" (dismissed)', async () => {
    vi.spyOn(Notification, 'requestPermission').mockResolvedValue('default');

    await registerFcmToken('user1');

    expect(setDoc).not.toHaveBeenCalled();
  });

  // ── Test 4 ──────────────────────────────────────────────────────────────
  it('does NOT write to Firestore if isSupported() returns false', async () => {
    vi.spyOn(Notification, 'requestPermission').mockResolvedValue('granted');
    (isSupported as Mock).mockResolvedValue(false);

    await registerFcmToken('user1');

    expect(setDoc).not.toHaveBeenCalled();
  });

  // ── Test 5 ──────────────────────────────────────────────────────────────
  it('writes token document with correct shape when permission is granted and isSupported is true', async () => {
    setupGranted();

    await registerFcmToken('user1');

    expect(setDoc).toHaveBeenCalledTimes(1);

    // Verify doc path includes userId
    expect(doc).toHaveBeenCalledWith(
      expect.anything(),                 // firestore instance
      expect.stringContaining('user1'),  // path contains userId
    );

    // Verify setDoc payload shape
    const payload = (setDoc as Mock).mock.calls[0][1];
    expect(payload).toMatchObject({
      token: 'fake-fcm-token-abc123',
      timezone: expect.any(String),
      lastSeenAt: expect.anything(),
      appVersion: expect.any(String),
      createdAt: expect.anything(),
    });

    // Verify merge:true
    const options = (setDoc as Mock).mock.calls[0][2];
    expect(options).toEqual({ merge: true });
  });

  // ── Test 6 ──────────────────────────────────────────────────────────────
  it('tokenId is deterministic — same token always produces the same doc path', async () => {
    setupGranted();
    (getToken as Mock).mockResolvedValue('deterministic-token');

    await registerFcmToken('user42');
    const firstDocArg = (doc as Mock).mock.calls[0][1] as string;

    // Reset and call again with same token
    vi.clearAllMocks();
    localStorage.clear();
    mockRegister.mockResolvedValue(mockSwRegistration);
    (isSupported as Mock).mockResolvedValue(true);
    (getMessaging as Mock).mockReturnValue({ name: 'messaging' });
    (getToken as Mock).mockResolvedValue('deterministic-token');
    (doc as Mock).mockReturnValue({ path: '' });
    (setDoc as Mock).mockResolvedValue(undefined);
    vi.spyOn(Notification, 'requestPermission').mockResolvedValue('granted');

    await registerFcmToken('user42');
    const secondDocArg = (doc as Mock).mock.calls[0][1] as string;

    expect(firstDocArg).toBe(secondDocArg);
  });

  // ── Test 7 ──────────────────────────────────────────────────────────────
  it('resolves without throwing if getToken throws (silent fail)', async () => {
    vi.spyOn(Notification, 'requestPermission').mockResolvedValue('granted');
    (isSupported as Mock).mockResolvedValue(true);
    (getMessaging as Mock).mockReturnValue({ name: 'messaging' });
    (getToken as Mock).mockRejectedValue(new Error('VAPID key error'));

    await expect(registerFcmToken('user1')).resolves.toBeUndefined();
    expect(setDoc).not.toHaveBeenCalled();
  });

  // ── Test 8 ──────────────────────────────────────────────────────────────
  it('resolves without throwing if setDoc throws (silent fail)', async () => {
    setupGranted();
    (setDoc as Mock).mockRejectedValue(new Error('Firestore write failed'));

    await expect(registerFcmToken('user1')).resolves.toBeUndefined();
  });

  // ── Test 9 ──────────────────────────────────────────────────────────────
  it('sets localStorage gate BEFORE requesting permission so a crash cannot leave the gate unset', async () => {
    // Make requestPermission throw to simulate a crash
    vi.spyOn(Notification, 'requestPermission').mockRejectedValue(new Error('permission crashed'));

    // The gate should still be set even though requestPermission threw
    await expect(registerFcmToken('user1')).resolves.toBeUndefined();

    expect(localStorage.getItem(FCM_REQUESTED_KEY)).toBe('1');
  });

  // ── Bonus: service worker registration ──────────────────────────────────
  it('registers the FCM service worker before calling getToken', async () => {
    setupGranted();

    await registerFcmToken('user1');

    expect(mockRegister).toHaveBeenCalledWith('/firebase-messaging-sw.js');
    expect(getToken).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ serviceWorkerRegistration: mockSwRegistration }),
    );
  });

  // ── New tests ────────────────────────────────────────────────────────────

  it('takes heartbeat path when both gate keys are present — calls updateDoc not setDoc', async () => {
    localStorage.setItem(FCM_REQUESTED_KEY, '1');
    localStorage.setItem(FCM_TOKEN_STORED_KEY, '1');
    (isSupported as Mock).mockResolvedValue(true);
    (getMessaging as Mock).mockReturnValue({ name: 'messaging' });
    (getToken as Mock).mockResolvedValue('existing-token');
    (updateDoc as Mock).mockResolvedValue(undefined);
    (doc as Mock).mockReturnValue({ path: 'users/user1/fcmTokens/hashed' });
    await registerFcmToken('user1');
    expect(setDoc).not.toHaveBeenCalled();
    expect(updateDoc).toHaveBeenCalledTimes(1);

    // Verify the heartbeat payload shape includes all required fields
    const payload = (updateDoc as Mock).mock.calls[0][1];
    expect(payload).toMatchObject({
      lastSeenAt: expect.anything(),
      appVersion: expect.any(String),
      timezone: expect.any(String),
    });
  });  it('clears FCM_TOKEN_STORED_KEY on heartbeat when getToken returns null', async () => {
    localStorage.setItem(FCM_REQUESTED_KEY, '1');
    localStorage.setItem(FCM_TOKEN_STORED_KEY, '1');
    (isSupported as Mock).mockResolvedValue(true);
    (getMessaging as Mock).mockReturnValue({ name: 'messaging' });
    (getToken as Mock).mockResolvedValue(null);
    await registerFcmToken('user1');
    expect(localStorage.getItem(FCM_TOKEN_STORED_KEY)).toBeNull();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('sets FCM_TOKEN_STORED_KEY after successful Firestore write', async () => {
    setupGranted();
    await registerFcmToken('user1');
    expect(localStorage.getItem(FCM_TOKEN_STORED_KEY)).toBe('1');
  });

  it('does NOT set FCM_TOKEN_STORED_KEY if getToken returns null', async () => {
    vi.spyOn(Notification, 'requestPermission').mockResolvedValue('granted');
    (isSupported as Mock).mockResolvedValue(true);
    (getMessaging as Mock).mockReturnValue({ name: 'messaging' });
    (getToken as Mock).mockResolvedValue(null);
    await registerFcmToken('user1');
    expect(localStorage.getItem(FCM_TOKEN_STORED_KEY)).toBeNull();
  });

  it('does NOT set FCM_TOKEN_STORED_KEY if setDoc throws', async () => {
    setupGranted();
    (setDoc as Mock).mockRejectedValue(new Error('write failed'));
    await registerFcmToken('user1');
    expect(localStorage.getItem(FCM_TOKEN_STORED_KEY)).toBeNull();
  });

  it('retries registration without re-prompting when only FCM_REQUESTED_KEY is set', async () => {
    localStorage.setItem(FCM_REQUESTED_KEY, '1');
    setupGranted();
    await registerFcmToken('user1');
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(FCM_TOKEN_STORED_KEY)).toBe('1');
  });
});
