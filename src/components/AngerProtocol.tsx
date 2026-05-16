'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from './Button';

/** Spec §22: the Prophetic ﷺ anger-management protocol as a full-screen
 *  overlay the user opens at the moment of anger. Five steps, in order:
 *    1. Ta'awwudh — seek refuge from Satan (Bukhari 6048)
 *    2. Change posture — sit if standing, lie down if sitting (Abu Dawud 4782)
 *    3. Wudu — anger is from fire, water cools fire (Abu Dawud 4784)
 *    4. 90 seconds of silence and slow breathing (silence: Musnad Ahmad;
 *       90s is the modern neuroscience anchor for amygdala arousal)
 *    5. Closing dua — "O Allah, I seek refuge in You from anger and laziness"
 *       (Abu Dawud 1555)
 *
 *  No checkboxes — at the moment of anger, the user shouldn't have to manage
 *  state. The 90-second timer is the only interactive piece.
 */
export function AngerProtocol({ onClose }: { onClose: () => void }) {
  const t = useTranslations();

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
          <Step
            n={1}
            title={t('angerProtocol.steps.taawwudh.title')}
            body={t('angerProtocol.steps.taawwudh.body')}
            arabic={t('angerProtocol.steps.taawwudh.arabic')}
            translation={t('angerProtocol.steps.taawwudh.translation')}
            source={t('angerProtocol.steps.taawwudh.source')}
          />
          <Step
            n={2}
            title={t('angerProtocol.steps.posture.title')}
            body={t('angerProtocol.steps.posture.body')}
            source={t('angerProtocol.steps.posture.source')}
          />
          <Step
            n={3}
            title={t('angerProtocol.steps.wudu.title')}
            body={t('angerProtocol.steps.wudu.body')}
            source={t('angerProtocol.steps.wudu.source')}
          />
          <BreathStep />
          <Step
            n={5}
            title={t('angerProtocol.steps.dua.title')}
            body={t('angerProtocol.steps.dua.body')}
            arabic={t('angerProtocol.steps.dua.arabic')}
            translation={t('angerProtocol.steps.dua.translation')}
            source={t('angerProtocol.steps.dua.source')}
          />
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

/** Step 4 — the 90-second breathing timer. Modern neuroscience puts the
 *  amygdala's adrenaline surge at ~90 seconds; the Prophetic ﷺ "be silent"
 *  injunction (Musnad Ahmad) lines up with letting that wave pass.
 */
function BreathStep() {
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
          4
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <h3 className="text-base font-semibold text-ink-900">
            {t('angerProtocol.steps.breath.title')}
          </h3>
          <p className="text-sm leading-relaxed text-ink-700">
            {t('angerProtocol.steps.breath.body')}
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
                  {t('angerProtocol.steps.breath.start')}
                </Button>
              )}
              {isRunning && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={stop}
                  className="w-full"
                >
                  {t('angerProtocol.steps.breath.stop')}
                </Button>
              )}
              {isDone && (
                <>
                  <p className="text-sm font-medium text-leaf-700">
                    {t('angerProtocol.steps.breath.done')}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={start}
                    className="w-full"
                  >
                    {t('angerProtocol.steps.breath.restart')}
                  </Button>
                </>
              )}
            </div>
          </div>
          <p className="text-[11px] uppercase tracking-wide text-ink-400">
            {t('angerProtocol.steps.breath.source')}
          </p>
        </div>
      </div>
    </li>
  );
}
