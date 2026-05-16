import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { DailySummary } from '@/domain/types';
import { nextDayKey, previousDayKey } from '@/lib/dates';

/** Three-strike lives system, Mario-style:
 *  - Each past day with completion < 50% adds a strike (loses a life), up to 3.
 *  - Each run of THREE consecutive past days with completion >= 50% removes
 *    a strike (recharges a life). Recovery streak resets on any bad day.
 *  - Today is excluded — the user can still rescue it.
 *  - The walk starts on the earliest habit `createdAt` (or `lastRestartAt`,
 *    whichever is later). Days before that are skipped — user hadn't started.
 *  - A day with NO summary, or a summary with `totalHabits === 0`, counts as
 *    a missed day (strike). The earlier implementation skipped these, which
 *    was wrong for a "Mario lives" model — silently skipping the app for two
 *    days has to actually cost lives, otherwise nobody ever loses one without
 *    explicitly opening the app and undertracking.
 *  - Result is clamped to [0, 3]. */
export function computeStrikes(
  summaries: Record<string, DailySummary>,
  today: string,
  lastRestartAt?: string,
  habits?: { createdAt: string }[],
): number {
  // Walk floor: max(earliest habit creation, lastRestartAt).
  // No habits → nothing to be accountable for, so no strikes.
  if (!habits || habits.length === 0) return 0;
  const earliestHabit = habits
    .map((h) => h.createdAt.slice(0, 10))
    .sort()[0];
  const restartFloor = lastRestartAt?.slice(0, 10);
  const floor =
    restartFloor && restartFloor > earliestHabit ? restartFloor : earliestHabit;

  // If lastRestartAt is set, the floor is exclusive (start after it).
  // Otherwise the floor is the earliest habit day — include it.
  const yesterday = previousDayKey(today);
  if (floor >= today) return 0;
  let cursor = restartFloor && restartFloor === floor ? nextDayKey(floor) : floor;

  let strikes = 0;
  let recoveryStreak = 0;
  while (cursor <= yesterday) {
    const s = summaries[cursor];
    const hasWork = s && s.totalHabits > 0;
    const rate = hasWork ? s!.completionRate : 0;
    if (rate < 0.5) {
      strikes = Math.min(3, strikes + 1);
      recoveryStreak = 0;
    } else {
      recoveryStreak += 1;
      if (recoveryStreak >= 3) {
        strikes = Math.max(0, strikes - 1);
        recoveryStreak = 0;
      }
    }
    cursor = nextDayKey(cursor);
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
