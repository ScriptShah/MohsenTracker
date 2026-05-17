'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ArrowBack } from '@/components/Chevron';
import { ClientGate } from '@/components/ClientGate';
import { useAppStore } from '@/lib/store';
import { useNumberFormatter } from '@/lib/format';
import { EndAutophagySheet } from '@/components/EndAutophagySheet';
import type { AutophagyFast } from '@/domain/types';

const TARGET_OPTIONS = [16, 18, 20, 24, 36];

export default function AutophagyPage() {
  return (
    <ClientGate>
      <Autophagy />
    </ClientGate>
  );
}

function Autophagy() {
  const t = useTranslations();
  const fmt = useNumberFormatter();
  const fasts = useAppStore((s) => s.autophagyFasts);
  const startAutophagyFast = useAppStore((s) => s.startAutophagyFast);
  const endAutophagyFast = useAppStore((s) => s.endAutophagyFast);
  const cancelAutophagyFast = useAppStore((s) => s.cancelAutophagyFast);
  const deleteAutophagyFast = useAppStore((s) => s.deleteAutophagyFast);

  const active = useMemo(() => fasts.find((f) => !f.endedAt), [fasts]);
  const history = useMemo(
    () =>
      fasts
        .filter((f) => f.endedAt)
        .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)),
    [fasts],
  );

  /** Aggregate stats across the user's complete history. Surfaced as a
   *  small panel so the user sees their results, not just the latest fast. */
  const stats = useMemo(() => {
    if (history.length === 0) return null;
    const durations = history.map((f) => {
      const ms = new Date(f.endedAt!).getTime() - new Date(f.startedAt).getTime();
      return ms / (60 * 60 * 1000); // hours
    });
    const total = history.length;
    const totalHours = durations.reduce((a, b) => a + b, 0);
    const longestHours = Math.max(...durations);
    const avgHours = totalHours / total;
    const reached = history.filter((f, i) => {
      const target = f.targetHours ?? 0;
      return target > 0 && durations[i] >= target;
    }).length;
    return { total, longestHours, avgHours, reached };
  }, [history]);

  const [target, setTarget] = useState<number>(16);
  const [showEndSheet, setShowEndSheet] = useState(false);

  return (
    <div className="space-y-4">
      <Link
        href="/categories"
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"
      >
        <ArrowBack /> {t('common.back')}
      </Link>
      <h1 className="text-2xl font-semibold">{t('autophagy.title')}</h1>
      <p className="text-sm text-ink-600">{t('autophagy.intro')}</p>

      {active ? (
        <ActiveFastCard
          fast={active}
          onEnd={() => setShowEndSheet(true)}
          onCancel={() => {
            if (confirm(t('autophagy.cancelConfirm'))) cancelAutophagyFast(active.id);
          }}
        />
      ) : (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-ink-800">
            {t('autophagy.startTitle')}
          </h2>
          <p className="text-xs text-ink-500">{t('autophagy.startBody')}</p>
          <div className="flex flex-wrap gap-2">
            {TARGET_OPTIONS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setTarget(h)}
                className={`tap-44 rounded-xl border px-3 py-2 text-sm font-medium ${
                  target === h
                    ? 'border-leaf-500 bg-leaf-50 text-leaf-800'
                    : 'border-ink-200 bg-white text-ink-700'
                }`}
              >
                <span className="numeral">{fmt(h)}</span>h
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={() => startAutophagyFast(target)}>
              {t('autophagy.startSubmit', { hours: fmt(target) })}
            </Button>
          </div>
        </Card>
      )}

      {stats && (
        <Card className="space-y-3 border-leaf-200 bg-leaf-50/40">
          <h2 className="text-sm font-semibold text-ink-800">
            {t('autophagy.statsTitle')}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label={t('autophagy.statsTotal')}
              value={fmt(stats.total)}
            />
            <Stat
              label={t('autophagy.statsLongest')}
              value={`${fmt(Math.round(stats.longestHours * 10) / 10)}h`}
            />
            <Stat
              label={t('autophagy.statsAverage')}
              value={`${fmt(Math.round(stats.avgHours * 10) / 10)}h`}
            />
            <Stat
              label={t('autophagy.statsReached')}
              value={`${fmt(stats.reached)} / ${fmt(stats.total)}`}
            />
          </div>
        </Card>
      )}

      {history.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-ink-800">
            {t('autophagy.historyTitle')}
          </h2>
          <ul className="space-y-2">
            {history.map((f) => (
              <li key={f.id}>
                <HistoryRow
                  fast={f}
                  onDelete={() => {
                    if (confirm(t('autophagy.deleteConfirm'))) deleteAutophagyFast(f.id);
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {showEndSheet && active && (
        <EndAutophagySheet
          onCancel={() => setShowEndSheet(false)}
          onConfirm={(notes) => {
            endAutophagyFast(active.id, notes);
            setShowEndSheet(false);
          }}
        />
      )}
    </div>
  );
}

function ActiveFastCard({
  fast,
  onEnd,
  onCancel,
}: {
  fast: AutophagyFast;
  onEnd: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations();
  const fmt = useNumberFormatter();

  // Tick once a second while the fast is active so the elapsed counter moves.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const startedMs = new Date(fast.startedAt).getTime();
  const elapsedMs = Math.max(0, now - startedMs);
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const elapsedHours = Math.floor(elapsedSeconds / 3600);
  const elapsedMinutes = Math.floor((elapsedSeconds % 3600) / 60);
  const elapsedSecs = elapsedSeconds % 60;

  const targetHours = fast.targetHours ?? 16;
  const targetMs = targetHours * 60 * 60 * 1000;
  const pct = Math.min(1, elapsedMs / targetMs);
  const remainingMs = Math.max(0, targetMs - elapsedMs);
  const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
  const remainingMinutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  const past = elapsedMs >= targetMs;

  const ring = `conic-gradient(${past ? '#16a34a' : '#65a30d'} ${pct * 360}deg, #e7e5e4 0deg)`;

  return (
    <Card className="space-y-4 border-leaf-200 bg-gradient-to-br from-leaf-50 to-white">
      <div className="flex items-center gap-4">
        <div
          className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full"
          style={{ background: ring }}
        >
          <div className="absolute inset-2 flex flex-col items-center justify-center rounded-full bg-white">
            <span className="numeral text-2xl font-semibold tabular-nums text-ink-900">
              {String(elapsedHours).padStart(2, '0')}:
              {String(elapsedMinutes).padStart(2, '0')}:
              {String(elapsedSecs).padStart(2, '0')}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-ink-500">
              {t('autophagy.elapsed')}
            </span>
          </div>
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-xs uppercase tracking-wide text-leaf-700">
            {t('autophagy.fastingActive')}
          </p>
          <p className="numeral text-sm text-ink-700">
            {t('autophagy.target', { hours: fmt(targetHours) })}
          </p>
          {past ? (
            <p className="text-xs font-medium text-leaf-700">
              {t('autophagy.targetReached')}
            </p>
          ) : (
            <p className="numeral text-xs text-ink-500">
              {t('autophagy.remaining', {
                hours: fmt(remainingHours),
                minutes: fmt(remainingMinutes),
              })}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('autophagy.cancel')}
        </Button>
        <Button type="button" onClick={onEnd}>
          {t('autophagy.end')}
        </Button>
      </div>
    </Card>
  );
}

function HistoryRow({
  fast,
  onDelete,
}: {
  fast: AutophagyFast;
  onDelete: () => void;
}) {
  const t = useTranslations();
  const fmt = useNumberFormatter();
  if (!fast.endedAt) return null;
  const ms = new Date(fast.endedAt).getTime() - new Date(fast.startedAt).getTime();
  const totalMinutes = Math.floor(ms / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const target = fast.targetHours ?? 0;
  const reached = target > 0 && hours >= target;

  return (
    <Card
      className={
        reached
          ? 'border-leaf-200 bg-leaf-50/40'
          : 'border-ink-200 bg-white'
      }
    >
      <div className="flex items-baseline justify-between">
        <span className="numeral text-xs text-ink-500">
          {fast.startedAt.slice(0, 10)}
        </span>
        <span className="numeral text-base font-semibold text-ink-800">
          {fmt(hours)}h {fmt(minutes)}m
          {target > 0 && (
            <span className="ms-1 text-xs text-ink-500">
              / {fmt(target)}h{reached ? ' ✓' : ''}
            </span>
          )}
        </span>
      </div>
      {fast.notes && (
        <div className="mt-2 rounded-xl border-s-2 border-leaf-400 bg-white/80 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-leaf-700">
            {t('autophagy.notesLabelInline')}
          </p>
          <p className="pt-0.5 text-sm leading-relaxed text-ink-800">
            {fast.notes}
          </p>
        </div>
      )}
      <div className="mt-2 flex">
        <button
          type="button"
          onClick={onDelete}
          className="ms-auto text-xs text-red-600 underline-offset-4 hover:underline"
        >
          {t('common.delete')}
        </button>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-ink-500">
        {label}
      </div>
      <div className="numeral pt-0.5 text-lg font-semibold text-ink-900">
        {value}
      </div>
    </div>
  );
}
