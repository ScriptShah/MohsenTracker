'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from './Button';
import { useAppStore } from '@/lib/store';
import { getFireTrack, type FireTrack } from '@/lib/streakFire';

/** Spec §22: the anger-management protocol overlay. Two tracks share the
 *  same five-step shape and the same 90-second timer; only the content
 *  differs.
 *
 *  Islamic track — Prophetic ﷺ protocol:
 *    1. Ta'awwudh — Bukhari 6048
 *    2. Change posture — Abu Dawud 4782
 *    3. Wudu — Abu Dawud 4784
 *    4. 90s silence + breathing — "Be silent" (Musnad Ahmad)
 *    5. Closing dua — Abu Dawud 1555
 *
 *  Universal track — secular calming protocol:
 *    1. Name the feeling — affect-labeling research (UCLA)
 *    2. Change posture — embodied cognition
 *    3. Cold water — DBT TIPP skill
 *    4. 90s silence + breathing — Jill Bolte Taylor's 90-second rule
 *    5. Close with a calming line — self-affirmation
 *
 *  Track is decided by `getFireTrack` — the same helper that drives the
 *  streak-fire sentence track. A user who picked "Universal" voice in
 *  Settings gets the universal protocol here; "Islamic" gets the
 *  Prophetic one; "Smart" routes to Islamic iff any habit lives in the
 *  Islamic Practices category.
 */

interface StepDescriptor {
  key: string;
  hasArabic?: boolean;
  isBreath?: boolean;
}

const ISLAMIC_STEPS: StepDescriptor[] = [
  { key: 'taawwudh', hasArabic: true },
  { key: 'posture' },
  { key: 'wudu' },
  { key: 'breath', isBreath: true },
  { key: 'dua', hasArabic: true },
];

const UNIVERSAL_STEPS: StepDescriptor[] = [
  { key: 'name' },
  { key: 'posture' },
  { key: 'water' },
  { key: 'breath', isBreath: true },
  { key: 'close' },
];

export function AngerProtocol({ onClose }: { onClose: () => void }) {
  const t = useTranslations();
  const profile = useAppStore((s) => s.profile);
  const habits = useAppStore((s) => s.habits);
  const islamicCategoryId = useAppStore(
    (s) => s.categories.find((c) => c.key === 'islamic')?.id,
  );
  const track: FireTrack = getFireTrack(profile, habits, islamicCategoryId);
  const steps = track === 'islamic' ? ISLAMIC_STEPS : UNIVERSAL_STEPS;
  const base = `angerProtocol.${track}.steps`;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink-900/50 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="anger-protocol-title"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-screen-sm overflow-y-auto rounded-t-2xl bg-sand-50 p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="anger-protocol-title"
          className="text-xl font-semibold text-ink-900"
        >
          {t('angerProtocol.title')}
        </h2>
        <p className="pt-1 text-sm leading-relaxed text-ink-600">
          {t('angerProtocol.body')}
        </p>

        <ol className="mt-5 space-y-4">
          {steps.map((s, idx) => {
            const n = idx + 1;
            const keyBase = `${base}.${s.key}`;
            if (s.isBreath) {
              return <BreathStep key={s.key} n={n} keyBase={keyBase} />;
            }
            return (
              <Step
                key={s.key}
                n={n}
                title={t(`${keyBase}.title` as any)}
                body={t(`${keyBase}.body` as any)}
                arabic={
                  s.hasArabic ? t(`${keyBase}.arabic` as any) : undefined
                }
                translation={
                  s.hasArabic ? t(`${keyBase}.translation` as any) : undefined
                }
                source={t(`${keyBase}.source` as any)}
              />
            );
          })}
        </ol>

        <div className="mt-6 flex items-center justify-end">
          <Button type="button" onClick={onClose}>
            {t('angerProtocol.close')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  body,
  arabic,
  translation,
  source,
}: {
  n: number;
  title: string;
  body: string;
  arabic?: string;
  translation?: string;
  source: string;
}) {
  return (
    <li className="rounded-2xl border border-sand-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="numeral mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-leaf-100 text-sm font-semibold text-leaf-800"
        >
          {n}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="text-base font-semibold text-ink-900">{title}</h3>
          <p className="text-sm leading-relaxed text-ink-700">{body}</p>
          {arabic && (
            <div className="rounded-xl border-s-2 border-leaf-400 bg-leaf-50 px-3 py-2">
              <p
                dir="rtl"
                lang="ar"
                className="text-base leading-relaxed text-ink-800"
              >
                {arabic}
              </p>
              {translation && (
                <p className="pt-1 text-sm italic text-ink-700">{translation}</p>
              )}
            </div>
          )}
          <p className="text-[11px] uppercase tracking-wide text-ink-400">
            {source}
          </p>
        </div>
      </div>
    </li>
  );
}

/** The 90-second breathing timer. Same UI for both tracks; only the
 *  copy varies (read from the passed key base). The amygdala's adrenaline
 *  surge lasts roughly 90 seconds — outlast it and the wave breaks.
 */
function BreathStep({ n, keyBase }: { n: number; keyBase: string }) {
  const t = useTranslations();
  const TOTAL_SECONDS = 90;
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const start = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSecondsLeft(TOTAL_SECONDS);
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSecondsLeft(null);
  };

  const pct =
    secondsLeft === null ? 0 : (TOTAL_SECONDS - secondsLeft) / TOTAL_SECONDS;
  const isRunning = secondsLeft !== null && secondsLeft > 0;
  const isDone = secondsLeft === 0;

  return (
    <li className="rounded-2xl border border-sand-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="numeral mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-leaf-100 text-sm font-semibold text-leaf-800"
        >
          {n}
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <h3 className="text-base font-semibold text-ink-900">
            {t(`${keyBase}.title` as any)}
          </h3>
          <p className="text-sm leading-relaxed text-ink-700">
            {t(`${keyBase}.body` as any)}
          </p>
          <div className="flex items-center gap-4">
            <div
              className="relative h-20 w-20 shrink-0 rounded-full"
              style={{
                background: `conic-gradient(rgb(13 148 136) ${pct * 360}deg, rgb(245 245 244) ${pct * 360}deg)`,
              }}
              aria-hidden
            >
              <div className="absolute inset-1.5 flex items-center justify-center rounded-full bg-white">
                <span className="numeral text-lg font-semibold text-ink-800">
                  {secondsLeft === null ? TOTAL_SECONDS : secondsLeft}
                </span>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              {!isRunning && !isDone && (
                <Button type="button" onClick={start} className="w-full">
                  {t(`${keyBase}.start` as any)}
                </Button>
              )}
              {isRunning && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={stop}
                  className="w-full"
                >
                  {t(`${keyBase}.stop` as any)}
                </Button>
              )}
              {isDone && (
                <>
                  <p className="text-sm font-medium text-leaf-700">
                    {t(`${keyBase}.done` as any)}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={start}
                    className="w-full"
                  >
                    {t(`${keyBase}.restart` as any)}
                  </Button>
                </>
              )}
            </div>
          </div>
          <p className="text-[11px] uppercase tracking-wide text-ink-400">
            {t(`${keyBase}.source` as any)}
          </p>
        </div>
      </div>
    </li>
  );
}
