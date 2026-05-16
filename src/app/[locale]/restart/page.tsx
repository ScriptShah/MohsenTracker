'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ClientGate } from '@/components/ClientGate';
import { useAppStore } from '@/lib/store';
import { useNumberFormatter } from '@/lib/format';
import { useUnitLabel } from '@/lib/units';
import { computeStrikes } from '@/lib/restart';
import { todayKey } from '@/lib/dates';
import type { Habit } from '@/domain/types';

export default function RestartPage() {
  return (
    <ClientGate>
      <Restart />
    </ClientGate>
  );
}

function Restart() {
  const t = useTranslations();
  const fmt = useNumberFormatter();
  const unitLabel = useUnitLabel();
  const router = useRouter();
  const habits = useAppStore((s) => s.habits.filter((h) => h.frequency === 'daily'));
  const allHabits = useAppStore((s) => s.habits);
  const summaries = useAppStore((s) => s.summaries);
  const lastRestartAt = useAppStore((s) => s.profile?.lastRestartAt);
  const deleteHabit = useAppStore((s) => s.deleteHabit);
  const markRestartDone = useAppStore((s) => s.markRestartDone);

  const strikes = useMemo(
    () => computeStrikes(summaries, todayKey(), lastRestartAt, allHabits),
    [summaries, lastRestartAt, allHabits],
  );

  // Selected habits are the ones the user wants to KEEP. Default: keep all,
  // user un-checks the ones they're letting go.
  const [keep, setKeep] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(habits.map((h) => [h.id, true])),
  );

  const dropCount = useMemo(
    () => habits.filter((h) => !keep[h.id]).length,
    [habits, keep],
  );

  const onCommit = () => {
    for (const h of habits) {
      if (!keep[h.id]) deleteHabit(h.id);
    }
    markRestartDone();
    router.replace('/');
  };

  return (
    <div className="space-y-5">
      {/* The hero is intentionally distinct from the onboarding splash —
          full-bleed gradient, mosque-night vibe, and copy that names the
          situation honestly rather than congratulating. */}
      <div className="relative -mx-4 -mt-2 overflow-hidden rounded-b-3xl bg-gradient-to-br from-ink-900 via-leaf-900 to-leaf-700 px-6 py-10 text-white shadow-lg">
        <div
          aria-hidden
          className="pointer-events-none absolute -end-12 -top-10 h-48 w-48 rounded-full bg-leaf-500/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -start-10 bottom-0 h-40 w-40 rounded-full bg-sand-300/20 blur-3xl"
        />
        <p className="text-xs uppercase tracking-[0.18em] text-leaf-200">
          {t('restart.eyebrow')}
        </p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight">
          {t('restart.heroTitle')}
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-leaf-50/90">
          {t('restart.heroBody', { strikes: fmt(strikes) })}
        </p>
        <p className="numeral mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs">
          <span aria-hidden>●</span>
          {t('restart.heroStat', { strikes: fmt(strikes) })}
        </p>
      </div>

      <Card className="space-y-2 border-leaf-200 bg-leaf-50">
        <h2 className="text-sm font-semibold text-leaf-800">
          {t('restart.principleTitle')}
        </h2>
        <p className="text-sm leading-relaxed text-ink-700">
          {t('restart.principleBody')}
        </p>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-800">
          {t('restart.chooseTitle', { n: fmt(habits.length) })}
        </h2>
        <p className="text-xs text-ink-500">{t('restart.chooseBody')}</p>
        {habits.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink-200 p-3 text-sm text-ink-500">
            {t('restart.noHabits')}
          </p>
        ) : (
          <ul className="space-y-2">
            {habits.map((h) => (
              <li key={h.id}>
                <KeepRow
                  habit={h}
                  kept={keep[h.id] ?? true}
                  onToggle={() =>
                    setKeep((prev) => ({ ...prev, [h.id]: !(prev[h.id] ?? true) }))
                  }
                  unitLabel={unitLabel}
                  fmt={fmt}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <Card className="space-y-3 border-sand-200 bg-sand-50">
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wide text-sand-700">
            {t('restart.summaryLabel')}
          </span>
          <span className="numeral text-sm font-semibold text-ink-800">
            {t('restart.summaryCount', {
              keep: fmt(habits.length - dropCount),
              drop: fmt(dropCount),
            })}
          </span>
        </div>
        {dropCount > 0 && (
          <p className="text-xs leading-relaxed text-ink-600">
            {t('restart.summaryWarning')}
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (dropCount > 0 && !confirm(t('restart.confirm', { n: fmt(dropCount) }))) {
                return;
              }
              onCommit();
            }}
          >
            {dropCount === 0
              ? t('restart.commitNoChanges')
              : t('restart.commit', { n: fmt(dropCount) })}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function KeepRow({
  habit,
  kept,
  onToggle,
  unitLabel,
  fmt,
}: {
  habit: Habit;
  kept: boolean;
  onToggle: () => void;
  unitLabel: (unit?: string) => string;
  fmt: (n: number) => string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={kept}
      onClick={onToggle}
      className={`tap-44 flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-start transition ${
        kept
          ? 'border-leaf-300 bg-white'
          : 'border-ink-200 bg-ink-100/60 opacity-70'
      }`}
    >
      <span
        aria-hidden
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
          kept ? 'border-leaf-600 bg-leaf-600 text-white' : 'border-ink-300 bg-white'
        }`}
      >
        {kept ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-4 w-4">
            <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <span className="text-xs text-ink-400">—</span>
        )}
      </span>
      <span className="flex-1">
        <span className={`block font-medium ${kept ? 'text-ink-800' : 'text-ink-500 line-through'}`}>
          {habit.name}
        </span>
        {habit.unit && habit.type === 'good' && habit.target !== undefined && (
          <span className="numeral block text-xs text-ink-500">
            {fmt(habit.target)} {unitLabel(habit.unit)}
          </span>
        )}
        {habit.unit && habit.type === 'bad' && habit.limit !== undefined && (
          <span className="numeral block text-xs text-ink-500">
            ≤ {fmt(habit.limit)} {unitLabel(habit.unit)}
          </span>
        )}
      </span>
    </button>
  );
}
