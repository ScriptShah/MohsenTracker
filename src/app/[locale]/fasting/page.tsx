'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ArrowBack } from '@/components/Chevron';
import { ClientGate } from '@/components/ClientGate';
import { useAppStore } from '@/lib/store';
import { useNumberFormatter } from '@/lib/format';
import { previousDayKey, todayKey } from '@/lib/dates';
import type { FastingDayLog, FastingPart } from '@/domain/types';

const PARTS: FastingPart[] = ['eyes', 'ears', 'hands', 'tongue', 'food'];

export default function FastingPage() {
  return (
    <ClientGate>
      <Fasting />
    </ClientGate>
  );
}

function Fasting() {
  const t = useTranslations();
  const fmt = useNumberFormatter();
  const fasting = useAppStore((s) => s.spiritualFasting);
  const setFastingPart = useAppStore((s) => s.setFastingPart);
  const setFastingNotes = useAppStore((s) => s.setFastingNotes);

  const today = todayKey();
  const todayLog = fasting[today];

  // Build a 7-day strip going back from today so the user can see momentum.
  const last7: { date: string; log?: FastingDayLog }[] = useMemo(() => {
    const out: { date: string; log?: FastingDayLog }[] = [];
    let cursor = today;
    for (let i = 0; i < 7; i++) {
      out.push({ date: cursor, log: fasting[cursor] });
      cursor = previousDayKey(cursor);
    }
    return out.reverse();
  }, [fasting, today]);

  /** Recent reflections journal — every saved daily note, newest first.
   *  Until now the notes were saved on blur and never re-surfaced anywhere;
   *  this gives the user a place to actually read what they wrote. Capped
   *  at 30 most-recent entries so the list stays scannable. */
  const recentReflections = useMemo(() => {
    return Object.values(fasting)
      .filter((log) => log.notes && log.notes.trim().length > 0)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 30)
      .map((log) => ({
        date: log.date,
        notes: log.notes!.trim(),
        count: PARTS.filter((p) => log.parts[p]).length,
      }));
  }, [fasting]);

  const todayCount = useMemo(() => {
    if (!todayLog) return 0;
    return PARTS.filter((p) => todayLog.parts[p]).length;
  }, [todayLog]);

  const [notes, setNotes] = useState(todayLog?.notes ?? '');

  return (
    <div className="space-y-4">
      <Link
        href="/categories"
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"
      >
        <ArrowBack /> {t('common.back')}
      </Link>
      <h1 className="text-2xl font-semibold">{t('fasting.title')}</h1>
      <p className="text-sm text-ink-600">{t('fasting.intro')}</p>

      <Card className="space-y-2 border-sand-200 bg-sand-50">
        <p
          lang="ar"
          dir="rtl"
          className="text-end text-base leading-loose text-ink-900"
          style={{ fontFamily: '"Amiri","Noto Naskh Arabic",serif' }}
        >
          {t('fasting.hadithArabic')}
        </p>
        <p className="text-sm leading-relaxed text-ink-700">
          {t('fasting.hadithTranslation')}
        </p>
        <p className="text-xs text-ink-500">— {t('fasting.hadithSource')}</p>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-ink-800">
            {t('fasting.todayTitle')}
          </h2>
          <span className="numeral text-sm text-ink-500">
            {t('fasting.todayCount', { done: fmt(todayCount), total: fmt(PARTS.length) })}
          </span>
        </div>
        <ul className="space-y-2">
          {PARTS.map((p) => {
            const on = todayLog?.parts[p] === true;
            return (
              <li key={p}>
                <PartRow
                  part={p}
                  on={on}
                  onToggle={() => setFastingPart(today, p, !on)}
                />
              </li>
            );
          })}
        </ul>
        <label className="block space-y-1 pt-1">
          <span className="text-xs text-ink-600">{t('fasting.notesLabel')}</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => setFastingNotes(today, notes.trim())}
            placeholder={t('fasting.notesPlaceholder')}
            maxLength={300}
            rows={2}
            className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
          />
        </label>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-800">
          {t('fasting.last7Title')}
        </h2>
        <div className="grid grid-cols-7 gap-1.5">
          {last7.map(({ date, log }) => {
            const count = log
              ? PARTS.filter((p) => log.parts[p]).length
              : 0;
            const intensity =
              count === 0
                ? 'bg-ink-100'
                : count <= 1
                ? 'bg-leaf-200'
                : count <= 3
                ? 'bg-leaf-400'
                : count <= 4
                ? 'bg-leaf-600'
                : 'bg-leaf-700';
            const isToday = date === today;
            return (
              <div
                key={date}
                className={`flex aspect-square items-center justify-center rounded-md text-xs font-semibold ${intensity} ${
                  count >= 3 ? 'text-white' : 'text-ink-700'
                } ${isToday ? 'ring-2 ring-leaf-500 ring-offset-1' : ''}`}
                title={`${date}: ${count}/5`}
              >
                <span className="numeral">{fmt(count)}</span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-ink-500">{t('fasting.last7Legend')}</p>
      </Card>

      {recentReflections.length > 0 && (
        <Card className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-ink-800">
              {t('fasting.reflectionsTitle')}
            </h2>
            <p className="text-xs text-ink-500">
              {t('fasting.reflectionsBody')}
            </p>
          </div>
          <ul className="space-y-2">
            {recentReflections.map((r) => (
              <li
                key={r.date}
                className="rounded-xl border-s-2 border-leaf-400 bg-leaf-50/40 px-3 py-2"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="numeral text-[11px] uppercase tracking-wide text-leaf-700">
                    {r.date}
                  </span>
                  <span className="numeral text-[11px] text-ink-500">
                    {t('fasting.todayCount', {
                      done: fmt(r.count),
                      total: fmt(PARTS.length),
                    })}
                  </span>
                </div>
                <p className="pt-1 text-sm leading-relaxed text-ink-800">
                  {r.notes}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function PartRow({
  part,
  on,
  onToggle,
}: {
  part: FastingPart;
  on: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`tap-44 flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-start transition ${
        on ? 'border-leaf-500 bg-leaf-50' : 'border-ink-200 bg-white hover:border-ink-300'
      }`}
    >
      <span
        aria-hidden
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
          on ? 'border-leaf-600 bg-leaf-600 text-white' : 'border-ink-300 bg-white'
        }`}
      >
        {on && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-4 w-4">
            <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="flex-1">
        <span className={`block font-medium ${on ? 'text-leaf-800' : 'text-ink-800'}`}>
          {t(`fasting.parts.${part}.title` as any)}
        </span>
        <span className="block text-xs text-ink-500">
          {t(`fasting.parts.${part}.body` as any)}
        </span>
      </span>
    </button>
  );
}
