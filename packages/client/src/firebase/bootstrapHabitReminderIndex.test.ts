/**
 * bootstrapHabitReminderIndex tests
 *
 * Verifies that existing habits are seeded into the
 * users/{userId}/habitReminders Firestore index on first load after
 * deployment, when no events are being uploaded to trigger the index writer.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock firebase/firestore ───────────────────────────────────────────────────

const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockDocRef = { id: 'fake-ref' };
const mockDoc = vi.fn().mockReturnValue(mockDocRef);
const mockServerTimestamp = vi.fn(() => ({ _isServerTimestamp: true }));

const mockDocSnapExists = vi.fn().mockReturnValue(false);
const mockDocSnap = { exists: () => mockDocSnapExists() };
const mockGetDoc = vi.fn().mockResolvedValue(mockDocSnap);

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));

// ── Mock logger ───────────────────────────────────────────────────────────────
vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { bootstrapHabitReminderIndex } from './bootstrapHabitReminderIndex';
import type { HabitProjection } from '@squickr/domain';
import type { HabitReadModel, HabitFrequency } from '@squickr/domain';
import type { Firestore } from 'firebase/firestore';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fakeFirestore = {} as Firestore;
const userId = 'user-abc';

const defaultFrequency: HabitFrequency = { type: 'daily' };

function makeHabitReadModel(options: {
  id?: string;
  title?: string;
  frequency?: HabitFrequency;
  notificationTime?: string;
} = {}): HabitReadModel {
  return {
    id: options.id ?? 'habit-1',
    title: options.title ?? 'Morning run',
    frequency: options.frequency ?? defaultFrequency,
    notificationTime: options.notificationTime,
    currentStreak: 0,
    longestStreak: 0,
    history: [],
    isScheduledToday: true,
    isCompletedToday: false,
    order: '0',
  };
}

function makeHabitProjection(habits: HabitReadModel[]): HabitProjection {
  return {
    getActiveHabits: vi.fn().mockResolvedValue(habits),
    getHabitById: vi.fn(),
    getAllHabits: vi.fn(),
    getHabitsForDate: vi.fn(),
    subscribe: vi.fn(),
  } as unknown as HabitProjection;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('bootstrapHabitReminderIndex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue(mockDocRef);
    mockSetDoc.mockResolvedValue(undefined);
    mockGetDoc.mockResolvedValue(mockDocSnap);
    mockDocSnapExists.mockReturnValue(false);
  });

  // ── Test case 1: habit with notificationTime, doc does not exist ─────────────

  it('calls getDoc then setDoc with correct shape when habit has notificationTime and doc does not exist', async () => {
    const habit = makeHabitReadModel({
      id: 'habit-1',
      title: 'Morning run',
      frequency: defaultFrequency,
      notificationTime: '07:30',
    });
    const projection = makeHabitProjection([habit]);

    mockDocSnapExists.mockReturnValue(false);

    await bootstrapHabitReminderIndex(fakeFirestore, userId, projection);

    expect(mockDoc).toHaveBeenCalledWith(fakeFirestore, `users/${userId}/habitReminders/habit-1`);
    expect(mockGetDoc).toHaveBeenCalledWith(mockDocRef);
    expect(mockSetDoc).toHaveBeenCalledTimes(1);

    const setArgs = mockSetDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(setArgs.habitId).toBe('habit-1');
    expect(setArgs.title).toBe('Morning run');
    expect(setArgs.frequency).toEqual(defaultFrequency);
    expect(setArgs.notificationTime).toBe('07:30');
    expect(setArgs.completedDates).toEqual([]);
    expect(setArgs.userId).toBe(userId);
    expect(setArgs.updatedAt).toBeDefined();
  });

  // ── Test case 2: habit with notificationTime, doc already exists ─────────────

  it('calls getDoc but NOT setDoc when habit has notificationTime and doc already exists', async () => {
    const habit = makeHabitReadModel({
      id: 'habit-1',
      notificationTime: '07:30',
    });
    const projection = makeHabitProjection([habit]);

    mockDocSnapExists.mockReturnValue(true);

    await bootstrapHabitReminderIndex(fakeFirestore, userId, projection);

    expect(mockGetDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  // ── Test case 3: habit without notificationTime ──────────────────────────────

  it('calls neither getDoc nor setDoc when habit has no notificationTime', async () => {
    const habit = makeHabitReadModel({
      id: 'habit-1',
      // notificationTime absent
    });
    const projection = makeHabitProjection([habit]);

    await bootstrapHabitReminderIndex(fakeFirestore, userId, projection);

    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  // ── Test case 4: no active habits ────────────────────────────────────────────

  it('completes without any Firestore calls when there are no active habits', async () => {
    const projection = makeHabitProjection([]);

    await bootstrapHabitReminderIndex(fakeFirestore, userId, projection);

    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  // ── Test case 5: per-habit error is caught, remaining habits processed ────────

  it('catches per-habit errors, logs them, and continues processing remaining habits', async () => {
    const habitWithError = makeHabitReadModel({ id: 'habit-error', notificationTime: '08:00' });
    const habitOk = makeHabitReadModel({ id: 'habit-ok', notificationTime: '09:00' });
    const projection = makeHabitProjection([habitWithError, habitOk]);

    const errorRef = { id: 'error-ref' };
    const okRef = { id: 'ok-ref' };
    mockDoc
      .mockReturnValueOnce(errorRef)
      .mockReturnValueOnce(okRef);

    mockGetDoc
      .mockRejectedValueOnce(new Error('Firestore permission denied'))
      .mockResolvedValueOnce({ exists: () => false });

    const { logger } = await import('../utils/logger');

    await expect(bootstrapHabitReminderIndex(fakeFirestore, userId, projection)).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledTimes(1);
    // Second habit should still have been processed
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc.mock.calls[0][0]).toBe(okRef);
  });

  // ── Test case 6: mixed habits — only missing docs with notificationTime written

  it('handles multiple habits: skips no-notification and existing docs, writes only missing docs with notificationTime', async () => {
    const habitNoTime = makeHabitReadModel({ id: 'habit-no-time' });
    const habitExisting = makeHabitReadModel({ id: 'habit-existing', notificationTime: '06:00' });
    const habitMissing = makeHabitReadModel({ id: 'habit-missing', notificationTime: '07:00' });

    const projection = makeHabitProjection([habitNoTime, habitExisting, habitMissing]);

    const existingRef = { id: 'existing-ref' };
    const missingRef = { id: 'missing-ref' };

    // habit-no-time: no doc call at all
    // habit-existing: doc called, getDoc returns exists=true
    // habit-missing: doc called, getDoc returns exists=false
    mockDoc
      .mockReturnValueOnce(existingRef)
      .mockReturnValueOnce(missingRef);

    mockGetDoc
      .mockResolvedValueOnce({ exists: () => true })
      .mockResolvedValueOnce({ exists: () => false });

    await bootstrapHabitReminderIndex(fakeFirestore, userId, projection);

    // doc() should be called twice — for habit-existing and habit-missing only
    expect(mockDoc).toHaveBeenCalledTimes(2);
    expect(mockDoc).toHaveBeenCalledWith(fakeFirestore, `users/${userId}/habitReminders/habit-existing`);
    expect(mockDoc).toHaveBeenCalledWith(fakeFirestore, `users/${userId}/habitReminders/habit-missing`);

    // getDoc called for both habits with notificationTime
    expect(mockGetDoc).toHaveBeenCalledTimes(2);

    // setDoc called only for the missing doc
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const setArgs = mockSetDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(setArgs.habitId).toBe('habit-missing');
    expect(setArgs.notificationTime).toBe('07:00');
    expect(setArgs.completedDates).toEqual([]);
    expect(setArgs.userId).toBe(userId);
  });
});
