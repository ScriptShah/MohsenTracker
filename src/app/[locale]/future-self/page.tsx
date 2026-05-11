'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ClientGate } from '@/components/ClientGate';
import { StreakFire } from '@/components/StreakFire';
import { useAppStore } from '@/lib/store';
import {
  categoryConsistency30Day,
  dailyCompoundQuoteIdx,
  daysSinceStart,
} from '@/lib/futureSelf';
import {
  getDaysToNextTier,
  getFireTier,
  getFireTrack,
  getTierName,
  isDiamond,
} from '@/lib/streakFire';
import { useNumberFormatter } from '@/lib/format';
import type { Habit } from '@/domain/types';

export default function FutureSelfPage() {
  return (
    <ClientGate>
      <FutureSelf />
    </ClientGate>
  );
}

function FutureSelf() {
  const t = useTranslations();
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const categories = useAppStore((s) => s.categories.filter((c) => c.isActive));
  const allCategories = useAppStore((s) => s.categories);
  const habits = useAppStore((s) => s.habits);
  const logs = useAppStore((s) => s.logs);
  const streaks = useAppStore((s) => s.streaks);
  const setProfile = useAppStore((s) => s.setProfile);
  const fmt = useNumberFormatter();
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);

  /** All daily habits the user is actively tracking, sorted by streak length
   *  descending. Spark-tier habits (0 days) still appear so the user sees
   *  the system from day one — empty state only triggers when there are
   *  truly zero habits in the list. */
  const fireCards = useMemo(() => {
    return habits
      .filter((h) => h.frequency === 'daily')
      .map((h) => ({
        habit: h,
        streak: streaks[h.id]?.current ?? 0,
      }))
      .sort((a, b) => b.streak - a.streak);
  }, [habits, streaks]);

  const selectedHabit = useMemo(
    () => habits.find((h) => h.id === selectedHabitId),
    [habits, selectedHabitId],
  );

  const [editing, setEditing] = useState(false);

  // No profile → onboarding handles it.
  useEffect(() => {
    if (!profile?.onboardingComplete) router.replace('/onboarding');
  }, [profile, router]);

  const dayN = useMemo(
    () => (profile ? daysSinceStart(profile.createdAt) : 1),
    [profile],
  );

  const islamicActive = useMemo(
    () => categories.some((c) => c.key === 'islamic' && c.isActive),
    [categories],
  );
  const quoteIdx = useMemo(
    () => dailyCompoundQuoteIdx(islamicActive),
    [islamicActive],
  );

  const consistencies = useMemo(() => {
    return categories.map((c) => ({
      category: c,
      rate: categoryConsistency30Day(habits, logs, c.id),
    }));
  }, [categories, habits, logs]);

  if (!profile) return null;

  if (editing) {
    return (
      <EditForm
        initial={{
          futureSelfName: profile.futureSelfName ?? '',
          vision: profile.futureSelfVision ?? '',
          why: profile.whyItMatters ?? '',
        }}
        onCancel={() => setEditing(false)}
        onSave={(patch) => {
          setProfile({
            futureSelfName: patch.futureSelfName.trim() || undefined,
            futureSelfVision: patch.vision.trim(),
            whyItMatters: patch.why.trim() || undefined,
          });
          setEditing(false);
        }}
      />
    );
  }

  const futureSelfName = profile.futureSelfName?.trim();
  const vision = profile.futureSelfVision?.trim();
  const why = profile.whyItMatters?.trim();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-leaf-700">
          {t('futureSelf.becoming')}
        </p>
        {futureSelfName ? (
          <h1 className="text-3xl font-semibold leading-tight text-ink-900">
            {futureSelfName}
          </h1>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-2xl font-semibold text-ink-400 underline decoration-dashed underline-offset-4"
          >
            {t('futureSelf.noFutureSelfName')}
          </button>
        )}
        <p className="numeral text-sm text-ink-500">
          {t('futureSelf.daysIn', { n: dayN })}
        </p>
      </header>

      <Card className="border-leaf-200 bg-leaf-50">
        {vision ? (
          <p className="text-lg leading-relaxed text-ink-800">{vision}</p>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-ink-400 underline decoration-dashed underline-offset-4"
          >
            {t('futureSelf.noVision')}
          </button>
        )}
      </Card>

      {why ? (
        <Quote text={why} />
      ) : (
        <Card>
          <button
            onClick={() => setEditing(true)}
            className="text-ink-400 underline decoration-dashed underline-offset-4"
          >
            {t('futureSelf.noWhy')}
          </button>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-800">
          {t('futureSelf.yourBecoming')}
        </h2>
        {fireCards.length === 0 ? (
          <Card className="text-center text-sm text-ink-500">
            {t('futureSelf.emptyState')}
          </Card>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {fireCards.map(({ habit, streak }) => (
              <li key={habit.id}>
                <FireGridCard
                  habit={habit}
                  streak={streak}
                  fmt={fmt}
                  onOpen={() => setSelectedHabitId(habit.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedHabit && (
        <FireDetailSheet
          habit={selectedHabit}
          streak={streaks[selectedHabit.id]?.current ?? 0}
          allCategories={allCategories}
          fmt={fmt}
          onClose={() => setSelectedHabitId(null)}
        />
      )}

      <Card className="border-sand-200 bg-gradient-to-br from-sand-50 to-white">
        <p className="text-xs uppercase tracking-wide text-sand-600">
          {t('futureSelf.smallestTitle')}
        </p>
        <p className="pt-1 text-base leading-relaxed text-ink-800">
          {t('futureSelf.smallestBody')}
        </p>
      </Card>

      <Card className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-ink-800">
            {t('futureSelf.thirtyDayTitle')}
          </h2>
          <p className="text-xs text-ink-500">{t('futureSelf.thirtyDayHint')}</p>
        </div>
        <ul className="space-y-3">
          {consistencies.map(({ category, rate }) => (
            <li key={category.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm text-ink-700">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-white text-xs"
                    style={{ backgroundColor: category.color }}
                    aria-hidden
                  >
                    {category.icon}
                  </span>
                  {category.name}
                </span>
                <span className="numeral text-xs font-medium text-ink-600">
                  {Math.round(rate * 100)}%
                </span>
              </div>
              <ConsistencyBar value={rate} color={category.color} />
            </li>
          ))}
        </ul>
      </Card>

      <Card className="border-leaf-200 bg-leaf-50">
        <p className="text-xs uppercase tracking-wide text-leaf-700">
          {t('futureSelf.compoundTitle')}
        </p>
        <p className="pt-1 leading-relaxed text-ink-800">
          {t(`futureSelf.quotes.q${quoteIdx}` as any)}
        </p>
      </Card>

      <Button variant="secondary" onClick={() => setEditing(true)}>
        {t('futureSelf.edit')}
      </Button>
    </div>
  );
}

function ConsistencyBar({ value, color }: { value: number; color: string }) {
  // The bar fills from start-of-line, so it flips correctly in RTL via inline-start.
  const pct = Math.round(value * 100);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

function Quote({ text }: { text: string }) {
  return (
    <blockquote className="relative rounded-2xl border-s-4 border-sand-400 bg-white px-4 py-3 text-ink-800 shadow-sm">
      <span aria-hidden className="absolute -top-2 start-2 text-3xl text-sand-300">
        “
      </span>
      <p className="relative leading-relaxed">{text}</p>
    </blockquote>
  );
}

function EditForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: { futureSelfName: string; vision: string; why: string };
  onCancel: () => void;
  onSave: (patch: { futureSelfName: string; vision: string; why: string }) => void;
}) {
  const t = useTranslations();
  const [futureSelfName, setFutureSelfName] = useState(initial.futureSelfName);
  const [vision, setVision] = useState(initial.vision);
  const [why, setWhy] = useState(initial.why);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ futureSelfName, vision, why });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-xl font-semibold">{t('futureSelf.editTitle')}</h1>

      <Card className="space-y-4">
        <Field label={t('futureSelf.fields.futureSelfName')}>
          <input
            value={futureSelfName}
            onChange={(e) => setFutureSelfName(e.target.value)}
            placeholder={t('onboarding.futureSelfNamePlaceholder')}
            className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
          />
        </Field>
        <Field label={t('futureSelf.fields.vision')}>
          <textarea
            value={vision}
            onChange={(e) => setVision(e.target.value)}
            rows={5}
            placeholder={t('onboarding.visionPlaceholder')}
            className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
          />
        </Field>
        <Field label={t('futureSelf.fields.why')}>
          <textarea
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            rows={5}
            placeholder={t('onboarding.whyPlaceholder')}
            className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
          />
        </Field>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit">{t('futureSelf.save')}</Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="block text-sm font-medium text-ink-700">{label}</span>
      {children}
    </label>
  );
}

/* ── Streak-fire "Your becoming" grid ──────────────────────────────── */

function FireGridCard({
  habit,
  streak,
  fmt,
  onOpen,
}: {
  habit: Habit;
  streak: number;
  fmt: (n: number) => string;
  onOpen: () => void;
}) {
  const t = useTranslations();
  const tier = getFireTier(streak);
  const tierName = getTierName(tier);
  const diamond = isDiamond(tier);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`tap-44 relative flex w-full flex-col items-center gap-2 rounded-2xl border p-4 text-center transition ${
        diamond
          ? 'border-leaf-300 bg-leaf-50 shadow-sm hover:border-leaf-400'
          : 'border-ink-200 bg-white hover:border-ink-300'
      }`}
    >
      {diamond && (
        <span className="absolute end-2 top-2 inline-flex items-center gap-1 rounded-full bg-leaf-600 px-2 py-0.5 text-[10px] font-medium text-white">
          ✦ {t('futureSelf.oneYearBadge')}
        </span>
      )}
      <StreakFire tier={tier} size="lg" />
      <span className="line-clamp-1 text-sm font-medium text-ink-800">
        {habit.name}
      </span>
      <span className="numeral text-xs text-ink-500">
        {fmt(streak)} · {t(`streakFire.tierNames.${tierName}` as any)}
      </span>
    </button>
  );
}

function FireDetailSheet({
  habit,
  streak,
  allCategories,
  fmt,
  onClose,
}: {
  habit: Habit;
  streak: number;
  allCategories: { id: string; key?: string }[];
  fmt: (n: number) => string;
  onClose: () => void;
}) {
  const t = useTranslations();
  const profile = useAppStore((s) => s.profile);
  const tier = getFireTier(streak);
  const tierName = getTierName(tier);
  const diamond = isDiamond(tier);
  const next = getDaysToNextTier(streak);
  const track = getFireTrack(habit, profile, allCategories as any);
  const sentence = t(`streakFire.tiers.${tierName}.${track}` as any);

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-ink-900/40 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-screen-sm space-y-4 overflow-y-auto rounded-t-2xl bg-white p-6 text-center shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <StreakFire tier={tier} size="xl" animated />
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-ink-500">
            {habit.name}
          </p>
          <h2 className="text-2xl font-semibold text-ink-900">
            {t(`streakFire.tierNames.${tierName}` as any)}
          </h2>
          <p className="numeral text-sm text-ink-500">
            {fmt(streak)}
          </p>
        </div>
        <p className="text-base leading-relaxed text-ink-800">{sentence}</p>
        {diamond ? (
          <p className="text-xs font-medium uppercase tracking-wide text-leaf-700">
            {t('streakFire.forgedForever')}
          </p>
        ) : next.nextTierName ? (
          <p className="numeral text-xs text-ink-500">
            {t('streakFire.daysUntilNext', {
              days: fmt(next.days),
              tierName: t(`streakFire.tierNames.${next.nextTierName}` as any),
            })}
          </p>
        ) : null}
        <div className="flex justify-center pt-2">
          <Button type="button" onClick={onClose}>
            {t('futureSelf.continue')}
          </Button>
        </div>
      </div>
    </div>
  );
}
