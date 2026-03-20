import { describe, it, expect } from 'vitest';
import { getDateRange } from './reviewDateRange';

describe('getDateRange', () => {
  // ─── Weekly ────────────────────────────────────────────────────────────────

  it('weekly: from is Monday 00:00:00.000 local time', () => {
    // Wednesday 2026-03-18
    const now = new Date(2026, 2, 18, 14, 30, 0);
    const { from } = getDateRange('weekly', now);
    expect(from.getDay()).toBe(1); // Monday
    expect(from.getHours()).toBe(0);
    expect(from.getMinutes()).toBe(0);
    expect(from.getSeconds()).toBe(0);
    expect(from.getMilliseconds()).toBe(0);
  });

  it('weekly: to is Sunday 23:59:59.999 local time', () => {
    // Wednesday 2026-03-18
    const now = new Date(2026, 2, 18, 14, 30, 0);
    const { to } = getDateRange('weekly', now);
    expect(to.getDay()).toBe(0); // Sunday
    expect(to.getHours()).toBe(23);
    expect(to.getMinutes()).toBe(59);
    expect(to.getSeconds()).toBe(59);
    expect(to.getMilliseconds()).toBe(999);
  });

  it('weekly: from and to span exactly 7 days', () => {
    const now = new Date(2026, 2, 18, 14, 30, 0);
    const { from, to } = getDateRange('weekly', now);
    const diffMs = to.getTime() - from.getTime();
    // Sun 23:59:59.999 - Mon 00:00:00.000 = exactly 7 days minus 1ms
    expect(diffMs).toBe(7 * 24 * 60 * 60 * 1000 - 1);
  });

  it('weekly: works when now is Monday', () => {
    // Monday 2026-03-16
    const now = new Date(2026, 2, 16, 9, 0, 0);
    const { from, to } = getDateRange('weekly', now);
    expect(from.getDate()).toBe(16);
    expect(from.getMonth()).toBe(2); // March
    expect(from.getDay()).toBe(1);   // Monday
    expect(to.getDate()).toBe(22);
    expect(to.getDay()).toBe(0);     // Sunday
  });

  it('weekly: works when now is Sunday', () => {
    // Sunday 2026-03-22
    const now = new Date(2026, 2, 22, 20, 0, 0);
    const { from, to } = getDateRange('weekly', now);
    expect(from.getDate()).toBe(16);
    expect(from.getDay()).toBe(1);   // Monday
    expect(to.getDate()).toBe(22);
    expect(to.getDay()).toBe(0);     // Sunday (same day as now)
  });

  it('weekly: works when now is mid-week (Wednesday)', () => {
    // Wednesday 2026-03-18
    const now = new Date(2026, 2, 18, 12, 0, 0);
    const { from, to } = getDateRange('weekly', now);
    expect(from.getDate()).toBe(16); // Monday the 16th
    expect(to.getDate()).toBe(22);   // Sunday the 22nd
  });

  // ─── Monthly ───────────────────────────────────────────────────────────────

  it('monthly: from is first of month 00:00:00.000', () => {
    const now = new Date(2026, 2, 18, 14, 30, 0); // March 2026
    const { from } = getDateRange('monthly', now);
    expect(from.getDate()).toBe(1);
    expect(from.getMonth()).toBe(2); // March
    expect(from.getFullYear()).toBe(2026);
    expect(from.getHours()).toBe(0);
    expect(from.getMinutes()).toBe(0);
    expect(from.getSeconds()).toBe(0);
    expect(from.getMilliseconds()).toBe(0);
  });

  it('monthly: to is last of month 23:59:59.999', () => {
    const now = new Date(2026, 2, 18, 14, 30, 0); // March 2026
    const { to } = getDateRange('monthly', now);
    expect(to.getDate()).toBe(31);  // March has 31 days
    expect(to.getMonth()).toBe(2);
    expect(to.getFullYear()).toBe(2026);
    expect(to.getHours()).toBe(23);
    expect(to.getMinutes()).toBe(59);
    expect(to.getSeconds()).toBe(59);
    expect(to.getMilliseconds()).toBe(999);
  });

  it('monthly: handles December (no year overflow)', () => {
    const now = new Date(2026, 11, 15, 12, 0, 0); // December 2026
    const { from, to } = getDateRange('monthly', now);
    expect(from.getDate()).toBe(1);
    expect(from.getMonth()).toBe(11);
    expect(from.getFullYear()).toBe(2026);
    expect(to.getDate()).toBe(31);
    expect(to.getMonth()).toBe(11);  // Still December, no year rollover
    expect(to.getFullYear()).toBe(2026);
  });

  it('monthly: handles February (28 days in non-leap year)', () => {
    const now = new Date(2026, 1, 10, 12, 0, 0); // February 2026 (non-leap)
    const { from, to } = getDateRange('monthly', now);
    expect(from.getDate()).toBe(1);
    expect(from.getMonth()).toBe(1); // February
    expect(to.getDate()).toBe(28);
    expect(to.getMonth()).toBe(1);  // Still February
    expect(to.getFullYear()).toBe(2026);
  });

  it('monthly: handles February (29 days in leap year, e.g. 2024)', () => {
    const now = new Date(2024, 1, 14, 12, 0, 0); // February 2024 (leap year)
    const { from, to } = getDateRange('monthly', now);
    expect(from.getDate()).toBe(1);
    expect(from.getMonth()).toBe(1); // February
    expect(to.getDate()).toBe(29);
    expect(to.getMonth()).toBe(1);  // Still February
    expect(to.getFullYear()).toBe(2024);
  });
});
