'use client';

import { useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, Link } from '@/i18n/routing';
import { Card } from '@/components/Card';
import { ChevronEnd } from '@/components/Chevron';
import { ClientGate } from '@/components/ClientGate';
import { HabitChecklist } from '@/components/HabitChecklist';
import { CompletionRing } from '@/components/CompletionRing';
import { BookCover } from '@/components/BookCover';
import { useAppStore } from '@/lib/store';
import { todayKey } from '@/lib/dates';
import { dailyQuoteIndex } from '@/lib/futureSelf';
import { getNarrative, recentAvgValue } from '@/lib/projections';
import { useNumberFormatter } from '@/lib/format';
import { isAudiobook, pagesRead, progressPercent } from '@/lib/books';
import { currentDay, stageFor } from '@/lib/reset';
import { isRamadanModeActive, ramadanPhase } from '@/lib/hijri';
import { IftarCountdown } from '@/components/IftarCountdown';

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
  const rewardsCount = useAppStore((s) => s.rewards.length);
  const punishmentsCount = useAppStore((s) => s.punishments.length);
  const currentBook = useAppStore((s) =>
    s.books
      .filter((b) => b.status === 'reading')
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))[0],
  );
  const activeReset = useAppStore((s) => s.resets.find((r) => r.status === 'active'));
  const fmt = useNumberFormatter();

  const phase = useMemo(() => ramadanPhase(), []);
  const ramadanOn = profile ? isRamadanModeActive(profile.ramadanMode) : false;
  const ensureRamadan = useAppStore((s) => s.ensureRamadanRecord);
  const currentRamadan = useAppStore((s) =>
    s.ramadan.find((r) => r.hijriYear === phase.hijri.year),
  );

  useEffect(() => {
    if (ramadanOn) ensureRamadan(phase.hijri.year);
  }, [ramadanOn, phase.hijri.year, ensureRamadan]);

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

  const allLogs = useAppStore((s) => s.logs);
  const rotating = useMemo(() => {
    if (dailyHabits.length === 0) return null;
    const habit = dailyHabits[dailyQuoteIndex(dailyHabits.length)];
    const recentAvg = recentAvgValue(habit, allLogs);
    const narrative = getNarrative({
      habit,
      t: (k, v) => t(k as any, v),
      fmt,
      recentAvg,
    });
    const line = narrative.projectionLines[0];
    return { habit, line };
  }, [dailyHabits, t, fmt, allLogs]);

  if (!profile) return null;

  const total = dailyHabits.length;
  const done = summary?.completedCount ?? 0;
  const rate = total === 0 ? 0 : done / total;

  return (
    <div
      className={`space-y-6${ramadanOn ? ' bg-gradient-to-b from-sand-50 via-transparent to-transparent' : ''}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {t(greeting as any, { name: profile.name })}
          </h1>
          {ramadanOn ? (
            <p className="numeral text-sm text-leaf-700">
              ☪ {t('ramadan.dayOf', { n: fmt(phase.dayOfRamadan ?? 1) })}
            </p>
          ) : (
            <p className="text-sm text-ink-500">{t('common.today')}</p>
          )}
        </div>
        <CompletionRing value={rate} size={72} stroke={8} label={t('common.today')} />
      </header>

      {ramadanOn && currentRamadan && (
        <Link href="/ramadan" className="block">
          <Card className="space-y-3 border-leaf-200 bg-gradient-to-br from-leaf-50 via-white to-sand-50">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-leaf-700">
              <span aria-hidden>🌙</span>
              <span>{t('ramadan.title')}</span>
            </div>
            <IftarCountdown iftarTime={currentRamadan.iftarTime} />
            <p className="text-sm text-leaf-700">{t('ramadan.openHub')} ›</p>
          </Card>
        </Link>
      )}

      {!ramadanOn && phase.phase === 'pre' && (
        <Link href="/ramadan" className="block">
          <Card className="border-sand-200 bg-sand-50">
            <p className="text-xs uppercase tracking-wide text-sand-600">
              {phase.daysUntilRamadan === 1
                ? t('ramadan.preBanner.titleOne')
                : t('ramadan.preBanner.title', {
                    n: fmt(phase.daysUntilRamadan ?? 14),
                  })}
            </p>
            <p className="pt-1 text-sm leading-relaxed text-ink-700">
              {t('ramadan.preBanner.body')}
            </p>
          </Card>
        </Link>
      )}

      {!ramadanOn && phase.phase === 'shawwal' && (
        <Link href="/ramadan" className="block">
          <Card className="border-sand-200 bg-sand-50">
            <p className="text-xs uppercase tracking-wide text-sand-600">
              {t('ramadan.shawwalBanner.title')}
            </p>
            <p className="pt-1 text-sm leading-relaxed text-ink-700">
              {t('ramadan.shawwalBanner.body')}
            </p>
          </Card>
        </Link>
      )}

      {rotating && (
        <Link href={`/habits/${rotating.habit.id}`} className="block">
          <Card className="border-leaf-200 bg-gradient-to-br from-leaf-50 to-white">
            <p className="text-xs uppercase tracking-wide text-leaf-700">
              {t('home.compoundOfDay')}
            </p>
            <p className="pt-1 leading-relaxed text-ink-800">{rotating.line}</p>
            <p className="inline-flex items-center gap-1 pt-2 text-xs text-ink-500">
              {rotating.habit.name} <ChevronEnd className="h-3 w-3" />
            </p>
          </Card>
        </Link>
      )}

      {rewardsCount === 0 && punishmentsCount === 0 && (
        <Link href="/rewards" className="block">
          <Card className="border-sand-200 bg-sand-50">
            <p className="text-xs uppercase tracking-wide text-sand-600">
              {t('rewards.homeBannerTitle')}
            </p>
            <p className="pt-1 text-sm leading-relaxed text-ink-700">
              {t('rewards.homeBannerBody')}
            </p>
            <p className="inline-flex items-center gap-1 pt-2 text-sm font-medium text-leaf-700">
              {t('rewards.homeBannerCta')} <ChevronEnd className="h-4 w-4" />
            </p>
          </Card>
        </Link>
      )}

      {activeReset ? (
        <Link href="/reset" className="block">
          <Card className="border-leaf-200 bg-gradient-to-br from-leaf-50 to-white">
            <p className="text-xs uppercase tracking-wide text-leaf-700">
              {t('reset.homeActiveTitle')} · {activeReset.target}
            </p>
            <p className="numeral pt-1 text-2xl font-semibold leading-none text-ink-900">
              {t('reset.dayCounter', {
                n: fmt(currentDay(activeReset)),
                total: fmt(activeReset.targetDays),
              })}
            </p>
            <p className="pt-1 text-xs text-ink-500">
              {t(`reset.stage.${stageFor(activeReset)}` as any)}
            </p>
          </Card>
        </Link>
      ) : (
        <Link href="/reset" className="block">
          <Card className="border-sand-200 bg-sand-50">
            <p className="text-xs uppercase tracking-wide text-sand-600">
              {t('reset.homeStartCta')}
            </p>
            <p className="pt-1 text-sm leading-relaxed text-ink-700">
              {t('reset.homeStartBody')}
            </p>
            <p className="inline-flex items-center gap-1 pt-2 text-sm font-medium text-leaf-700">
              {t('reset.title')} <ChevronEnd className="h-4 w-4" />
            </p>
          </Card>
        </Link>
      )}

      {currentBook && (
        <Link href={`/books/${currentBook.id}`} className="block">
          <Card className="flex items-center gap-3 transition hover:border-ink-300">
            <BookCover book={currentBook} size="sm" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-xs uppercase tracking-wide text-leaf-700">
                {t('books.feature.homeReadingTitle')}
              </p>
              <p className="line-clamp-1 font-medium">{currentBook.title}</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                <div
                  className="h-full bg-leaf-500 transition-all"
                  style={{
                    width: `${Math.round(progressPercent(currentBook) * 100)}%`,
                  }}
                />
              </div>
              <p className="numeral text-[11px] text-ink-500">
                {t(
                  isAudiobook(currentBook)
                    ? 'books.progressShortMinutes'
                    : 'books.progressShort',
                  {
                    read: fmt(pagesRead(currentBook)),
                    total: fmt(currentBook.totalPages),
                  },
                )}
              </p>
            </div>
            <ChevronEnd className="h-4 w-4 text-ink-300" />
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
