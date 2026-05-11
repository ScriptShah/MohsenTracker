import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { DailySummary } from '@/domain/types';

/** Three-strike lives system, Mario-style:
 *  - Each past day with completion < 50% adds a strike (loses a life), up to 3.
 *  - Each run of THREE consecutive past days with completion >= 50% removes
 *    a strike (recharges a life). Recovery streak resets on any bad day.
 *  - Today is excluded — the user can still rescue it.
 *  - Days where the user hadn't started (no summary, or totalHabits === 0)
 *    are skipped entirely; they neither strike nor count toward recovery.
 *  - If `lastRestartAt` is set, only days after it are counted — the user
 *    declared a fresh start via /restart, so prior days don't carry over.
 *  - Result is clamped to [0, 3]. */
export function computeStrikes(
  summaries: Record<string, DailySummary>,
  today: string,
  lastRestartAt?: string,
): number {
  const cutoff = lastRestartAt
    ? lastRestartAt.slice(0, 10)
    : undefined;
  // Walk past days chronologically. Sorting all keys keeps the implementation
  // simple — typical usage has a few hundred entries max.
  const days = Object.keys(summaries)
    .filter((d) => d < today)
    .filter((d) => !cutoff || d > cutoff)
    .sort();

  let strikes = 0;
  let recoveryStreak = 0;
  for (const d of days) {
    const s = summaries[d];
    if (!s || s.totalHabits === 0) continue;
    if (s.completionRate < 0.5) {
      strikes = Math.min(3, strikes + 1);
      recoveryStreak = 0;
    } else {
      recoveryStreak += 1;
      if (recoveryStreak >= 3) {
        strikes = Math.max(0, strikes - 1);
        recoveryStreak = 0;
      }
    }
  }
  return strikes;
}

/** Whether to surface the "restart smaller" offer. Three strikes is the
 *  trigger — but we honour a 7-day cooldown after the user most recently
 *  went through the flow, so committing to a leaner list isn't immediately
 *  re-prompted. */
export function shouldOfferRestart({
  strikes,
  lastRestartAt,
  today,
  threshold = 3,
  cooldownDays = 7,
}: {
  strikes: number;
  lastRestartAt?: string;
  today: string;
  threshold?: number;
  cooldownDays?: number;
}): boolean {
  if (strikes < threshold) return false;
  if (!lastRestartAt) return true;
  const daysSince = differenceInCalendarDays(parseISO(today), parseISO(lastRestartAt));
  return daysSince >= cooldownDays;
}
