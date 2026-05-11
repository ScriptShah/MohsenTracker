import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { DailySummary } from '@/domain/types';
import { previousDayKey } from './dates';

/** How many days in the LAST `windowDays` were below 50% completion. Today
 *  is excluded — the user can still rescue today, and partial-day rates
 *  shouldn't count as a strike. Days with no summary (user wasn't logging
 *  yet, no habits, etc.) are skipped, not counted as strikes. */
export function computeStrikes(
  summaries: Record<string, DailySummary>,
  today: string,
  windowDays = 14,
): number {
  let strikes = 0;
  let cursor = previousDayKey(today);
  for (let i = 0; i < windowDays; i++) {
    const summary = summaries[cursor];
    if (summary && summary.totalHabits > 0 && summary.completionRate < 0.5) {
      strikes += 1;
    }
    cursor = previousDayKey(cursor);
  }
  return strikes;
}

/** Whether to surface the "restart smaller" offer. Three strikes in the last
 *  14 days is the trigger — but we honour a 7-day cooldown after the user
 *  most recently went through the flow, so committing to a leaner list isn't
 *  immediately re-prompted. */
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
