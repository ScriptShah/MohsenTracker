import { differenceInCalendarDays, parseISO, startOfYear } from 'date-fns';
import type { DopamineReset, ResetStage, ResetTier } from '@/domain/types';

export const TIERS: ResetTier[] = [
  'weekly24h',
  'monthly7d',
  'quarterly30d',
  'deep90d',
];

export function targetDaysFor(tier: ResetTier): number {
  return tier === 'weekly24h'
    ? 1
    : tier === 'monthly7d'
    ? 7
    : tier === 'quarterly30d'
    ? 30
    : 90;
}

/** 1-indexed: day 1 on the start day, capped at targetDays. */
export function currentDay(reset: DopamineReset): number {
  const days = differenceInCalendarDays(new Date(), parseISO(reset.currentStreakStartedAt)) + 1;
  return Math.max(1, Math.min(reset.targetDays, days));
}

/** Has the user crossed the target (called from UI to auto-complete). */
export function reachedTarget(reset: DopamineReset): boolean {
  const days = differenceInCalendarDays(new Date(), parseISO(reset.currentStreakStartedAt)) + 1;
  return days >= reset.targetDays;
}

/**
 * Map progress proportion → withdrawal stage (spec §19.3).
 * Same six stages for every tier; thresholds are proportional so a 7-day
 * reset compresses into the same arc as a 90-day one.
 */
const STAGE_THRESHOLDS: Array<{ pct: number; stage: ResetStage }> = [
  { pct: 0.15, stage: 'cravings' },
  { pct: 0.3, stage: 'adjustment' },
  { pct: 0.5, stage: 'clarity' },
  { pct: 0.75, stage: 'restoration' },
  { pct: 0.9, stage: 'integration' },
  { pct: Infinity, stage: 'mastery' },
];

export function stageFor(reset: DopamineReset): ResetStage {
  const day = currentDay(reset);
  const pct = day / reset.targetDays;
  for (const t of STAGE_THRESHOLDS) {
    if (pct < t.pct) return t.stage;
  }
  return 'mastery';
}

/* ── Replacement activity library (spec §19.5) ───────────────────────── */

export type ReplacementBucket = 'body' | 'mind' | 'soul' | 'connection';

export const REPLACEMENT_LIBRARY: Record<ReplacementBucket, string[]> = {
  body: [
    'walk',
    'pushups',
    'cookMeal',
    'gardening',
    'cleanRoom',
    'shower',
    'stretching',
  ],
  mind: [
    'readBook',
    'journal',
    'sketchOrDraw',
    'puzzle',
    'learnSomething',
    'listenLecture',
  ],
  soul: [
    'pray',
    'readQuran',
    'dhikr',
    'gratitudeList',
    'reflectiveSilence',
    'duaForOthers',
  ],
  connection: [
    'callFamily',
    'visitFriend',
    'writeLetter',
    'helpNeighbour',
    'compliment',
    'familyMeal',
  ],
};

/** Picks one suggestion per bucket, deterministic per day-of-year. */
export function todayReplacements(now = new Date()): Record<ReplacementBucket, string> {
  const day = differenceInCalendarDays(now, startOfYear(now));
  const out: Partial<Record<ReplacementBucket, string>> = {};
  for (const bucket of Object.keys(REPLACEMENT_LIBRARY) as ReplacementBucket[]) {
    const list = REPLACEMENT_LIBRARY[bucket];
    out[bucket] = list[((day % list.length) + list.length) % list.length];
  }
  return out as Record<ReplacementBucket, string>;
}
