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
import type { Habit } from '@/domain/types';

/** Listens for habits with `pendingCelebrationTier` set and shows a focused
 *  modal one habit at a time. On dismiss, the tier is folded into
 *  `celebratedTiers` and the next pending habit (if any) takes the stage. */
export function StreakTierCelebration() {
  const t = useTranslations();
  const habits = useAppStore((s) => s.habits);
  const profile = useAppStore((s) => s.profile);
  const allCategories = useAppStore((s) => s.categories);
  const dismissTierCelebration = useAppStore((s) => s.dismissTierCelebration);

  // We surface the first habit with a pending tier. Once that habit is
  // dismissed the next pending habit (if any) appears on the next render.
  const queue = useMemo(
    () => habits.filter((h) => !!h.pendingCelebrationTier),
    [habits],
  );
  const current: Habit | undefined = queue[0];
  const currentId = current?.id;

  // Local mount flag so the modal can do an entrance transition without
  // flashing. Resets whenever the current habit changes.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!currentId) {
      setMounted(false);
      return;
    }
    const id = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, [currentId]);

  // Escape to dismiss.
  useEffect(() => {
    if (!currentId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissTierCelebration(currentId);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentId, dismissTierCelebration]);

  if (!current) return null;

  const tier = current.pendingCelebrationTier!;
  const tierName = getTierName(tier);
  const diamond = isDiamond(tier);
  const islamicCategoryId = allCategories.find((c) => c.key === 'islamic')?.id;
  const track = getFireTrack(profile, habits, islamicCategoryId);
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
      onClick={() => dismissTierCelebration(current.id)}
    >
      <div
        className={`w-full max-w-md space-y-5 rounded-t-3xl bg-white p-7 text-center shadow-2xl transition-transform duration-300 sm:rounded-3xl ${
          mounted ? 'translate-y-0' : 'translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center">
          <StreakFire tier={tier} size="xl" animated />
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.15em] text-ink-500">
            {current.name}
          </p>
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
            onClick={() => dismissTierCelebration(current.id)}
          >
            {t('futureSelf.continue')}
          </Button>
        </div>
      </div>
    </div>
  );
}
