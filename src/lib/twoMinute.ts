/** Spec §23 — The 2-Minute Rule.
 *
 *  Habits created from a preset at the smaller "2-minute starter" size carry
 *  `isTwoMinuteVersion: true`. Once their per-habit streak reaches 30 days,
 *  the app surfaces a one-time prompt to level up to the full preset target.
 *  The user can dismiss with "stay at this size", which sets
 *  `levelUpPromptDismissedAt` and re-mutes the prompt for ~30 days.
 */

import type { Habit, Streak } from '@/domain/types';
import { presetHabits, type PresetHabit } from '@/domain/seed';

/** Days a 2-minute habit must hold its current size before we suggest scaling
 *  up. Used both for the streak threshold and the re-cooldown after dismiss. */
export const LEVEL_UP_THRESHOLD_DAYS = 30;

function daysBetween(fromISO: string, nowISO: string): number {
  const a = new Date(fromISO).getTime();
  const b = new Date(nowISO).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Infinity;
  return Math.floor((b - a) / 86_400_000);
}

/** Look up the preset definition for a habit, if any. Returns undefined for
 *  custom habits. */
export function presetFor(habit: Habit): PresetHabit | undefined {
  if (!habit.presetKey) return undefined;
  return presetHabits.find((p) => p.presetKey === habit.presetKey);
}

/** True when the habit qualifies for a level-up prompt right now. Gated on:
 *  - habit is flagged as the 2-minute starter,
 *  - the underlying preset has a real `target` to scale up to,
 *  - streak ≥ 30 days,
 *  - either no prior dismiss, or the dismiss was ≥ 30 days ago. */
export function isLevelUpEligible(
  habit: Habit,
  streakCurrent: number,
  nowISO: string,
): boolean {
  if (habit.isTwoMinuteVersion !== true) return false;
  if (streakCurrent < LEVEL_UP_THRESHOLD_DAYS) return false;
  const preset = presetFor(habit);
  if (!preset || preset.target === undefined) return false;
  if (habit.levelUpPromptDismissedAt) {
    if (daysBetween(habit.levelUpPromptDismissedAt, nowISO) < LEVEL_UP_THRESHOLD_DAYS) {
      return false;
    }
  }
  return true;
}

/** Returns habits eligible for level-up, sorted by streak descending so the
 *  home banner surfaces the most-earned one first. */
export function eligibleLevelUps(
  habits: Habit[],
  streaks: Record<string, Streak>,
  nowISO: string,
): Habit[] {
  return habits
    .map((h) => ({ habit: h, current: streaks[h.id]?.current ?? 0 }))
    .filter(({ habit, current }) => isLevelUpEligible(habit, current, nowISO))
    .sort((a, b) => b.current - a.current)
    .map(({ habit }) => habit);
}
