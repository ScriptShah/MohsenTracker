'use client';

import { useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, Link } from '@/i18n/routing';
import { Card } from '@/components/Card';
import { ClientGate } from '@/components/ClientGate';
import { HabitChecklist } from '@/components/HabitChecklist';
import { CompletionRing } from '@/components/CompletionRing';
import { useAppStore } from '@/lib/store';
import { todayKey } from '@/lib/dates';
import { dailyQuoteIndex } from '@/lib/futureSelf';
import { getNarrative } from '@/lib/projections';
import { useNumberFormatter } from '@/lib/format';

export default function HomePage() {
  return (
    <ClientGate>
      <Home />
    </ClientGate>
  );
}

function Home() {
  const t = useTranslations();
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const habits = useAppStore((s) => s.habits);
  const today = todayKey();
  const summary = useAppStore((s) => s.summaries[today]);
  const fmt = useNumberFormatter();

  useEffect(() => {
    if (!profile?.onboardingComplete) router.replace('/onboarding');
  }, [profile, router]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'home.greetingMorning';
    if (hour < 18) return 'home.greetingDay';
    return 'home.greetingEvening';
  }, []);

  const dailyHabits = useMemo(() => habits.filter((h) => h.frequency === 'daily'), [habits]);

  const rotating = useMemo(() => {
    if (dailyHabits.length === 0) return null;
    const habit = dailyHabits[dailyQuoteIndex(dailyHabits.length)];
    const narrative = getNarrative({ habit, t: (k, v) => t(k as any, v), fmt });
    const line = narrative.projectionLines[0];
    return { habit, line };
  }, [dailyHabits, t, fmt]);

  if (!profile) return null;

  const total = dailyHabits.length;
  const done = summary?.completedCount ?? 0;
  const rate = total === 0 ? 0 : done / total;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {t(greeting as any, { name: profile.name })}
          </h1>
          <p className="text-sm text-ink-500">{t('common.today')}</p>
        </div>
        <CompletionRing value={rate} size={72} stroke={8} label={t('common.today')} />
      </header>

      {rotating && (
        <Link href={`/habits/${rotating.habit.id}`} className="block">
          <Card className="border-leaf-200 bg-gradient-to-br from-leaf-50 to-white">
            <p className="text-xs uppercase tracking-wide text-leaf-700">
              {t('home.compoundOfDay')}
            </p>
            <p className="pt-1 leading-relaxed text-ink-800">{rotating.line}</p>
            <p className="pt-2 text-xs text-ink-500">
              {rotating.habit.name} ›
            </p>
          </Card>
        </Link>
      )}

      {profile.futureSelfVision && (
        <Card className="bg-gradient-to-br from-sand-50 to-white">
          <p className="text-xs uppercase tracking-wide text-sand-600">
            {t('home.futureSelfReminder')}
          </p>
          <p className="pt-1 text-sm leading-relaxed text-ink-700">{profile.futureSelfVision}</p>
        </Card>
      )}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">{t('home.todaysHabits')}</h2>
          <span className="numeral text-sm text-ink-500">
            {t('home.completed', { done, total })}
          </span>
        </div>
        <HabitChecklist habits={dailyHabits} />
        <Link
          href="/habits/new"
          className="tap-44 flex items-center justify-center rounded-xl border-2 border-dashed border-ink-300 px-4 py-3 text-sm text-ink-600 hover:border-leaf-400 hover:text-leaf-700"
        >
          + {t('home.addHabit')}
        </Link>
      </section>
    </div>
  );
}
