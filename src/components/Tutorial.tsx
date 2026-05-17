'use client';

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';
import { useAppStore } from '@/lib/store';
import { Button } from './Button';

/** First-run feature tour. Plays once per profile, after splash +
 *  onboarding complete, before the user lands on Home for the first
 *  time. Five slides walking through what the app actually does:
 *  daily checklist, three hearts, future self, workspaces, "make it
 *  yours" wrap-up.
 *
 *  Condition: `profile.onboardingComplete === true` AND
 *  `profile.tutorialCompletedAt` is undefined. Skippable from any
 *  slide. Marking complete stamps the ISO so we don't re-show it.
 *
 *  Why not part of the existing 8-step onboarding flow: onboarding
 *  collects identity (name, vision, why, categories, presets). The
 *  tutorial teaches the UI. Mixing them would make the upfront flow
 *  feel like an 13-step grind; splitting them lets onboarding stay
 *  focused on "who are you becoming" and the tutorial stay focused
 *  on "here's how the app helps."
 */
export function Tutorial() {
  const t = useTranslations();
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);

  // SSR / mid-load gate. Avoids a flash of the overlay before profile
  // hydrates from persisted storage.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [slideIndex, setSlideIndex] = useState(0);

  const slides = useMemo(
    () => [
      {
        key: 'checklist',
        emoji: '✓',
        emojiClass: 'bg-leaf-100 text-leaf-700',
      },
      {
        key: 'hearts',
        emoji: '❤',
        emojiClass: 'bg-red-100 text-red-600',
      },
      {
        key: 'futureSelf',
        emoji: '🔥',
        emojiClass: 'bg-sand-100 text-sand-700',
      },
      {
        key: 'workspaces',
        emoji: '🤝',
        emojiClass: 'bg-leaf-100 text-leaf-700',
      },
      {
        key: 'explore',
        emoji: '✦',
        emojiClass: 'bg-purple-100 text-purple-700',
      },
    ] as const,
    [],
  );

  const finish = () => {
    setProfile({ tutorialCompletedAt: new Date().toISOString() });
  };

  if (!mounted) return null;
  if (!profile) return null;
  if (!profile.onboardingComplete) return null;
  if (profile.tutorialCompletedAt) return null;

  const slide = slides[slideIndex]!;
  const isLast = slideIndex === slides.length - 1;
  const total = slides.length;

  const next = () => {
    if (isLast) {
      finish();
      return;
    }
    setSlideIndex((i) => i + 1);
  };

  const back = () => {
    setSlideIndex((i) => Math.max(0, i - 1));
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-ink-900/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Progress dots */}
        <div className="flex items-center justify-between gap-3 px-6 pt-5">
          <div className="flex items-center gap-1.5" aria-hidden>
            {slides.map((_, i) => (
              <span
                key={i}
                className={clsx(
                  'h-1.5 rounded-full transition-all',
                  i === slideIndex
                    ? 'w-6 bg-leaf-600'
                    : i < slideIndex
                    ? 'w-1.5 bg-leaf-300'
                    : 'w-1.5 bg-ink-200',
                )}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={finish}
            className="text-xs font-medium text-ink-500 underline-offset-4 hover:text-ink-700 hover:underline"
          >
            {t('tutorial.skip')}
          </button>
        </div>

        {/* Slide body */}
        <div className="px-6 pb-2 pt-6 text-center">
          <div
            className={clsx(
              'mx-auto flex h-20 w-20 items-center justify-center rounded-full text-3xl',
              slide.emojiClass,
            )}
            aria-hidden
          >
            {slide.emoji}
          </div>
          <h2
            id="tutorial-title"
            className="mt-4 text-xl font-semibold leading-snug text-ink-900"
          >
            {t(`tutorial.slides.${slide.key}.title` as any)}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">
            {t(`tutorial.slides.${slide.key}.body` as any)}
          </p>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-2 px-6 pb-6 pt-4">
          <button
            type="button"
            onClick={back}
            disabled={slideIndex === 0}
            className={clsx(
              'text-sm font-medium underline-offset-4 transition',
              slideIndex === 0
                ? 'invisible'
                : 'text-ink-500 hover:text-ink-700 hover:underline',
            )}
          >
            {t('tutorial.back')}
          </button>
          <span className="numeral text-[11px] text-ink-400">
            {slideIndex + 1} / {total}
          </span>
          <Button type="button" onClick={next}>
            {isLast ? t('tutorial.start') : t('tutorial.next')}
          </Button>
        </div>
      </div>
    </div>
  );
}
