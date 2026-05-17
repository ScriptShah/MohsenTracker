import { describe, expect, it } from 'vitest';
import { dayQualifies, recomputeOverallStreak } from '../overallStreak';
import { previousDayKey } from '../dates';
import type { Habit, HabitLog } from '@/domain/types';

/* ── Test-data helpers ───────────────────────────────────────────────── */

/** Build a minimal `Habit` with sensible defaults. Only the fields the
 *  qualifying-day rule actually reads are populated; everything else gets
 *  whatever satisfies the type. */
function makeHabit(overrides: Partial<Habit> = {}): Habit {
  const defaults: Habit = {
    id: 'h1',
    categoryId: 'cat1',
    name: 'Read',
    type: 'good',
    frequency: 'daily',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  return { ...defaults, ...overrides };
}

/** Build a HabitLog. `completed` defaults to true (most tests want success). */
function makeLog(
  habitId: string,
  date: string,
  overrides: Partial<HabitLog> = {},
): HabitLog {
  return {
    habitId,
    date,
    value: 1,
    completed: true,
    ...overrides,
  };
}

/** Walks `n` days back from `start` (inclusive of start), returning the
 *  list of YYYY-MM-DD keys in chronological (oldest-first) order. */
function lastNDays(start: string, n: number): string[] {
  const out: string[] = [];
  let cur = start;
  for (let i = 0; i < n; i++) {
    out.unshift(cur);
    cur = previousDayKey(cur);
  }
  return out;
}

/* ── dayQualifies ────────────────────────────────────────────────────── */

describe('dayQualifies', () => {
  const date = '2026-05-17';

  it('returns false when no habits existed on the date', () => {
    // Habit was created AFTER the date being asked about.
    const futureHabit = makeHabit({ createdAt: '2026-06-01T00:00:00.000Z' });
    expect(dayQualifies(date, [futureHabit], {})).toBe(false);
  });

  it('returns false for an empty habit list', () => {
    expect(dayQualifies(date, [], {})).toBe(false);
  });

  describe('with critical habits', () => {
    it('qualifies when every critical habit is successful', () => {
      const h1 = makeHabit({ id: 'h1', isCritical: true });
      const h2 = makeHabit({ id: 'h2', isCritical: true });
      const logs = {
        h1: makeLog('h1', date),
        h2: makeLog('h2', date),
      };
      expect(dayQualifies(date, [h1, h2], logs)).toBe(true);
    });

    it('does NOT qualify when any critical habit is missed', () => {
      const h1 = makeHabit({ id: 'h1', isCritical: true });
      const h2 = makeHabit({ id: 'h2', isCritical: true });
      const logs = {
        h1: makeLog('h1', date),
        // h2 has no log → not successful
      };
      expect(dayQualifies(date, [h1, h2], logs)).toBe(false);
    });

    it('ignores non-critical habits when criticals exist', () => {
      // A failing non-critical habit shouldn't break a day where the
      // critical habits all succeeded.
      const critical = makeHabit({ id: 'h1', isCritical: true });
      const optional = makeHabit({ id: 'h2', isCritical: false });
      const logs = {
        h1: makeLog('h1', date),
        // h2 has no log — irrelevant because there's at least one critical
      };
      expect(dayQualifies(date, [critical, optional], logs)).toBe(true);
    });

    it('ignores critical habits that did not exist yet on the date', () => {
      // A critical habit created AFTER the date should not gate that
      // historical day. The day should fall back to "any successful habit".
      const ancient = makeHabit({
        id: 'h1',
        isCritical: false,
        createdAt: '2025-01-01T00:00:00.000Z',
      });
      const futureCritical = makeHabit({
        id: 'h2',
        isCritical: true,
        createdAt: '2026-06-01T00:00:00.000Z',
      });
      const logs = { h1: makeLog('h1', date) };
      expect(dayQualifies(date, [ancient, futureCritical], logs)).toBe(true);
    });
  });

  describe('without critical habits (fallback rule)', () => {
    it('qualifies when at least one habit is successful', () => {
      const h1 = makeHabit({ id: 'h1' });
      const h2 = makeHabit({ id: 'h2' });
      const logs = {
        h1: makeLog('h1', date),
        // h2 missed — fine, we only need one
      };
      expect(dayQualifies(date, [h1, h2], logs)).toBe(true);
    });

    it('does NOT qualify when no habit is successful', () => {
      const h1 = makeHabit({ id: 'h1' });
      expect(dayQualifies(date, [h1], {})).toBe(false);
    });
  });

  describe('successful-log semantics', () => {
    it('respects target for good habits', () => {
      const h = makeHabit({ id: 'h1', target: 10, unit: 'pages' });
      const date2 = '2026-05-17';
      // value below target → not successful
      expect(
        dayQualifies(date2, [h], {
          h1: makeLog('h1', date2, { value: 5 }),
        }),
      ).toBe(false);
      // value meets target → successful
      expect(
        dayQualifies(date2, [h], {
          h1: makeLog('h1', date2, { value: 10 }),
        }),
      ).toBe(true);
      // value exceeds target → still successful
      expect(
        dayQualifies(date2, [h], {
          h1: makeLog('h1', date2, { value: 99 }),
        }),
      ).toBe(true);
    });

    it('respects limit for bad habits', () => {
      const h = makeHabit({ id: 'h1', type: 'bad', limit: 2, unit: 'incidents' });
      const date2 = '2026-05-17';
      // Bad habits also need completed=true (acknowledges the day).
      // Above limit → not successful even if completed
      expect(
        dayQualifies(date2, [h], {
          h1: makeLog('h1', date2, { value: 3, completed: true }),
        }),
      ).toBe(false);
      // At or below limit + completed → successful
      expect(
        dayQualifies(date2, [h], {
          h1: makeLog('h1', date2, { value: 2, completed: true }),
        }),
      ).toBe(true);
      // At or below limit but completed=false → NOT successful
      // (mirrors isLogSuccessful: bad habits require explicit acknowledgement)
      expect(
        dayQualifies(date2, [h], {
          h1: makeLog('h1', date2, { value: 0, completed: false }),
        }),
      ).toBe(false);
    });
  });
});

/* ── recomputeOverallStreak ──────────────────────────────────────────── */

describe('recomputeOverallStreak', () => {
  const today = '2026-05-17';

  it('returns zeros and null when there is no history at all', () => {
    const result = recomputeOverallStreak({}, [], {}, today);
    expect(result).toEqual({ current: 0, longest: 0, lastQualifyingDate: null });
  });

  it('counts today when today qualifies (current = 1)', () => {
    const h = makeHabit({ createdAt: '2026-01-01T00:00:00.000Z' });
    const logs = {
      [today]: { h1: makeLog('h1', today) },
    };
    const result = recomputeOverallStreak(logs, [h], {}, today);
    expect(result.current).toBe(1);
    expect(result.lastQualifyingDate).toBe(today);
  });

  it('does NOT break the chain when today is missing — yesterday extends', () => {
    // "Today might not be done yet" is the streaks.ts contract that
    // overallStreak.ts mirrors. A user opening the app first thing in the
    // morning should still see yesterday's streak intact.
    const h = makeHabit({ createdAt: '2026-01-01T00:00:00.000Z' });
    const days = lastNDays(previousDayKey(today), 5); // 5 successful days ending yesterday
    const logs: Record<string, Record<string, HabitLog>> = {};
    for (const d of days) {
      logs[d] = { h1: makeLog('h1', d) };
    }
    // Today is intentionally omitted (no log)
    const result = recomputeOverallStreak(logs, [h], {}, today);
    expect(result.current).toBe(5);
    expect(result.lastQualifyingDate).toBe(days[days.length - 1]); // yesterday
  });

  it('counts a long backwards run including today', () => {
    const h = makeHabit({ createdAt: '2026-01-01T00:00:00.000Z' });
    const days = lastNDays(today, 12);
    const logs: Record<string, Record<string, HabitLog>> = {};
    for (const d of days) {
      logs[d] = { h1: makeLog('h1', d) };
    }
    const result = recomputeOverallStreak(logs, [h], {}, today);
    expect(result.current).toBe(12);
    expect(result.lastQualifyingDate).toBe(today);
  });

  it('breaks on a missed day inside the back-walk', () => {
    const h = makeHabit({ createdAt: '2026-01-01T00:00:00.000Z' });
    const days = lastNDays(today, 7);
    const logs: Record<string, Record<string, HabitLog>> = {};
    for (const d of days) {
      logs[d] = { h1: makeLog('h1', d) };
    }
    // Punch a hole 3 days back. The current run should now be only the
    // last 3 days (today, yesterday, day-before-yesterday).
    const holeDay = days[days.length - 4];
    delete logs[holeDay];
    const result = recomputeOverallStreak(logs, [h], {}, today);
    expect(result.current).toBe(3);
  });

  it('longest reflects the best historical run, even when current is shorter', () => {
    const h = makeHabit({ createdAt: '2025-01-01T00:00:00.000Z' });
    const logs: Record<string, Record<string, HabitLog>> = {};

    // Build a 7-day old run far in the past, then a gap, then 3 recent days.
    const oldRunEnd = '2026-04-01';
    const oldDays = lastNDays(oldRunEnd, 7);
    for (const d of oldDays) {
      logs[d] = { h1: makeLog('h1', d) };
    }
    const recentDays = lastNDays(today, 3);
    for (const d of recentDays) {
      logs[d] = { h1: makeLog('h1', d) };
    }

    const result = recomputeOverallStreak(logs, [h], {}, today);
    expect(result.current).toBe(3);
    expect(result.longest).toBe(7);
    expect(result.lastQualifyingDate).toBe(today);
  });

  it('longest >= current always (the current run is included in the sweep)', () => {
    const h = makeHabit({ createdAt: '2025-01-01T00:00:00.000Z' });
    const days = lastNDays(today, 20);
    const logs: Record<string, Record<string, HabitLog>> = {};
    for (const d of days) {
      logs[d] = { h1: makeLog('h1', d) };
    }
    const result = recomputeOverallStreak(logs, [h], {}, today);
    expect(result.longest).toBeGreaterThanOrEqual(result.current);
    expect(result.current).toBe(20);
    expect(result.longest).toBe(20);
  });

  it('ignores future-dated logs in the chronological sweep', () => {
    const h = makeHabit({ createdAt: '2025-01-01T00:00:00.000Z' });
    const logs: Record<string, Record<string, HabitLog>> = {
      [today]: { h1: makeLog('h1', today) },
      '2099-01-01': { h1: makeLog('h1', '2099-01-01') },
    };
    const result = recomputeOverallStreak(logs, [h], {}, today);
    // The future date shouldn't extend longest beyond what today's run is.
    expect(result.current).toBe(1);
    expect(result.longest).toBe(1);
  });

  it('handles the critical-habit transition: a non-critical-completed day becomes invalid when a critical was missed that day', () => {
    // A user with a critical habit who completes a non-critical one but
    // misses the critical → day does NOT qualify, chain breaks.
    const critical = makeHabit({
      id: 'h1',
      isCritical: true,
      createdAt: '2025-01-01T00:00:00.000Z',
    });
    const optional = makeHabit({
      id: 'h2',
      isCritical: false,
      createdAt: '2025-01-01T00:00:00.000Z',
    });
    const days = lastNDays(today, 5);
    const logs: Record<string, Record<string, HabitLog>> = {};
    // Every day: complete the critical → all 5 days qualify
    for (const d of days) {
      logs[d] = {
        h1: makeLog('h1', d),
        h2: makeLog('h2', d),
      };
    }
    // Now punch a hole in critical for the middle day, but keep optional.
    const holeDay = days[2];
    logs[holeDay] = { h2: makeLog('h2', holeDay) };

    const result = recomputeOverallStreak(logs, [critical, optional], {}, today);
    // Only the most-recent 2 days qualify (today + yesterday).
    expect(result.current).toBe(2);
  });

  it('migration-style: handles a long history without critical habits', () => {
    // Simulates a pre-existing user whose log history pre-dates the
    // overall-streak migration. No critical flags set → fallback rule
    // applies everywhere.
    const h = makeHabit({ createdAt: '2024-06-01T00:00:00.000Z' });
    const days = lastNDays(today, 100);
    const logs: Record<string, Record<string, HabitLog>> = {};
    for (const d of days) {
      logs[d] = { h1: makeLog('h1', d) };
    }
    const result = recomputeOverallStreak(logs, [h], {}, today);
    expect(result.current).toBe(100);
    expect(result.longest).toBe(100);
  });
});
