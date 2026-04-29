import type { Habit, HabitLog, Streak } from '@/domain/types';
import { previousDayKey, todayKey } from './dates';

/** Was this log a "successful" day for the habit? */
export function isLogSuccessful(habit: Habit, log: HabitLog | undefined): boolean {
  if (!log) return false;
  if (habit.type === 'good') {
    if (habit.target === undefined) return log.completed;
    return log.value >= habit.target;
  }
  // Bad habit: stay at or below the limit.
  const limit = habit.limit ?? 0;
  return log.value <= limit && log.completed;
}

/** Recompute streak by walking backwards from today. */
export function recomputeStreak(
  habit: Habit,
  logsByDate: Record<string, HabitLog>,
  prevLongest = 0,
): Streak {
  const today = todayKey();
  let cursor = today;
  let current = 0;
  let lastCompleted: string | undefined;

  // Today might not be done yet — that's okay; streak starts from yesterday in that case.
  const todayLog = logsByDate[today];
  if (isLogSuccessful(habit, todayLog)) {
    current = 1;
    lastCompleted = today;
    cursor = previousDayKey(today);
  } else {
    cursor = previousDayKey(today);
  }

  while (true) {
    const log = logsByDate[cursor];
    if (!isLogSuccessful(habit, log)) break;
    current += 1;
    if (!lastCompleted) lastCompleted = cursor;
    cursor = previousDayKey(cursor);
  }

  return {
    habitId: habit.id,
    current,
    longest: Math.max(prevLongest, current),
    lastCompleted,
  };
}
