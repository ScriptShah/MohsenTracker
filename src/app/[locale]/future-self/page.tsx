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
import { todayStreakStatus } from '@/lib/overallStreak';
import { todayKey } from '@/lib/dates';
import { useNumberFormatter } from '@/lib/format';

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
  const setProfile = useAppStore((s) => s.setProfile);
  const fmt = useNumberFormatter();

  const overallStreak = profile?.overallStreak;
  const fireCurrent = overallStreak?.current ?? 0;
  const fireLongest = overallStreak?.longest ?? 0;
  const fireTier = getFireTier(fireCurrent);
  const fireTierName = getTierName(fireTier);
  const fireDiamond = isDiamond(fireTier);
  const fireNext = getDaysToNextTier(fireCurrent);
  /** "Today counted" vs "Today won't count yet because X" — surfaces
   *  the gap between the home completion percentage (done/total) and
   *  the streak rule (every critical done, OR if no criticals, at
   *  least one habit done). The single most-common confusion is "I'm
   *  at 56% on Home but my streak hasn't moved" — usually means a
   *  critical habit isn't done yet. */
  const todayISO = todayKey();
  const streakStatus = useMemo(
    () => todayStreakStatus(habits, logs[todayISO] ?? {}, todayISO),
    [habits, logs, todayISO],
  );
  const islamicCategoryId = useMemo(
    () => allCategories.find((c) => c.key === 'islamic')?.id,
    [allCategories],
  );
  const fireTrack = useMemo(
    () => getFireTrack(profile, habits, islamicCategoryId),
    [profile, habits, islamicCategoryId],
  );
  const fireSentence = t(
    `streakFire.tiers.${fireTierName}.${fireTrack}` as any,
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
        {habits.length === 0 ? (
          <Card className="text-center text-sm text-ink-500">
            {t('futureSelf.emptyState')}
          </Card>
        ) : (
          <Card
            className={
              fireDiamond
                ? 'border-leaf-300 bg-gradient-to-br from-leaf-50 via-white to-leaf-50 text-center'
                : 'text-center'
            }
          >
            <div className="flex flex-col items-center gap-3 py-2">
              <StreakFire tier={fireTier} size="xl" animated />
              <div className="space-y-1">
                <h3 className="text-2xl font-semibold text-ink-900">
                  {t(`streakFire.tierNames.${fireTierName}` as any)}
                </h3>
                <p className="numeral text-sm text-ink-600">
                  {fmt(fireCurrent)}
                </p>
                <p className="mx-auto max-w-md pt-1 text-base leading-relaxed text-ink-800">
                  {fireSentence}
                </p>
              </div>
              <TodayStatusLine status={streakStatus} fmt={fmt} t={t} />
              {fireDiamond ? (
                <p className="text-xs font-medium uppercase tracking-wide text-leaf-700">
                  {t('streakFire.forgedForever')}
                </p>
              ) : fireNext.nextTierName ? (
                <p className="numeral text-xs text-ink-500">
                  {t('streakFire.daysUntilNext', {
                    days: fmt(fireNext.days),
                    tierName: t(
                      `streakFire.tierNames.${fireNext.nextTierName}` as any,
                    ),
                  })}
                </p>
              ) : null}
              {fireLongest > fireCurrent && fireLongest > 0 && (
                <p className="numeral text-xs text-ink-500">
                  {t('streakFire.longestEver', { n: fmt(fireLongest) })}
                </p>
              )}
            </div>
          </Card>
        )}
      </section>

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

/** One-line status under the streak count clarifying whether TODAY
 *  already counted toward the streak, or — if not — exactly what's
 *  still needed for it to count. Without this, users hit the "I'm at
 *  56% on Home but the streak hasn't moved" surprise: the home ring
 *  uses done/total, but the streak rule requires every critical habit
 *  done (or any habit, if no criticals exist). This collapses that
 *  whole confusion into a single sentence. */
function TodayStatusLine({
  status,
  fmt,
  t,
}: {
  status: ReturnType<typeof todayStreakStatus>;
  fmt: (n: number) => string;
  t: ReturnType<typeof useTranslations>;
}) {
  if (status.kind === 'no-habits') return null;
  if (status.kind === 'qualified') {
    return (
      <p className="rounded-full border border-leaf-300 bg-leaf-50 px-3 py-1 text-xs font-medium text-leaf-700">
        {t('streakFire.today.qualified')}
      </p>
    );
  }
  if (status.kind === 'criticals-pending') {
    return (
      <p className="numeral rounded-full border border-sand-300 bg-sand-50 px-3 py-1 text-xs font-medium text-sand-700">
        {t('streakFire.today.criticalsPending', {
          remaining: fmt(status.remaining),
          total: fmt(status.total),
        })}
      </p>
    );
  }
  // any-pending
  return (
    <p className="rounded-full border border-sand-300 bg-sand-50 px-3 py-1 text-xs font-medium text-sand-700">
      {t('streakFire.today.anyPending')}
    </p>
  );
}

