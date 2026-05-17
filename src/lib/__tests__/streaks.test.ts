import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isLogSuccessful, recomputeStreak } from '../streaks';
import { previousDayKey } from '../dates';
import type { Habit, HabitLog } from '@/domain/types';

/* ── Test-data helpers ───────────────────────────────────────────────── */

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    categoryId: 'cat1',
    name: 'Read',
    type: 'good',
    frequency: 'daily',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeLog(date: string, overrides: Partial<HabitLog> = {}): HabitLog {
  return {
    habitId: 'h1',
    date,
    value: 1,
    completed: true,
    ...overrides,
  };
}

/** Inclusive last-N-days (oldest first). */
function lastNDays(end: string, n: number): string[] {
  const out: string[] = [];
  let cur = end;
  for (let i = 0; i < n; i++) {
    out.unshift(cur);
    cur = previousDayKey(cur);
  }
  return out;
}

/* ── isLogSuccessful ─────────────────────────────────────────────────── */

describe('isLogSuccessful', () => {
  it('returns false when no log exists', () => {
    expect(isLogSuccessful(makeHabit(), undefined)).toBe(false);
  });

  describe('good habits', () => {
    it('uses completed flag when no target is set', () => {
      const h = makeHabit({ target: undefined });
      expect(isLogSuccessful(h, makeLog('2026-01-05', { completed: true }))).toBe(true);
      expect(isLogSuccessful(h, makeLog('2026-01-05', { completed: false }))).toBe(
        false,
      );
    });

    it('requires value >= target when target is set', () => {
      const h = makeHabit({ target: 10 });
      expect(isLogSuccessful(h, makeLog('2026-01-05', { value: 9 }))).toBe(false);
      expect(isLogSuccessful(h, makeLog('2026-01-05', { value: 10 }))).toBe(true);
      expect(isLogSuccessful(h, makeLog('2026-01-05', { value: 11 }))).toBe(true);
    });

    it('treats target=0 as "any acknowledged value counts" (>= 0 is always true)', () => {
      // Edge: target of exactly 0. The check is `value >= target`, so 0
      // always passes — the user only has to acknowledge the day exists.
      const h = makeHabit({ target: 0 });
      expect(isLogSuccessful(h, makeLog('2026-01-05', { value: 0 }))).toBe(true);
    });

    it('ignores the completed flag once target is set', () => {
      // If value meets target, the day succeeds regardless of completed.
      // This matches reality: a user who logged 12 pages but forgot to
      // tap the checkbox still read the pages.
      const h = makeHabit({ target: 10 });
      expect(
        isLogSuccessful(h, makeLog('2026-01-05', { value: 12, completed: false })),
      ).toBe(true);
    });
  });

  describe('bad habits', () => {
    it('requires value at-or-below limit AND completed=true', () => {
      const h = makeHabit({ type: 'bad', limit: 2 });
      // Above limit, completed=true → fail
      expect(
        isLogSuccessful(h, makeLog('2026-01-05', { value: 3, completed: true })),
      ).toBe(false);
      // At limit, completed=true → success
      expect(
        isLogSuccessful(h, makeLog('2026-01-05', { value: 2, completed: true })),
      ).toBe(true);
      // Below limit, completed=true → success
      expect(
        isLogSuccessful(h, makeLog('2026-01-05', { value: 0, completed: true })),
      ).toBe(true);
      // At limit, completed=false → fail (the user didn't acknowledge)
      expect(
        isLogSuccessful(h, makeLog('2026-01-05', { value: 1, completed: false })),
      ).toBe(false);
    });

    it('defaults limit to 0 when undefined (strict zero-tolerance)', () => {
      // Bad habits without an explicit limit are treated as "any slip
      // breaks the day". Value > 0 → fail; value === 0 → pass.
      const h = makeHabit({ type: 'bad', limit: undefined });
      expect(
        isLogSuccessful(h, makeLog('2026-01-05', { value: 1, completed: true })),
      ).toBe(false);
      expect(
        isLogSuccessful(h, makeLog('2026-01-05', { value: 0, completed: true })),
      ).toBe(true);
    });
  });
});

/* ── recomputeStreak ─────────────────────────────────────────────────── */

describe('recomputeStreak', () => {
  // Pin "today" so the test isn't sensitive to the wall clock. recomputeStreak
  // calls todayKey() internally, which formats `new Date()`.
  const TODAY = '2026-05-17';

  beforeEach(() => {
    vi.useFakeTimers();
    // Local midnight is fine — todayKey uses date-fns format which is local.
    vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns zeros for an empty log map', () => {
    const result = recomputeStreak(makeHabit(), {});
    expect(result.current).toBe(0);
    expect(result.longest).toBe(0);
    expect(result.lastCompleted).toBeUndefined();
    expect(result.habitId).toBe('h1');
  });

  it('counts today when today is successful (current = 1)', () => {
    const h = makeHabit();
    const result = recomputeStreak(h, { [TODAY]: makeLog(TODAY) });
    expect(result.current).toBe(1);
    expect(result.lastCompleted).toBe(TODAY);
  });

  it("does NOT break the chain when today's log is missing", () => {
    // Mirrors overallStreak: today might not be done yet, so start the
    // back-walk from yesterday.
    const h = makeHabit();
    const days = lastNDays(previousDayKey(TODAY), 5);
    const logs: Record<string, HabitLog> = {};
    for (const d of days) logs[d] = makeLog(d);
    const result = recomputeStreak(h, logs);
    expect(result.current).toBe(5);
    expect(result.lastCompleted).toBe(days[days.length - 1]); // yesterday
  });

  it('counts a long backwards run that includes today', () => {
    const h = makeHabit();
    const days = lastNDays(TODAY, 14);
    const logs: Record<string, HabitLog> = {};
    for (const d of days) logs[d] = makeLog(d);
    const result = recomputeStreak(h, logs);
    expect(result.current).toBe(14);
    expect(result.lastCompleted).toBe(TODAY);
  });

  it('breaks on a missed day inside the back-walk', () => {
    const h = makeHabit();
    const days = lastNDays(TODAY, 10);
    const logs: Record<string, HabitLog> = {};
    for (const d of days) logs[d] = makeLog(d);
    // Punch a hole 4 days back.
    const holeDay = days[days.length - 5];
    delete logs[holeDay];
    const result = recomputeStreak(h, logs);
    // Last 4 days qualified (today through holeDay+1).
    expect(result.current).toBe(4);
  });

  it('honours prevLongest when the new run is shorter', () => {
    const h = makeHabit();
    const days = lastNDays(TODAY, 3); // 3-day current run
    const logs: Record<string, HabitLog> = {};
    for (const d of days) logs[d] = makeLog(d);
    const result = recomputeStreak(h, logs, /* prevLongest */ 42);
    expect(result.current).toBe(3);
    expect(result.longest).toBe(42); // prevLongest wins
  });

  it('overrides prevLongest when the new current is greater', () => {
    const h = makeHabit();
    const days = lastNDays(TODAY, 50);
    const logs: Record<string, HabitLog> = {};
    for (const d of days) logs[d] = makeLog(d);
    const result = recomputeStreak(h, logs, /* prevLongest */ 10);
    expect(result.current).toBe(50);
    expect(result.longest).toBe(50);
  });

  it('respects target semantics: a half-target day breaks the streak', () => {
    const h = makeHabit({ target: 10 });
    const days = lastNDays(TODAY, 6);
    const logs: Record<string, HabitLog> = {};
    for (const d of days) logs[d] = makeLog(d, { value: 10 });
    // Make day-3-back a half day → breaks here.
    logs[days[days.length - 4]] = makeLog(days[days.length - 4], { value: 5 });
    const result = recomputeStreak(h, logs);
    // Last 3 days still successful (today + yesterday + day-before).
    expect(result.current).toBe(3);
  });

  it('respects bad-habit limit semantics', () => {
    const h = makeHabit({ type: 'bad', limit: 2 });
    const days = lastNDays(TODAY, 5);
    const logs: Record<string, HabitLog> = {};
    for (const d of days) logs[d] = makeLog(d, { value: 1, completed: true });
    // Day 2 back: blew the limit → breaks here.
    const blowoutDay = days[days.length - 3];
    logs[blowoutDay] = makeLog(blowoutDay, { value: 5, completed: true });
    const result = recomputeStreak(h, logs);
    // Last 2 days successful (today + yesterday).
    expect(result.current).toBe(2);
  });

  it('handles a single-day streak when only today is successful', () => {
    const h = makeHabit();
    const result = recomputeStreak(h, {
      [TODAY]: makeLog(TODAY),
      // Nothing else — yesterday is empty, which breaks the chain after today.
    });
    expect(result.current).toBe(1);
    expect(result.lastCompleted).toBe(TODAY);
  });
});
