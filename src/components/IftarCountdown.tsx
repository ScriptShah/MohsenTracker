'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useNumberFormatter } from '@/lib/format';

/**
 * Live countdown to the user-set Iftar time. Resets daily.
 * Below the timer, shows an honest disclosure that the time is user-set
 * until the prayer-times API ships.
 */
export function IftarCountdown({ iftarTime }: { iftarTime: string }) {
  const t = useTranslations();
  const fmt = useNumberFormatter();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const target = todayAtTime(now, iftarTime);
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) {
    return (
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-leaf-700">
          {t('ramadan.iftar.passedTitle')}
        </p>
        <p className="text-lg font-medium text-ink-800">
          {t('ramadan.iftar.passedBody')}
        </p>
      </div>
    );
  }

  const totalSec = Math.floor(diffMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-leaf-700">
        {t('ramadan.iftar.title', { time: iftarTime })}
      </p>
      <p className="numeral pt-1 font-mono text-3xl font-semibold tabular-nums text-ink-900">
        {fmt(h)}:{pad(m)}:{pad(s)}
      </p>
      <p className="pt-1 text-[11px] text-ink-500">
        {t('ramadan.iftar.note')}
      </p>
    </div>
  );
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function todayAtTime(reference: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map((s) => parseInt(s, 10));
  const d = new Date(reference);
  d.setHours(Number.isFinite(h) ? h : 18, Number.isFinite(m) ? m : 30, 0, 0);
  return d;
}
