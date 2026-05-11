'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from './Button';
import { StreakFire } from './StreakFire';
import { useAppStore } from '@/lib/store';
import {
  getFireTrack,
  getTierName,
  isDiamond,
} from '@/lib/streakFire';

/** Surfaces the overall-streak tier celebration when the user crosses into a
 *  tier they haven't seen yet. One streak, one modal — no queue. Reads from
 *  `profile.overallStreak.pendingCelebrationTier`; dismissal folds it into
 *  `celebratedTiers` via `dismissOverallTierCelebration`. */
export function StreakTierCelebration() {
  const t = useTranslations();
  const habits = useAppStore((s) => s.habits);
  const profile = useAppStore((s) => s.profile);
  const allCategories = useAppStore((s) => s.categories);
  const dismissOverallTierCelebration = useAppStore(
    (s) => s.dismissOverallTierCelebration,
  );

  const pendingTier = profile?.overallStreak?.pendingCelebrationTier;

  // Local mount flag for the entrance transition. Resets whenever a new
  // tier is queued (rare — once per tier crossing per user lifetime).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!pendingTier) {
      setMounted(false);
      return;
    }
    const id = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, [pendingTier]);

  // Escape to dismiss.
  useEffect(() => {
    if (!pendingTier) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissOverallTierCelebration();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingTier, dismissOverallTierCelebration]);

  const islamicCategoryId = useMemo(
    () => allCategories.find((c) => c.key === 'islamic')?.id,
    [allCategories],
  );
  const track = useMemo(
    () => getFireTrack(profile, habits, islamicCategoryId),
    [profile, habits, islamicCategoryId],
  );

  if (!pendingTier) return null;

  const tierName = getTierName(pendingTier);
  const diamond = isDiamond(pendingTier);
  const sentence = t(`streakFire.tiers.${tierName}.${track}` as any);
  const diamondExtra = diamond
    ? t(`streakFire.diamondExtra.${track}` as any)
    : null;

  return (
    <div
      className={`fixed inset-0 z-40 flex items-end justify-center bg-ink-900/55 backdrop-blur-sm transition-opacity duration-300 sm:items-center ${
        mounted ? 'opacity-100' : 'opacity-0'
      }`}
      role="dialog"
      aria-modal="true"
      onClick={() => dismissOverallTierCelebration()}
    >
      <div
        className={`w-full max-w-md space-y-5 rounded-t-3xl bg-white p-7 text-center shadow-2xl transition-transform duration-300 sm:rounded-3xl ${
          mounted ? 'translate-y-0' : 'translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center">
          <StreakFire tier={pendingTier} size="xl" animated />
        </div>
        <div className="space-y-1">
          <h2 className="text-3xl font-semibold text-ink-900">
            {t(`streakFire.tierNames.${tierName}` as any)}
          </h2>
        </div>
        <p className="text-base leading-relaxed text-ink-800">{sentence}</p>
        {diamondExtra && (
          <p className="text-sm leading-relaxed text-leaf-700">{diamondExtra}</p>
        )}
        <div className="flex justify-center pt-1">
          <Button
            type="button"
            onClick={() => dismissOverallTierCelebration()}
          >
            {t('futureSelf.continue')}
          </Button>
        </div>
      </div>
    </div>
  );
}
