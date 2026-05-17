import { describe, expect, it } from 'vitest';
import { computeStrikes, shouldOfferRestart } from '../restart';
import { previousDayKey } from '../dates';
import type { DailySummary } from '@/domain/types';

/* ── Test-data helpers ───────────────────────────────────────────────── */

function makeSummary(
  date: string,
  completionRate: number,
  totalHabits = 5,
): DailySummary {
  return {
    date,
    totalHabits,
    completedCount: Math.round(completionRate * totalHabits),
    completionRate,
  };
}

/** Build a contiguous run of summaries ending at `endDate` (inclusive),
 *  each at the given completion rate. Returns the summary map keyed by
 *  date (matches the shape `computeStrikes` expects). */
function runOfDays(
  endDate: string,
  count: number,
  rate: number,
): Record<string, DailySummary> {
  const out: Record<string, DailySummary> = {};
  let cur = endDate;
  for (let i = 0; i < count; i++) {
    out[cur] = makeSummary(cur, rate);
    cur = previousDayKey(cur);
  }
  return out;
}

/* ── computeStrikes ──────────────────────────────────────────────────── */

describe('computeStrikes', () => {
  const TODAY = '2026-05-17';
  const habits = [{ createdAt: '2026-01-01T00:00:00.000Z' }];

  it('returns 0 when the user has no habits at all', () => {
    expect(computeStrikes({}, TODAY, undefined, [])).toBe(0);
    expect(computeStrikes({}, TODAY, undefined, undefined)).toBe(0);
  });

  it('returns 0 when habits exist but no past days have been walked', () => {
    // floor === today → loop doesn't enter (cursor > yesterday).
    const futureHabit = [{ createdAt: `${TODAY}T00:00:00.000Z` }];
    expect(computeStrikes({}, TODAY, undefined, futureHabit)).toBe(0);
  });

  it('counts one strike per <50% past day, capped at 3', () => {
    // 5 bad days back-to-back ending yesterday.
    const summaries = runOfDays(previousDayKey(TODAY), 5, 0.2);
    expect(computeStrikes(summaries, TODAY, undefined, habits)).toBe(3);
  });

  it('treats a day with NO summary as a strike (missed-day model)', () => {
    // No summaries at all but the user has had a habit for 5 days.
    const recentHabit = [
      { createdAt: previousDayKey(previousDayKey(previousDayKey(TODAY))) + 'T00:00:00.000Z' },
    ];
    // Three past days with nothing → 3 strikes.
    expect(computeStrikes({}, TODAY, undefined, recentHabit)).toBe(3);
  });

  it('treats a summary with totalHabits=0 as a strike', () => {
    const dayBack = previousDayKey(TODAY);
    const summaries: Record<string, DailySummary> = {
      [dayBack]: {
        date: dayBack,
        totalHabits: 0,
        completedCount: 0,
        completionRate: 1, // even high rate doesn't save it
      },
    };
    const recent = [{ createdAt: `${dayBack}T00:00:00.000Z` }];
    expect(computeStrikes(summaries, TODAY, undefined, recent)).toBe(1);
  });

  it('excludes today from the walk — partial today does not strike', () => {
    const todayBad = { [TODAY]: makeSummary(TODAY, 0.1) };
    const recent = [{ createdAt: `${TODAY}T00:00:00.000Z` }];
    // Today is the only entry, but today is excluded → 0 strikes.
    expect(computeStrikes(todayBad, TODAY, undefined, recent)).toBe(0);
  });

  it('removes a strike after 3 consecutive >=50% recovery days', () => {
    // Layout (oldest → newest, ending yesterday): bad, bad, bad, good, good, good
    // Strikes go: 1, 2, 3 (capped), then recovery streak reaches 3 and one strike comes off → 2.
    const days = [
      previousDayKey(previousDayKey(previousDayKey(previousDayKey(previousDayKey(previousDayKey(TODAY)))))),
      previousDayKey(previousDayKey(previousDayKey(previousDayKey(previousDayKey(TODAY))))),
      previousDayKey(previousDayKey(previousDayKey(previousDayKey(TODAY)))),
      previousDayKey(previousDayKey(previousDayKey(TODAY))),
      previousDayKey(previousDayKey(TODAY)),
      previousDayKey(TODAY),
    ];
    const summaries: Record<string, DailySummary> = {
      [days[0]]: makeSummary(days[0], 0.1),
      [days[1]]: makeSummary(days[1], 0.1),
      [days[2]]: makeSummary(days[2], 0.1),
      [days[3]]: makeSummary(days[3], 0.8),
      [days[4]]: makeSummary(days[4], 0.8),
      [days[5]]: makeSummary(days[5], 0.8),
    };
    const startCreated = `${days[0]}T00:00:00.000Z`;
    expect(computeStrikes(summaries, TODAY, undefined, [{ createdAt: startCreated }])).toBe(2);
  });

  it('a single bad day resets the recovery streak', () => {
    // bad, good, good, bad, good, good → strikes go 1 → still 1 → still 1 → 2 → still 2 → still 2.
    // (recovery never hits 3 because the bad day in the middle resets it)
    const days = [
      previousDayKey(previousDayKey(previousDayKey(previousDayKey(previousDayKey(previousDayKey(TODAY)))))),
      previousDayKey(previousDayKey(previousDayKey(previousDayKey(previousDayKey(TODAY))))),
      previousDayKey(previousDayKey(previousDayKey(previousDayKey(TODAY)))),
      previousDayKey(previousDayKey(previousDayKey(TODAY))),
      previousDayKey(previousDayKey(TODAY)),
      previousDayKey(TODAY),
    ];
    const summaries: Record<string, DailySummary> = {
      [days[0]]: makeSummary(days[0], 0.1),
      [days[1]]: makeSummary(days[1], 0.8),
      [days[2]]: makeSummary(days[2], 0.8),
      [days[3]]: makeSummary(days[3], 0.1),
      [days[4]]: makeSummary(days[4], 0.8),
      [days[5]]: makeSummary(days[5], 0.8),
    };
    const startCreated = `${days[0]}T00:00:00.000Z`;
    expect(computeStrikes(summaries, TODAY, undefined, [{ createdAt: startCreated }])).toBe(2);
  });

  it('lastRestartAt sets an exclusive floor — days before it are skipped', () => {
    // 5 bad days, but lastRestartAt is yesterday → only days strictly
    // after yesterday get walked, and there are none (today is excluded).
    const summaries = runOfDays(previousDayKey(TODAY), 5, 0.1);
    const yesterday = previousDayKey(TODAY);
    const result = computeStrikes(
      summaries,
      TODAY,
      `${yesterday}T00:00:00.000Z`,
      habits,
    );
    expect(result).toBe(0);
  });

  it('honours earliestHabit as the floor when no lastRestartAt', () => {
    // Habit created 3 days ago, 10 days of (mostly empty) summaries.
    // Only the past 3 days (excluding today) get walked.
    const threeAgo = previousDayKey(previousDayKey(previousDayKey(TODAY)));
    const recent = [{ createdAt: `${threeAgo}T00:00:00.000Z` }];
    // Three bad days walked → 3 strikes (no summaries = missed = strike).
    expect(computeStrikes({}, TODAY, undefined, recent)).toBe(3);
  });

  it('clamps strikes to 3 even with many bad days', () => {
    const summaries = runOfDays(previousDayKey(TODAY), 30, 0.0);
    expect(computeStrikes(summaries, TODAY, undefined, habits)).toBe(3);
  });

  it('clamps recovery (strikes don\'t go negative)', () => {
    // All-good history → strikes stays at 0; recovery wouldn't make it
    // -1. (Important: the user shouldn't accumulate "extra lives".)
    const summaries = runOfDays(previousDayKey(TODAY), 30, 0.9);
    expect(computeStrikes(summaries, TODAY, undefined, habits)).toBe(0);
  });

  it('boundary: exactly 50% counts as a good day', () => {
    // Rate < 0.5 strikes; rate >= 0.5 contributes to recovery. With a
    // floor scoped to exactly the 3-day run (so missing-day strikes
    // can't pollute the count) and the user hitting 0.5 each day, the
    // recovery streak hits 3 → 0 strikes overall.
    const dayMinus2 = previousDayKey(previousDayKey(previousDayKey(TODAY)));
    const summaries = runOfDays(previousDayKey(TODAY), 3, 0.5);
    const recentHabit = [{ createdAt: `${dayMinus2}T00:00:00.000Z` }];
    expect(computeStrikes(summaries, TODAY, undefined, recentHabit)).toBe(0);
  });
});

/* ── shouldOfferRestart ──────────────────────────────────────────────── */

describe('shouldOfferRestart', () => {
  const TODAY = '2026-05-17';

  it('returns false when strikes is below threshold', () => {
    expect(
      shouldOfferRestart({ strikes: 2, lastRestartAt: undefined, today: TODAY }),
    ).toBe(false);
  });

  it('returns true at threshold with no prior restart', () => {
    expect(
      shouldOfferRestart({ strikes: 3, lastRestartAt: undefined, today: TODAY }),
    ).toBe(true);
  });

  it('suppresses the offer during the 7-day cooldown', () => {
    const threeDaysAgo = previousDayKey(previousDayKey(previousDayKey(TODAY)));
    expect(
      shouldOfferRestart({
        strikes: 3,
        lastRestartAt: `${threeDaysAgo}T00:00:00.000Z`,
        today: TODAY,
      }),
    ).toBe(false);
  });

  it('re-allows the offer once the cooldown has passed', () => {
    // 8 days ago → past the 7-day cooldown.
    let day = TODAY;
    for (let i = 0; i < 8; i++) day = previousDayKey(day);
    expect(
      shouldOfferRestart({
        strikes: 3,
        lastRestartAt: `${day}T00:00:00.000Z`,
        today: TODAY,
      }),
    ).toBe(true);
  });

  it('respects custom threshold + cooldown', () => {
    const yesterday = previousDayKey(TODAY);
    // threshold lowered to 2, cooldown lowered to 1 day → yesterday's
    // restart is exactly 1 day ago, just at the boundary → allowed.
    expect(
      shouldOfferRestart({
        strikes: 2,
        lastRestartAt: `${yesterday}T00:00:00.000Z`,
        today: TODAY,
        threshold: 2,
        cooldownDays: 1,
      }),
    ).toBe(true);
  });
});
