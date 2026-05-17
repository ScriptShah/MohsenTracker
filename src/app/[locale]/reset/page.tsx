'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ClientGate } from '@/components/ClientGate';
import { useAppStore } from '@/lib/store';
import { useNumberFormatter } from '@/lib/format';
import {
  REPLACEMENT_LIBRARY,
  TIERS,
  currentDay,
  reachedTarget,
  stageFor,
  targetDaysFor,
  todayReplacements,
  type ReplacementBucket,
} from '@/lib/reset';
import { todayKey } from '@/lib/dates';
import { ResetCompletionSheet } from '@/components/ResetCompletionSheet';
import type { DopamineReset, ResetTier } from '@/domain/types';

export default function ResetPage() {
  return (
    <ClientGate>
      <ResetView />
    </ClientGate>
  );
}

function ResetView() {
  const t = useTranslations();
  const fmt = useNumberFormatter();
  const resets = useAppStore((s) => s.resets);
  const startReset = useAppStore((s) => s.startReset);
  const logCheckIn = useAppStore((s) => s.logResetCheckIn);
  const logRelapse = useAppStore((s) => s.logResetRelapse);
  const completeReset = useAppStore((s) => s.completeReset);
  const setCompletionReflection = useAppStore(
    (s) => s.setResetCompletionReflection,
  );
  const abandonReset = useAppStore((s) => s.abandonReset);
  const deleteReset = useAppStore((s) => s.deleteReset);

  const active = resets.find((r) => r.status === 'active');
  const past = resets.filter((r) => r.status !== 'active');

  /** Aggregate stats across every reset the user has ever started.
   *  Surfaces the user's results so the page is never just "the current
   *  reset and forget about the rest." This useMemo was lost in a merge
   *  during PR #29 — the JSX referencing it shipped, the declaration
   *  didn't, and `/reset` has been throwing a ReferenceError since. */
  const stats = useMemo(() => {
    if (resets.length === 0) return null;
    const totalStarted = resets.length;
    const totalCompleted = resets.filter((r) => r.status === 'completed').length;
    const totalRelapses = resets.reduce((sum, r) => sum + r.relapses.length, 0);
    const lifetimeCleanDays = resets.reduce(
      (sum, r) => sum + r.lifetimeCleanDays,
      0,
    );
    const longestStreak = resets.reduce((max, r) => {
      // Best clean streak for this reset = max of lifetime and current.
      const streak = Math.max(r.lifetimeCleanDays, currentDay(r));
      return Math.max(max, streak);
    }, 0);
    return {
      totalStarted,
      totalCompleted,
      totalRelapses,
      lifetimeCleanDays,
      longestStreak,
    };
  }, [resets]);

  // When the active reset reaches its target, surface a completion sheet
  // instead of silently flipping the status. The user gets a chance to
  // capture a reflection on what changed; the sheet's Skip + Save both
  // complete the reset, but only Save persists text.
  const [completingId, setCompletingId] = useState<string | null>(null);
  useEffect(() => {
    if (active && reachedTarget(active)) {
      setCompletingId(active.id);
    }
  }, [active]);

  // Editing the completion reflection on an already-completed past reset.
  const [editingPastId, setEditingPastId] = useState<string | null>(null);
  const editingPast = past.find((r) => r.id === editingPastId);
  const completingReset = active && active.id === completingId ? active : null;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold">{t('reset.title')}</h1>
        <p className="text-sm text-ink-500">{t('reset.intro')}</p>
      </header>

      {active ? (
        <ActiveResetView
          reset={active}
          onCheckIn={(fields) => logCheckIn(active.id, fields)}
          onRelapse={(reflection) => logRelapse(active.id, reflection)}
          onAbandon={() => {
            if (confirm(t('reset.confirmAbandon'))) abandonReset(active.id);
          }}
          fmt={fmt}
        />
      ) : (
        <StartReset onStart={(tier, target) => startReset(tier, target)} />
      )}

      {stats && stats.totalStarted > 0 && (
        <Card className="space-y-3 border-leaf-200 bg-leaf-50/40">
          <h2 className="text-sm font-semibold text-ink-800">
            {t('reset.statsTitle')}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label={t('reset.statsStarted')}
              value={fmt(stats.totalStarted)}
            />
            <Stat
              label={t('reset.statsCompleted')}
              value={`${fmt(stats.totalCompleted)} / ${fmt(stats.totalStarted)}`}
            />
            <Stat
              label={t('reset.statsLongest')}
              value={`${fmt(stats.longestStreak)} ${t('reset.statsDaysShort')}`}
            />
            <Stat
              label={t('reset.statsLifetime')}
              value={`${fmt(stats.lifetimeCleanDays)} ${t('reset.statsDaysShort')}`}
            />
          </div>
          {stats.totalRelapses > 0 && (
            <p className="text-xs text-ink-500">
              {t('reset.statsRelapsesNote', {
                n: fmt(stats.totalRelapses),
              })}
            </p>
          )}
        </Card>
      )}

      {past.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-ink-800">
            {t('reset.history')}
          </h2>
          <ul className="space-y-2">
            {past.map((r) => (
              <li key={r.id}>
                <Card className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <div className="font-medium">{r.target}</div>
                      <div className="text-xs text-ink-500">
                        {t(`reset.tier.${r.tier}.label` as any)} ·{' '}
                        {r.status === 'completed'
                          ? t('reset.completedAt', {
                              date: (r.completedAt ?? '').slice(0, 10),
                            })
                          : t('reset.started', {
                              date: r.startedAt.slice(0, 10),
                            })}
                      </div>
                    </div>
                    <div className="numeral text-end text-xs text-ink-500">
                      {r.lifetimeCleanDays === 1
                        ? t('reset.lifetimeOne')
                        : t('reset.lifetime', { n: fmt(r.lifetimeCleanDays) })}
                    </div>
                  </div>
                  {r.completionReflection && (
                    <div className="rounded-xl border-s-2 border-leaf-400 bg-leaf-50 px-3 py-2 text-sm leading-relaxed italic text-ink-700">
                      {r.completionReflection}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    {r.status === 'completed' ? (
                      <button
                        type="button"
                        className="text-xs text-leaf-700 underline-offset-4 hover:underline"
                        onClick={() => setEditingPastId(r.id)}
                      >
                        {r.completionReflection
                          ? t('reset.editReflection')
                          : t('reset.addReflection')}
                      </button>
                    ) : (
                      <span />
                    )}
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => {
                        if (confirm(t('reset.confirmDelete'))) deleteReset(r.id);
                      }}
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {completingReset && (
        <ResetCompletionSheet
          target={completingReset.target}
          initialReflection={completingReset.completionReflection}
          onConfirm={(reflection) => {
            completeReset(completingReset.id, reflection);
            setCompletingId(null);
          }}
          onSkip={() => {
            completeReset(completingReset.id);
            setCompletingId(null);
          }}
        />
      )}

      {editingPast && (
        <ResetCompletionSheet
          target={editingPast.target}
          initialReflection={editingPast.completionReflection}
          onConfirm={(reflection) => {
            setCompletionReflection(editingPast.id, reflection);
            setEditingPastId(null);
          }}
          onSkip={() => setEditingPastId(null)}
        />
      )}
    </div>
  );
}

/* ── Tier picker ─────────────────────────────────────────────────────── */

function StartReset({
  onStart,
}: {
  onStart: (tier: ResetTier, target: string) => void;
}) {
  const t = useTranslations();
  const [target, setTarget] = useState('');
  const [tier, setTier] = useState<ResetTier>('monthly7d');

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink-700">
            {t('reset.targetLabel')}
          </span>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={t('reset.targetPlaceholder')}
            className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
          />
        </label>

        <div className="space-y-2">
          <span className="text-sm font-medium text-ink-700">
            {t('reset.startTitle')}
          </span>
          <ul className="space-y-2">
            {TIERS.map((tt) => {
              const active = tier === tt;
              return (
                <li key={tt}>
                  <button
                    type="button"
                    onClick={() => setTier(tt)}
                    className={`tap-44 w-full rounded-xl border px-3 py-2 text-start transition ${
                      active
                        ? 'border-leaf-500 bg-leaf-50'
                        : 'border-ink-200 bg-white'
                    }`}
                  >
                    <div className="text-sm font-medium">
                      {t(`reset.tier.${tt}.label` as any)}
                    </div>
                    <div className="text-xs text-ink-500">
                      {t(`reset.tier.${tt}.body` as any)}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button
          disabled={!target.trim()}
          onClick={() => onStart(tier, target)}
        >
          {t('reset.start')}
        </Button>
      </div>
    </div>
  );
}

/* ── Active reset view ───────────────────────────────────────────────── */

function ActiveResetView({
  reset,
  onCheckIn,
  onRelapse,
  onAbandon,
  fmt,
}: {
  reset: DopamineReset;
  onCheckIn: (fields: { mood: number; insteadOf?: string; urges?: string }) => void;
  onRelapse: (reflection?: string) => void;
  onAbandon: () => void;
  fmt: (n: number) => string;
}) {
  const t = useTranslations();
  const day = currentDay(reset);
  const stage = stageFor(reset);
  const replacements = useMemo(() => todayReplacements(), []);
  const [showRelapse, setShowRelapse] = useState(false);
  const todayCheckIn = reset.checkIns[todayKey()];

  return (
    <>
      <Card className="space-y-2 bg-gradient-to-br from-leaf-50 to-white">
        <div className="text-xs uppercase tracking-wide text-leaf-700">
          {reset.target}
        </div>
        <div className="numeral text-4xl font-semibold leading-none text-ink-900">
          {t('reset.dayCounter', { n: fmt(day), total: fmt(reset.targetDays) })}
        </div>
        <div className="numeral text-xs text-ink-600">
          {day === 1 ? t('reset.currentStreakOne') : t('reset.currentStreak', { n: fmt(day) })}
          {reset.lifetimeCleanDays > 0 && (
            <>
              {' · '}
              {reset.lifetimeCleanDays === 1
                ? t('reset.lifetimeOne')
                : t('reset.lifetime', { n: fmt(reset.lifetimeCleanDays) })}
            </>
          )}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
          <div
            className="h-full bg-leaf-500 transition-all"
            style={{ width: `${Math.min(100, Math.round((day / reset.targetDays) * 100))}%` }}
          />
        </div>
      </Card>

      <Card className="space-y-1 border-sand-200 bg-sand-50">
        <div className="text-xs uppercase tracking-wide text-sand-600">
          {t(`reset.stage.${stage}` as any)}
        </div>
        <p className="leading-relaxed text-ink-800">
          {t(`reset.stageHint.${stage}` as any)}
        </p>
      </Card>

      <Card className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-800">
          {t('reset.replacementsTitle')}
        </h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(Object.keys(REPLACEMENT_LIBRARY) as ReplacementBucket[]).map((bucket) => (
            <li
              key={bucket}
              className="rounded-xl border border-ink-200 bg-white p-3"
            >
              <div className="text-[11px] uppercase tracking-wide text-ink-500">
                {t(`reset.replacementBucket.${bucket}` as any)}
              </div>
              <div className="text-sm text-ink-800">
                {t(`reset.activity.${replacements[bucket]}` as any)}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {todayCheckIn ? (
        <Card className="space-y-2">
          <h2 className="text-sm font-semibold text-ink-800">
            {t('reset.checkedInToday')}
          </h2>
          <div className="numeral text-xs text-ink-500">
            {t('reset.moodValue', { n: fmt(todayCheckIn.mood) })}
          </div>
          {todayCheckIn.insteadOf && (
            <p className="text-sm text-ink-700">
              <span className="text-ink-500">{t('reset.insteadOf')}: </span>
              {todayCheckIn.insteadOf}
            </p>
          )}
          {todayCheckIn.urges && (
            <p className="text-sm text-ink-700">
              <span className="text-ink-500">{t('reset.urges')}: </span>
              {todayCheckIn.urges}
            </p>
          )}
          <CheckInForm
            initial={todayCheckIn}
            onSave={onCheckIn}
            saveLabel={t('common.edit')}
          />
        </Card>
      ) : (
        <Card className="space-y-2">
          <h2 className="text-sm font-semibold text-ink-800">
            {t('reset.checkInTitle')}
          </h2>
          <p className="text-xs text-ink-500">{t('reset.checkInBody')}</p>
          <CheckInForm
            onSave={onCheckIn}
            saveLabel={t('reset.saveCheckIn')}
          />
        </Card>
      )}

      {reset.relapses.length > 0 && (
        <Card className="space-y-2">
          <h2 className="text-sm font-semibold text-ink-800">
            {t('reset.relapseHistory')}
          </h2>
          <ul className="space-y-1">
            {reset.relapses.map((r, i) => (
              <li key={i} className="text-xs text-ink-600">
                {r.daysCleanBefore === 1
                  ? t('reset.relapseHistoryItemOne', { date: r.at.slice(0, 10) })
                  : t('reset.relapseHistoryItem', {
                      date: r.at.slice(0, 10),
                      days: fmt(r.daysCleanBefore),
                    })}
                {r.reflection && (
                  <span className="block italic text-ink-500">{r.reflection}</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="secondary"
          onClick={() => setShowRelapse(true)}
          className="border-red-200 text-red-700"
        >
          {t('reset.relapse.button')}
        </Button>
        <Button variant="ghost" onClick={onAbandon}>
          {t('reset.abandon')}
        </Button>
      </div>

      {showRelapse && (
        <RelapseModal
          onCancel={() => setShowRelapse(false)}
          onConfirm={(reflection) => {
            onRelapse(reflection);
            setShowRelapse(false);
          }}
        />
      )}
    </>
  );
}

/* ── Check-in form ───────────────────────────────────────────────────── */

function CheckInForm({
  initial,
  onSave,
  saveLabel,
}: {
  initial?: { mood: number; insteadOf?: string; urges?: string };
  onSave: (fields: { mood: number; insteadOf?: string; urges?: string }) => void;
  saveLabel: string;
}) {
  const t = useTranslations();
  const [mood, setMood] = useState(initial?.mood ?? 3);
  const [insteadOf, setInsteadOf] = useState(initial?.insteadOf ?? '');
  const [urges, setUrges] = useState(initial?.urges ?? '');

  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink-700">{t('reset.mood')}</span>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={mood}
          onChange={(e) => setMood(Number(e.target.value))}
          className="w-full"
        />
        <span className="numeral block text-xs text-ink-500">{mood} / 5</span>
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink-700">
          {t('reset.insteadOf')}
        </span>
        <input
          value={insteadOf}
          onChange={(e) => setInsteadOf(e.target.value)}
          placeholder={t('reset.insteadOfPlaceholder')}
          className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink-700">{t('reset.urges')}</span>
        <textarea
          value={urges}
          onChange={(e) => setUrges(e.target.value)}
          rows={2}
          placeholder={t('reset.urgesPlaceholder')}
          className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
        />
      </label>
      <Button
        onClick={() =>
          onSave({
            mood,
            insteadOf: insteadOf.trim() || undefined,
            urges: urges.trim() || undefined,
          })
        }
      >
        {saveLabel}
      </Button>
    </div>
  );
}

/* ── Relapse modal ───────────────────────────────────────────────────── */

function RelapseModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (reflection?: string) => void;
}) {
  const t = useTranslations();
  const [reflection, setReflection] = useState('');

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink-900/40 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-screen-sm overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl">
        <h2 className="text-lg font-semibold">{t('reset.relapse.title')}</h2>
        <p className="pt-1 text-sm text-ink-500">{t('reset.relapse.body')}</p>

        <blockquote className="mt-3 rounded-xl border-s-2 border-sand-400 bg-sand-50 p-3 text-sm leading-relaxed text-ink-800">
          {t('reset.relapse.quote')}
          <span className="block pt-1 text-xs text-ink-500">
            — {t('reset.relapse.source')}
          </span>
        </blockquote>

        <label className="mt-4 block space-y-1">
          <span className="text-sm font-medium text-ink-700">
            {t('reset.relapse.reflection')}
          </span>
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            rows={3}
            placeholder={t('reset.relapse.reflectionPlaceholder')}
            className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
          />
        </label>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {t('reset.relapse.cancel')}
          </Button>
          <Button
            variant="danger"
            onClick={() => onConfirm(reflection.trim() || undefined)}
          >
            {t('reset.relapse.confirm')}
          </Button>
        </div>
      </div>
    </div>
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
