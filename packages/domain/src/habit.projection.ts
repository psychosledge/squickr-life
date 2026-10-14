import type { IEventStore } from './event-store';
import type { DomainEvent } from './domain-event';
import type {
  HabitReadModel,
  HabitDayStatus,
  HabitFrequency,
  SerializableHabitState,
} from './habit.types';
import { getLocalDateKey, isoToLocalDateKey } from './date-utils';

// ============================================================================
// Internal aggregate state
// ============================================================================

interface ScheduleEntry {
  changedAt: string;
  frequency: HabitFrequency;
}

interface HabitState {
  id: string;
  title: string;
  /** Ascending by changedAt */
  schedule: [ScheduleEntry, ...ScheduleEntry[]];
  createdAt: string;
  order: string;
  archivedAt?: string;
  notificationTime?: string;
  /** date → completedAt ISO (last completion wins) */
  completions: Map<string, string>;
  reverted: Set<string>;
}

// ============================================================================
// Helper: date arithmetic (pure, no timezone drift)
// ============================================================================

/** Parse a YYYY-MM-DD string to a UTC midnight timestamp (ms). */
function dateKeyToMs(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

/** Format a UTC timestamp (ms) back to YYYY-MM-DD. */
function msToDateKey(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Day-of-week (0=Sun…6=Sat) for a YYYY-MM-DD string, using local noon.
 *  Matches `new Date(date + 'T12:00:00').getDay()` used by tests for scheduling
 *  (e.g. history "missed" vs "not-scheduled" check). */
function dayOfWeekLocal(dateKey: string): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return new Date(`${dateKey}T12:00:00`).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

/** Day-of-week (0=Sun…6=Sat) for a YYYY-MM-DD string, using UTC midnight → local.
 *  Matches `new Date(dateKey).getDay()` used by tests when deriving targetDays
 *  and when computing week boundaries for weekly streaks. */
function dayOfWeekUtcMidnight(dateKey: string): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return new Date(dateKey).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

/** Number of whole days between two YYYY-MM-DD strings (b - a). */
function daysDiff(a: string, b: string): number {
  return (dateKeyToMs(b) - dateKeyToMs(a)) / 86_400_000;
}

function computeNextDueDateRelative(state: HabitState, frequency: HabitFrequency, completedDates: string[]): string {
  if (completedDates.length === 0) {
    return isoToLocalDateKey(state.createdAt);
  }

  const lastCompletion = [...completedDates].sort().at(-1)!;

  let intervalDays: number;
  switch (frequency.type) {
    case 'daily': intervalDays = 1; break;
    case 'weekly': intervalDays = 7; break;
    case 'every-n-days': intervalDays = frequency.n; break;
  }

  return msToDateKey(dateKeyToMs(lastCompletion) + intervalDays * 86_400_000);
}

function isRelativeDueCountingAllCompletions(state: HabitState, frequency: HabitFrequency, dateKey: string): boolean {
  return computeNextDueDateRelative(state, frequency, activeCompletionDates(state)) <= dateKey;
}

function isRelativeDueOn(state: HabitState, frequency: HabitFrequency, dateKey: string): boolean {
  const completionsBefore = activeCompletionDates(state).filter(d => d < dateKey);
  return computeNextDueDateRelative(state, frequency, completionsBefore) <= dateKey;
}

function isCompletedOn(state: HabitState, dateKey: string): boolean {
  return state.completions.has(dateKey) && !state.reverted.has(dateKey);
}

function activeCompletionDates(state: HabitState): string[] {
  return [...state.completions.keys()].filter(d => !state.reverted.has(d));
}

/** Monday of the ISO week that contains `dateKey`, using UTC-midnight local day.
 *  This must match the targetDays derivation (`new Date(dateKey).getDay()`). */
function weekStart(dateKey: string): string {
  const dow = dayOfWeekUtcMidnight(dateKey);
  // Convert Sun=0 to Mon-based: Mon=0…Sun=6
  const monBased = (dow + 6) % 7;
  return msToDateKey(dateKeyToMs(dateKey) - monBased * 86_400_000);
}

// ============================================================================
// Determine whether a habit is scheduled on a given date
// ============================================================================

function isScheduledOn(freq: HabitFrequency, dateKey: string, createdAt: string): boolean {
  if (freq.mode === 'relative') return false;

  switch (freq.type) {
    case 'daily':
      return true;

    case 'weekly':
      return freq.targetDays.includes(dayOfWeekLocal(dateKey));

    case 'every-n-days': {
      const createdKey = isoToLocalDateKey(createdAt);
      const diff = daysDiff(createdKey, dateKey);
      return diff >= 0 && diff % freq.n === 0;
    }
  }
}

function currentFrequency(state: HabitState): HabitFrequency {
  return (state.schedule.at(-1) ?? state.schedule[0]).frequency;
}

function frequencyOn(state: HabitState, dateKey: string): HabitFrequency {
  let frequency = state.schedule[0].frequency;
  for (const entry of state.schedule) {
    if (isoToLocalDateKey(entry.changedAt) <= dateKey) frequency = entry.frequency;
  }
  return frequency;
}

// ============================================================================
// Build a 30-day history for a habit
// ============================================================================

function buildHistory(
  state: HabitState,
  today: string,
): HabitDayStatus[] {
  const todayMs = dateKeyToMs(today);
  const history: HabitDayStatus[] = [];
  const createdKey = isoToLocalDateKey(state.createdAt);

  for (let i = 29; i >= 0; i--) {
    const dateMs = todayMs - i * 86_400_000;
    const dateKey = msToDateKey(dateMs);

    if (dateKey < createdKey) {
      history.push({ date: dateKey, status: 'not-scheduled' });
      continue;
    }

    if (isCompletedOn(state, dateKey)) {
      history.push({ date: dateKey, status: 'completed' });
      continue;
    }

    const frequency = frequencyOn(state, dateKey);

    if (frequency.mode === 'relative') {
      const isPastDay = i > 0;
      if (isPastDay) {
        history.push({ date: dateKey, status: 'not-scheduled' });
      } else {
        history.push({ date: dateKey, status: isRelativeDueCountingAllCompletions(state, frequency, today) ? 'missed' : 'not-scheduled' });
      }
      continue;
    }

    if (!isScheduledOn(frequency, dateKey, state.createdAt)) {
      history.push({ date: dateKey, status: 'not-scheduled' });
    } else {
      history.push({ date: dateKey, status: 'missed' });
    }
  }

  return history;
}

// ============================================================================
// Streak algorithms
// ============================================================================

/** Daily streak: walk backwards from today (or yesterday if today is not completed). */
function computeDailyStreak(
  state: HabitState,
  today: string,
  history: 'current' | 'full',
): number {
  const completedDates = new Set(activeCompletionDates(state));

  if (completedDates.size === 0) return 0;

  const todayMs = dateKeyToMs(today);
  const isCompletedToday = completedDates.has(today);

  if (history === 'current') {
    // Start from today if completed, otherwise from yesterday
    let streakMs = isCompletedToday ? todayMs : todayMs - 86_400_000;

    // If neither today nor yesterday is completed → 0
    if (!completedDates.has(msToDateKey(streakMs))) return 0;

    let count = 0;
    while (completedDates.has(msToDateKey(streakMs))) {
      count++;
      streakMs -= 86_400_000;
      // Safety guard: don't go back more than 10 years
      if (count > 3650) break;
    }
    return count;
  }

  // 'full' — longest streak over all history
  // Sort all completed dates ascending and find max consecutive run
  const sortedDates = [...completedDates].sort();
  if (sortedDates.length === 0) return 0;

  let longest = 1;
  let current = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = sortedDates[i - 1]!;
    const curr = sortedDates[i]!;
    if (daysDiff(prev, curr) === 1) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  return longest;
}

/** Weekly streak: count consecutive ISO weeks (up to and including current week) where
 *  all targetDays that have already passed in the week have completions. */
function computeWeeklyStreak(
  state: HabitState,
  today: string,
  mode: 'current' | 'full',
): number {
  const freq = currentFrequency(state);
  if (freq.type !== 'weekly') return 0;

  const completedDates = new Set(activeCompletionDates(state));

  if (completedDates.size === 0) return 0;

  const targetDays = freq.targetDays;

  /** Check if a given ISO week (identified by its Monday dateKey) "passes".
   *  A week passes if every targetDay that falls on or before `ceilDate` has a completion. */
  function weekPasses(mondayKey: string, ceilDate: string): boolean {
    for (const dow of targetDays) {
      // Monday offset: Mon=1,Tue=2,...,Sun=7 in ISO, but our dayOfWeek is Sun=0..Sat=6
      // Map targetDay (Sun=0..Sat=6) to days-from-Monday
      const offset = (dow + 6) % 7; // Mon=0..Sun=6
      const dayMs = dateKeyToMs(mondayKey) + offset * 86_400_000;
      const dayKey = msToDateKey(dayMs);
      // Only require completion if this day is ≤ ceilDate
      if (dayKey > ceilDate) continue;
      if (!completedDates.has(dayKey)) return false;
    }
    return true;
  }

  if (mode === 'current') {
    let streak = 0;
    let weekMs = dateKeyToMs(weekStart(today));

    while (true) {
      const monday = msToDateKey(weekMs);
      const sunday = msToDateKey(weekMs + 6 * 86_400_000);
      const ceil = monday === weekStart(today) ? today : sunday;

      if (!weekPasses(monday, ceil)) break;
      streak++;
      weekMs -= 7 * 86_400_000;
      if (streak > 520) break; // safety: ~10 years
    }
    return streak;
  }

  // 'full': scan all weeks from earliest completion to today
  const allDates = [...completedDates].sort();
  if (allDates.length === 0) return 0;

  const earliestMs = dateKeyToMs(weekStart(allDates[0]!));
  const latestWeekMs = dateKeyToMs(weekStart(today));

  let longest = 0;
  let current = 0;
  let weekMs = earliestMs;

  while (weekMs <= latestWeekMs) {
    const monday = msToDateKey(weekMs);
    const sunday = msToDateKey(weekMs + 6 * 86_400_000);
    const isCurrentWeek = monday === weekStart(today);
    const ceil = isCurrentWeek ? today : sunday;

    if (weekPasses(monday, ceil)) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
    weekMs += 7 * 86_400_000;
  }
  return longest;
}

/** Every-n-days streak: count consecutive n-day windows (backwards from today)
 *  each containing at least one completion. */
function computeEveryNDaysStreak(
  state: HabitState,
  today: string,
  mode: 'current' | 'full',
): number {
  const freq = currentFrequency(state);
  if (freq.type !== 'every-n-days') return 0;

  const completedDates = new Set(activeCompletionDates(state));

  if (completedDates.size === 0) return 0;

  const n = freq.n;

  if (mode === 'current') {
    let streak = 0;
    let windowEndMs = dateKeyToMs(today);

    while (true) {
      const windowStartMs = windowEndMs - (n - 1) * 86_400_000;
      const windowStart = msToDateKey(windowStartMs);
      const windowEnd = msToDateKey(windowEndMs);

      // Check if any completion falls within [windowStart, windowEnd]
      const hasCompletion = [...completedDates].some(d => d >= windowStart && d <= windowEnd);
      if (!hasCompletion) break;

      streak++;
      windowEndMs -= n * 86_400_000;
      if (streak > 3650) break; // safety
    }
    return streak;
  }

  const allDates = [...completedDates].sort();
  if (allDates.length === 0) return 0;

  const createdKey = isoToLocalDateKey(state.createdAt);
  const todayMs = dateKeyToMs(today);
  const createdMs = dateKeyToMs(createdKey);

  const totalDays = (todayMs - createdMs) / 86_400_000;
  const numWindows = Math.floor(totalDays / n) + 1;

  let longest = 0;
  let current = 0;

  for (let w = 0; w < numWindows; w++) {
    const windowStartMs = createdMs + w * n * 86_400_000;
    const windowEndMs = windowStartMs + (n - 1) * 86_400_000;
    const windowStart = msToDateKey(windowStartMs);
    const windowEnd = msToDateKey(Math.min(windowEndMs, todayMs));

    const hasCompletion = [...completedDates].some(d => d >= windowStart && d <= windowEnd);
    if (hasCompletion) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

function computeCurrentStreak(state: HabitState, today: string): number {
  switch (currentFrequency(state).type) {
    case 'daily':
      return computeDailyStreak(state, today, 'current');
    case 'weekly':
      return computeWeeklyStreak(state, today, 'current');
    case 'every-n-days':
      return computeEveryNDaysStreak(state, today, 'current');
  }
}

function computeLongestStreak(state: HabitState, today: string): number {
  switch (currentFrequency(state).type) {
    case 'daily':
      return computeDailyStreak(state, today, 'full');
    case 'weekly':
      return computeWeeklyStreak(state, today, 'full');
    case 'every-n-days':
      return computeEveryNDaysStreak(state, today, 'full');
  }
}

// ============================================================================
// Event type guard and single-event application helper
// ============================================================================

/** Returns true for any event type owned by the Habit aggregate. */
function isHabitEvent(event: DomainEvent): boolean {
  return (
    event.type === 'HabitCreated' ||
    event.type === 'HabitTitleChanged' ||
    event.type === 'HabitFrequencyChanged' ||
    event.type === 'HabitCompleted' ||
    event.type === 'HabitCompletionReverted' ||
    event.type === 'HabitArchived' ||
    event.type === 'HabitRestored' ||
    event.type === 'HabitReordered' ||
    event.type === 'HabitNotificationTimeSet' ||
    event.type === 'HabitNotificationTimeCleared'
  );
}

function insertScheduleEntry(state: HabitState, entry: ScheduleEntry): void {
  const index = state.schedule.findIndex((e, i) => i > 0 && e.changedAt > entry.changedAt);
  state.schedule.splice(index === -1 ? state.schedule.length : index, 0, entry);
}

function applyHabitEvent(states: Map<string, HabitState>, event: DomainEvent): void {
  switch (event.type) {
    case 'HabitCreated': {
      const p = (event as import('./habit.types').HabitCreated).payload;
      states.set(p.habitId, {
        id: p.habitId,
        title: p.title,
        schedule: [{ changedAt: p.createdAt, frequency: p.frequency }],
        createdAt: p.createdAt,
        order: p.order,
        notificationTime: p.notificationTime,
        completions: new Map(),
        reverted: new Set(),
      });
      break;
    }
    case 'HabitTitleChanged': {
      const p = (event as import('./habit.types').HabitTitleChanged).payload;
      const s = states.get(p.habitId);
      if (s) s.title = p.title;
      break;
    }
    case 'HabitFrequencyChanged': {
      const p = (event as import('./habit.types').HabitFrequencyChanged).payload;
      const s = states.get(p.habitId);
      if (s) insertScheduleEntry(s, { changedAt: p.updatedAt, frequency: p.frequency });
      break;
    }
    case 'HabitCompleted': {
      const p = (event as import('./habit.types').HabitCompleted).payload;
      const s = states.get(p.habitId);
      if (s) {
        s.completions.set(p.date, p.completedAt);
        s.reverted.delete(p.date);
      }
      break;
    }
    case 'HabitCompletionReverted': {
      const p = (event as import('./habit.types').HabitCompletionReverted).payload;
      const s = states.get(p.habitId);
      if (s) s.reverted.add(p.date);
      break;
    }
    case 'HabitArchived': {
      const p = (event as import('./habit.types').HabitArchived).payload;
      const s = states.get(p.habitId);
      if (s) s.archivedAt = p.archivedAt;
      break;
    }
    case 'HabitRestored': {
      const p = (event as import('./habit.types').HabitRestored).payload;
      const s = states.get(p.habitId);
      if (s) s.archivedAt = undefined;
      break;
    }
    case 'HabitReordered': {
      const p = (event as import('./habit.types').HabitReordered).payload;
      const s = states.get(p.habitId);
      if (s) s.order = p.order;
      break;
    }
    case 'HabitNotificationTimeSet': {
      const p = (event as import('./habit.types').HabitNotificationTimeSet).payload;
      const s = states.get(p.habitId);
      if (s) s.notificationTime = p.notificationTime;
      break;
    }
    case 'HabitNotificationTimeCleared': {
      const p = (event as import('./habit.types').HabitNotificationTimeCleared).payload;
      const s = states.get(p.habitId);
      if (s) s.notificationTime = undefined;
      break;
    }
  }
}

// ============================================================================
// Replay events into HabitState map
// ============================================================================

function replayEvents(events: DomainEvent[]): Map<string, HabitState> {
  const states = new Map<string, HabitState>();
  for (const event of events) {
    applyHabitEvent(states, event);
  }
  return states;
}

// ============================================================================
// Build a HabitReadModel from a HabitState
// ============================================================================

function buildReadModel(state: HabitState, today: string): HabitReadModel {
  const history = buildHistory(state, today);
  const currentStreak = computeCurrentStreak(state, today);
  const longestStreak = Math.max(computeLongestStreak(state, today), currentStreak);

  const frequency = currentFrequency(state);
  const isScheduledToday = frequency.mode === 'relative'
    ? isRelativeDueCountingAllCompletions(state, frequency, today)
    : isScheduledOn(frequency, today, state.createdAt);
  const isCompletedToday = isCompletedOn(state, today);

  return {
    id: state.id,
    title: state.title,
    frequency,
    currentStreak,
    longestStreak,
    history,
    isScheduledToday,
    isCompletedToday,
    archivedAt: state.archivedAt,
    order: state.order,
    notificationTime: state.notificationTime,
  };
}

// ============================================================================
// HabitProjection
// ============================================================================

/**
 * HabitProjection — Read model for habits.
 *
 * Replays all HabitEvent events from the event store to build the current
 * state of all habits, then exposes query methods for the UI layer.
 */
export class HabitProjection {
  /** In-memory cache of the replayed habit states. Null means cache is cold. */
  private stateCache: Map<string, HabitState> | null = null;

  /** Subscribers notified on cache invalidation or hydration. */
  private subscribers = new Set<() => void>();

  constructor(private readonly eventStore: IEventStore) {
    // Apply habit events incrementally to preserve snapshot-seeded state (ADR-025/026).
    // Non-habit events are ignored — they cannot affect habit state.
    // When the cache is cold (null), habit events are silently dropped here; the next
    // query will trigger a full replay from the event store via loadStates().
    this.eventStore.subscribe((event: DomainEvent) => {
      if (!isHabitEvent(event)) return;
      if (this.stateCache !== null) {
        applyHabitEvent(this.stateCache, event);
      }
      this.notifySubscribers();
    });
  }

  // ── Private: load & replay ─────────────────────────────────────────────────

  private async loadStates(): Promise<Map<string, HabitState>> {
    if (this.stateCache !== null) {
      return this.stateCache;
    }
    const allEvents = await this.eventStore.getAll();
    this.stateCache = replayEvents(allEvents);
    return this.stateCache;
  }

  // ── Snapshot support (ADR-026) ─────────────────────────────────────────────

  hydrateFromSnapshot(states: SerializableHabitState[]): void {
    const map = new Map<string, HabitState>();
    for (const s of states) {
      map.set(s.id, {
        id: s.id,
        title: s.title,
        schedule: [{ changedAt: s.createdAt, frequency: s.frequency }],
        createdAt: s.createdAt,
        order: s.order,
        archivedAt: s.archivedAt,
        notificationTime: s.notificationTime,
        completions: new Map(Object.entries(s.completions)),
        reverted: new Set(s.reverted),
      });
    }
    this.stateCache = map;
    this.notifySubscribers();
  }

  async getStatesForSnapshot(): Promise<SerializableHabitState[]> {
    const states = await this.loadStates();
    return [...states.values()].map(s => ({
      id: s.id,
      title: s.title,
      frequency: currentFrequency(s),
      createdAt: s.createdAt,
      order: s.order,
      archivedAt: s.archivedAt,
      notificationTime: s.notificationTime,
      completions: Object.fromEntries(s.completions),
      reverted: [...s.reverted],
    }));
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private notifySubscribers(): void {
    this.subscribers.forEach(cb => cb());
  }

  // ── Public query methods ───────────────────────────────────────────────────

  /** Returns all non-archived habits, sorted by `order` field ascending. */
  async getActiveHabits(options?: { asOf?: string }): Promise<HabitReadModel[]> {
    const today = options?.asOf ?? getLocalDateKey();
    const states = await this.loadStates();
    return [...states.values()]
      .filter(s => !s.archivedAt)
      .sort((a, b) => a.order.localeCompare(b.order))
      .map(s => buildReadModel(s, today));
  }

  /** Returns all habits (active + archived), sorted by `order` field ascending. */
  async getAllHabits(options?: { asOf?: string }): Promise<HabitReadModel[]> {
    const today = options?.asOf ?? getLocalDateKey();
    const states = await this.loadStates();
    return [...states.values()]
      .sort((a, b) => a.order.localeCompare(b.order))
      .map(s => buildReadModel(s, today));
  }

  /** Returns a single habit by ID, or `undefined` if not found. */
  async getHabitById(habitId: string, options?: { asOf?: string }): Promise<HabitReadModel | undefined> {
    const today = options?.asOf ?? getLocalDateKey();
    const states = await this.loadStates();
    const state = states.get(habitId);
    if (!state) return undefined;
    return buildReadModel(state, today);
  }

  async getHabitsForDate(date: string, options?: { asOf?: string }): Promise<HabitReadModel[]> {
    const today = options?.asOf ?? getLocalDateKey();
    const states = await this.loadStates();

    return [...states.values()]
      .filter(s => !s.archivedAt)
      .filter(s => {
        if (isCompletedOn(s, date)) return true;
        const frequency = frequencyOn(s, date);
        return frequency.mode === 'relative'
          ? isRelativeDueOn(s, frequency, date)
          : isScheduledOn(frequency, date, s.createdAt);
      })
      .sort((a, b) => a.order.localeCompare(b.order))
      .map(s => buildReadModel(s, today));
  }

  /**
   * Subscribe to projection changes (cache invalidation or hydration).
   * Returns an unsubscribe function.
   */
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
}
