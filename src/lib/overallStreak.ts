import type { DailySummary, Habit, HabitLog } from '@/domain/types';
import { isLogSuccessful } from './streaks';
import { previousDayKey } from './dates';

/** A day "qualifies" for the overall streak iff:
 *  - The user had at least one critical habit ON that day (Habit.isCritical
 *    === true AND habit.createdAt <= date), AND every such critical habit
 *    has a successful log for that day — OR
 *  - The user had no critical habits on that day, and at least one habit
 *    that existed on that day has a successful log.
 *
 *  Days with zero habits that existed on them do not qualify and break the
 *  chain. `createdAt <= date` is the only "existed on" signal available;
 *  per-habit streak walks already implicitly assume this. */
export function dayQualifies(
  date: string,
  habits: Habit[],
  dayLogs: Record<string, HabitLog>,
): boolean {
  const existingHabits = habits.filter((h) => h.createdAt.slice(0, 10) <= date);
  if (existingHabits.length === 0) return false;
  const criticals = existingHabits.filter((h) => h.isCritical === true);
  if (criticals.length > 0) {
    return criticals.every((h) => isLogSuccessful(h, dayLogs[h.id]));
  }
  // Fallback: any successful habit log counts.
  return existingHabits.some((h) => isLogSuccessful(h, dayLogs[h.id]));
}

export interface OverallStreakSnapshot {
  current: number;
  longest: number;
  lastQualifyingDate: string | null;
}

/** Recomputes the user's overall streak from full history.
 *
 *  - Current: walks backwards from today, mirroring the per-habit
 *    `recomputeStreak` behaviour. If today qualifies, the streak starts at 1
 *    and walks back; if not, it starts from yesterday so a partial today
 *    doesn't break the chain.
 *  - Longest: a single chronological sweep over all dates that have a
 *    summary entry, tracking the maximum run length seen.
 *  - lastQualifyingDate: the most recent date in history that qualified, or
 *    null if none ever did. Used so the migration's first-time compute can
 *    record where the user stood at upgrade time. */
export function recomputeOverallStreak(
  logs: Record<string, Record<string, HabitLog>>,
  habits: Habit[],
  _summaries: Record<string, DailySummary>,
  todayISO: string,
): OverallStreakSnapshot {
  // Walk backwards from today for `current`. Match streaks.ts: if today is
  // already qualifying, count it; otherwise start from yesterday.
  let cursor = todayISO;
  let current = 0;
  let lastQualifyingDate: string | null = null;

  const todayLogs = logs[todayISO] ?? {};
  if (dayQualifies(todayISO, habits, todayLogs)) {
    current = 1;
    lastQualifyingDate = todayISO;
    cursor = previousDayKey(todayISO);
  } else {
    cursor = previousDayKey(todayISO);
  }
  while (true) {
    const dayLogs = logs[cursor] ?? {};
    if (!dayQualifies(cursor, habits, dayLogs)) break;
    current += 1;
    if (!lastQualifyingDate) lastQualifyingDate = cursor;
    cursor = previousDayKey(cursor);
  }

  // Single sweep over all dated logs to find the longest historical run.
  const datedKeys = Object.keys(logs).sort();
  let runLen = 0;
  let prevDate: string | null = null;
  let longest = 0;
  for (const date of datedKeys) {
    if (date > todayISO) break; // future dates shouldn't count
    const dayLogs = logs[date] ?? {};
    if (!dayQualifies(date, habits, dayLogs)) {
      runLen = 0;
      prevDate = date;
      continue;
    }
    if (prevDate && previousDayKey(date) !== prevDate && runLen > 0) {
      // Gap day without a qualifying entry — chain broken.
      runLen = 1;
    } else {
      runLen += 1;
    }
    if (runLen > longest) longest = runLen;
    prevDate = date;
  }
  // The "current" run is automatically included in the sweep above, so
  // longest >= current always.
  return { current, longest: Math.max(longest, current), lastQualifyingDate };
}

/** Status of TODAY relative to the streak rule. Surfaces the gap
 *  between the home-completion-ring percentage (which uses done/total)
 *  and the streak qualification rule (which requires every critical
 *  habit done, OR — when none exist — at least one habit done). The
 *  /future-self page uses this to render a one-line explainer so users
 *  don't have to wonder why a 56%-complete day didn't bump their
 *  streak.
 *
 *  Variants:
 *    - 'no-habits'         : user has zero habits — nothing to do.
 *    - 'qualified'         : today already counted.
 *    - 'criticals-pending' : has criticals; not all done yet.
 *    - 'any-pending'       : no criticals; no habit done yet today.
 */
export type TodayStreakStatus =
  | { kind: 'no-habits' }
  | { kind: 'qualified' }
  | { kind: 'criticals-pending'; remaining: number; total: number }
  | { kind: 'any-pending' };

export function todayStreakStatus(
  habits: Habit[],
  todayLogs: Record<string, HabitLog>,
  todayISO: string,
): TodayStreakStatus {
  const existing = habits.filter((h) => h.createdAt.slice(0, 10) <= todayISO);
  if (existing.length === 0) return { kind: 'no-habits' };
  const criticals = existing.filter((h) => h.isCritical === true);
  if (criticals.length > 0) {
    const done = criticals.filter((h) =>
      isLogSuccessful(h, todayLogs[h.id]),
    ).length;
    if (done === criticals.length) return { kind: 'qualified' };
    return {
      kind: 'criticals-pending',
      remaining: criticals.length - done,
      total: criticals.length,
    };
  }
  const anyDone = existing.some((h) => isLogSuccessful(h, todayLogs[h.id]));
  return anyDone ? { kind: 'qualified' } : { kind: 'any-pending' };
}
