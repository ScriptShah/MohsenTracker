import type { Habit, Profile } from '@/domain/types';

/** Day thresholds at which each tier begins. Index 0 is unused (tier 1 starts
 *  at day 1, so streakDays < TIER_THRESHOLDS[1] (=7) is tier 1). */
export const TIER_THRESHOLDS = [0, 7, 21, 56, 112, 224, 365] as const;

export const TIER_NAMES = [
  'spark',
  'flame',
  'burn',
  'blaze',
  'inferno',
  'sacred',
  'diamond',
] as const;

export type TierName = (typeof TIER_NAMES)[number];
export type FireTrack = 'islamic' | 'universal';

/** Returns the tier 1-7 for a given streak length. Even a 0-day streak shows
 *  the Spark tier so a freshly-created habit isn't blank. */
export function getFireTier(streakDays: number): number {
  if (streakDays >= 365) return 7;
  if (streakDays >= 224) return 6;
  if (streakDays >= 112) return 5;
  if (streakDays >= 56) return 4;
  if (streakDays >= 21) return 3;
  if (streakDays >= 7) return 2;
  return 1;
}

export function getTierName(tier: number): TierName {
  const clamped = Math.min(7, Math.max(1, tier));
  return TIER_NAMES[clamped - 1];
}

export function getIconPath(tier: number): string {
  return `/icons/streak/${getTierName(tier)}.png`;
}

export function isDiamond(tier: number): boolean {
  return tier >= 7;
}

/** Days remaining until the next tier (and the name of that tier). Diamond
 *  is permanent — once reached, returns `null`. */
export function getDaysToNextTier(streakDays: number): {
  days: number;
  nextTierName: TierName | null;
} {
  const tier = getFireTier(streakDays);
  if (tier >= 7) return { days: 0, nextTierName: null };
  const nextThreshold = TIER_THRESHOLDS[tier]; // tier=1 → threshold[1]=7, etc.
  return {
    days: Math.max(0, nextThreshold - streakDays),
    nextTierName: TIER_NAMES[tier], // tier (1-indexed) → TIER_NAMES[tier] is the NEXT name
  };
}

/** Decide which sentence track applies to the user's overall fire.
 *  - explicit 'islamic' / 'universal' override the smart routing.
 *  - 'smart' (default) routes to Islamic if the user has at least one
 *    non-archived habit in the Islamic Practices category, else Universal.
 *
 *  Per-habit context is gone — there is only one fire — so the heuristic
 *  is "does this user's life include Islamic practice tracking?" rather
 *  than "which category is this specific habit in?". */
export function getFireTrack(
  profile: Pick<Profile, 'fireSentenceStyle'> | null | undefined,
  habits: Pick<Habit, 'categoryId'>[],
  islamicCategoryId: string | undefined,
): FireTrack {
  const style = profile?.fireSentenceStyle ?? 'smart';
  if (style === 'islamic') return 'islamic';
  if (style === 'universal') return 'universal';
  if (!islamicCategoryId) return 'universal';
  const hasIslamicHabit = habits.some((h) => h.categoryId === islamicCategoryId);
  return hasIslamicHabit ? 'islamic' : 'universal';
}

/** The highest tier in `celebratedTiers` (or 0 if none). Used to detect when
 *  a freshly-recomputed streak has crossed into a new tier the user hasn't
 *  seen the celebration for yet. */
export function highestCelebratedTier(celebrated: number[] | undefined): number {
  if (!celebrated || celebrated.length === 0) return 0;
  return Math.max(...celebrated);
}
