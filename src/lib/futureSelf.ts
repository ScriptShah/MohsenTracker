import { differenceInCalendarDays, parseISO, startOfYear } from 'date-fns';
import type { Habit, HabitLog } from '@/domain/types';
import { dateKey } from './dates';
import { isLogSuccessful } from './streaks';

/** Day 1 on the start day, Day 2 the next day, etc. */
export function daysSinceStart(profileCreatedAt: string): number {
  const a = parseISO(profileCreatedAt);
  return Math.max(1, differenceInCalendarDays(new Date(), a) + 1);
}

/**
 * Per-category consistency over the last 30 days.
 *
 * possible = sum over (day, habit) pairs where the habit existed on that day
 * achieved = sum of successful logs for the same set
 *
 * Habits created mid-window are not penalised for the days before they existed.
 */
export function categoryConsistency30Day(
  habits: Habit[],
  logsByDate: Record<string, Record<string, HabitLog>>,
  categoryId: string,
  windowDays = 30,
): number {
  const catHabits = habits.filter((h) => h.categoryId === categoryId);
  if (catHabits.length === 0) return 0;

  const today = new Date();
  let possible = 0;
  let achieved = 0;

  for (let i = 0; i < windowDays; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    const dayLogs = logsByDate[key] ?? {};

    for (const h of catHabits) {
      const createdKey = dateKey(parseISO(h.createdAt));
      if (key < createdKey) continue;
      possible += 1;
      if (isLogSuccessful(h, dayLogs[h.id])) achieved += 1;
    }
  }

  if (possible === 0) return 0;
  return achieved / possible;
}

/**
 * Daily-rotating index for the compound-effect quote of the day.
 * Same value all day, advances at midnight, deterministic from date.
 */
export function dailyQuoteIndex(quoteCount: number): number {
  if (quoteCount <= 0) return 0;
  const days = differenceInCalendarDays(new Date(), startOfYear(new Date()));
  return ((days % quoteCount) + quoteCount) % quoteCount;
}

/** Indices of futureSelf.quotes.* that reference Islamic practices
 *  (q3 Quran, q4 Tahajjud, q5 Sadaqah). Filtered out for users who
 *  didn't pick the Islamic category, so the rotating compound-quote
 *  card on /future-self stays on-context for everyone. */
const ISLAMIC_QUOTE_INDICES: ReadonlySet<number> = new Set([3, 4, 5]);
const TOTAL_QUOTES = 7;

/** Today's quote index, optionally filtered to non-Islamic indices. */
export function dailyCompoundQuoteIdx(islamicActive: boolean): number {
  if (islamicActive) return dailyQuoteIndex(TOTAL_QUOTES);
  const allowed: number[] = [];
  for (let i = 0; i < TOTAL_QUOTES; i++) {
    if (!ISLAMIC_QUOTE_INDICES.has(i)) allowed.push(i);
  }
  return allowed[dailyQuoteIndex(allowed.length)] ?? 0;
}
