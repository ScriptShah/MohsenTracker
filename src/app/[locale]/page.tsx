'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { computeStrikes, shouldOfferRestart } from '@/lib/restart';
import { isRamadanModeActive, ramadanPhase } from '@/lib/hijri';
import { IftarCountdown } from '@/components/IftarCountdown';
import { AngerProtocol } from '@/components/AngerProtocol';
import { WorkspacesHomeSection } from '@/components/WorkspaceChecklist';
import { LevelUpCard } from '@/components/LevelUpCard';
import { eligibleLevelUps } from '@/lib/twoMinute';
import { getFireTrack } from '@/lib/streakFire';

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
  const allSummaries = useAppStore((s) => s.summaries);
  const lastRestartAt = useAppStore((s) => s.profile?.lastRestartAt);
  const restartStrikes = useMemo(
    () => computeStrikes(allSummaries, today, lastRestartAt, habits),
    [allSummaries, today, lastRestartAt, habits],
  );
  const offerRestart = useMemo(
    () => shouldOfferRestart({ strikes: restartStrikes, lastRestartAt, today }),
    [restartStrikes, lastRestartAt, today],
  );
  const fmt = useNumberFormatter();
  const angerProtocolEnabled = profile?.angerProtocolEnabled === true;
  const [showAnger, setShowAnger] = useState(false);
  const islamicCategoryId = useAppStore(
    (s) => s.categories.find((c) => c.key === 'islamic')?.id,
  );
  const angerTrack = useMemo(
    () => getFireTrack(profile, habits, islamicCategoryId),
    [profile, habits, islamicCategoryId],
  );

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
  const streaksMap = useAppStore((s) => s.streaks);
  const levelUpCandidate = useMemo(() => {
    const eligible = eligibleLevelUps(habits, streaksMap, new Date().toISOString());
    return eligible[0];
  }, [habits, streaksMap]);
  const levelUpStreak = levelUpCandidate
    ? streaksMap[levelUpCandidate.id]?.current ?? 0
    : 0;
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
        <div className="flex-1 space-y-1">
          <h1 className="text-xl font-semibold">
            {t(greeting as any, { name: profile.name })}
          </h1>
          <div className="flex items-center gap-2" data-tutorial="lives">
            {ramadanOn ? (
              <p className="numeral text-sm text-leaf-700">
                ☪ {t('ramadan.dayOf', { n: fmt(phase.dayOfRamadan ?? 1) })}
              </p>
            ) : (
              <p className="text-sm text-ink-500">{t('common.today')}</p>
            )}
            <Lives strikes={restartStrikes} />
          </div>
          <p className="text-xs text-ink-500">{t('home.livesCaption')}</p>
        </div>
        <div data-tutorial="ring">
          <CompletionRing value={rate} size={72} stroke={8} label={t('common.today')} />
        </div>
      </header>

      {offerRestart && (
        <Link href="/restart" className="block">
          <Card className="border-leaf-300 bg-gradient-to-br from-ink-900 via-leaf-900 to-leaf-700 text-white shadow-lg">
            <p className="text-xs uppercase tracking-[0.15em] text-leaf-200">
              {t('restart.homeBannerEyebrow')}
            </p>
            <p className="numeral pt-1 text-lg font-semibold leading-snug">
              {t('restart.homeBannerTitle', { strikes: fmt(restartStrikes) })}
            </p>
            <p className="pt-1 text-sm leading-relaxed text-leaf-50/90">
              {t('restart.homeBannerBody')}
            </p>
            <p className="inline-flex items-center gap-1 pt-2 text-sm font-medium text-leaf-100">
              {t('restart.homeBannerCta')} <ChevronEnd className="h-4 w-4" />
            </p>
          </Card>
        </Link>
      )}

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

      {angerProtocolEnabled && (
        <button
          type="button"
          onClick={() => setShowAnger(true)}
          className="tap-44 w-full rounded-2xl border border-sand-200 bg-sand-50 px-4 py-3 text-start transition hover:border-sand-300"
        >
          <p className="text-xs uppercase tracking-wide text-sand-600">
            {t(`angerProtocol.${angerTrack}.homeButtonEyebrow` as any)}
          </p>
          <p className="pt-1 text-sm font-medium leading-relaxed text-ink-800">
            {t('angerProtocol.homeButtonLabel')}
          </p>
        </button>
      )}

      {levelUpCandidate && (
        <LevelUpCard habit={levelUpCandidate} streak={levelUpStreak} />
      )}

      {rotating && (
        <Link href={`/habits/detail?id=${rotating.habit.id}`} className="block">
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
        <Link href={`/books/detail?id=${currentBook.id}`} className="block">
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
        <div data-tutorial="checklist">
          <HabitChecklist habits={dailyHabits} />
        </div>
        <Link
          href="/habits/new"
          className="tap-44 flex items-center justify-center rounded-xl border-2 border-dashed border-ink-300 px-4 py-3 text-sm text-ink-600 hover:border-leaf-400 hover:text-leaf-700"
        >
          + {t('home.addHabit')}
        </Link>
      </section>

      <div data-tutorial="workspaces">
        <WorkspacesHomeSection />
      </div>

      {showAnger && <AngerProtocol onClose={() => setShowAnger(false)} />}
    </div>
  );
}

/** Three-heart "lives" indicator. Drives off `computeStrikes` in
 *  `src/lib/restart.ts`: each past day with <50% completion costs a heart
 *  (including days the user never opened the app — those count as missed),
 *  three consecutive days at ≥50% earn one back. Strikes clamp to [0, 3].
 *  When all three are gone, the restart-smaller banner appears below the
 *  header. */
function Lives({ strikes }: { strikes: number }) {
  const t = useTranslations();
  const remaining = Math.max(0, 3 - strikes);
  return (
    <span
      className="inline-flex items-center gap-1 text-red-500"
      role="img"
      aria-label={t('home.livesAria', { remaining, total: 3 })}
      title={t('home.livesAria', { remaining, total: 3 })}
    >
      {[0, 1, 2].map((i) => (
        <Heart key={i} filled={i < remaining} />
      ))}
    </span>
  );
}

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 2}
      aria-hidden
    >
      <path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" strokeLinejoin="round" />
    </svg>
  );
}
