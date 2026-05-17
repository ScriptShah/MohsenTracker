'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, Link } from '@/i18n/routing';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ArrowBack, ChevronEnd } from '@/components/Chevron';
import { ClientGate } from '@/components/ClientGate';
import { BookCover } from '@/components/BookCover';
import { LevelUpCard } from '@/components/LevelUpCard';
import { useAppStore } from '@/lib/store';
import { getNarrative, recentAvgValue } from '@/lib/projections';
import { useNumberFormatter } from '@/lib/format';
import { shouldMuteConsequences } from '@/lib/sensitivity';
import { isAudiobook, pagesRead, progressPercent } from '@/lib/books';
import { useUnitLabel } from '@/lib/units';
import { todayKey } from '@/lib/dates';
import { isLevelUpEligible } from '@/lib/twoMinute';
import type { Book, ConsequenceSensitivity, Habit } from '@/domain/types';

function sliceForSensitivity(
  lines: string[],
  level: ConsequenceSensitivity,
): string[] {
  if (level === 'off') return [];
  if (level === 'mild') return lines.slice(0, 1);
  return lines;
}

export default function HabitDetailPage() {
  // See note on /books/detail — useSearchParams needs a Suspense boundary
  // in Next.js 14 to avoid bailing the whole route to client rendering.
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <HabitDetail />
      </Suspense>
    </ClientGate>
  );
}

function HabitDetail() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const id = useSearchParams().get('id') ?? '';
  const habit = useAppStore((s) => s.habits.find((h) => h.id === id));
  const streak = useAppStore((s) => s.streaks[id]?.current ?? 0);
  const category = useAppStore((s) =>
    habit ? s.categories.find((c) => c.id === habit.categoryId) : undefined,
  );
  const habits = useAppStore((s) => s.habits);
  const replacementOut = useMemo(
    () =>
      habit?.replacementHabitId
        ? habits.find((h) => h.id === habit.replacementHabitId)
        : undefined,
    [habit?.replacementHabitId, habits],
  );
  const replacementIn = useMemo(
    () => (habit ? habits.find((h) => h.replacementHabitId === habit.id) : undefined),
    [habit, habits],
  );
  const deleteHabit = useAppStore((s) => s.deleteHabit);
  const setHabitCritical = useAppStore((s) => s.setHabitCritical);
  const setHabitPositiveCargo = useAppStore((s) => s.setHabitPositiveCargo);
  const setHabitRituals = useAppStore((s) => s.setHabitRituals);
  const sensitivity = useAppStore(
    (s) => s.profile?.consequenceSensitivity ?? 'honest',
  );
  const resets = useAppStore((s) => s.resets);
  const muteVerdict = useMemo(() => shouldMuteConsequences(resets), [resets]);
  const stakesAvailable = sensitivity !== 'off' && !muteVerdict.muted;

  const allLogs = useAppStore((s) => s.logs);

  const fmt = useNumberFormatter();
  const unitLabel = useUnitLabel();
  const [showStakesRaw, setShowStakes] = useState(false);
  const showStakes = showStakesRaw && stakesAvailable;

  const narrative = useMemo(() => {
    if (!habit) return null;
    const recentAvg = recentAvgValue(habit, allLogs);
    return getNarrative({
      habit,
      t: (k, v) => t(k as any, v),
      fmt,
      recentAvg,
    });
  }, [habit, t, fmt, allLogs]);

  if (!habit) {
    return (
      <div className="space-y-3">
        <Link href="/categories" className="text-leaf-700 underline">
          {t('common.back')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href={category ? `/categories/detail?id=${category.id}` : '/categories'}
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"
      >
        <ArrowBack /> {category?.name ?? t('common.back')}
      </Link>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold leading-tight">{habit.name}</h1>
        <div className="flex items-center gap-3 text-sm text-ink-600">
          {streak > 0 ? (
            <span className="rounded-full bg-sand-100 px-2 py-1 text-sand-600">
              🔥{' '}
              <span className="numeral">{fmt(streak)}</span>{' '}
              {t('habitDetail.currentStreak').toLowerCase()}
            </span>
          ) : (
            <span className="text-ink-500">{t('habitDetail.noStreakYet')}</span>
          )}
          {habit.unit &&
            (habit.type === 'good' && habit.target !== undefined ? (
              <span className="numeral text-ink-500">
                {t('habitDetail.dailyTarget', {
                  value: fmt(habit.target),
                  unit: unitLabel(habit.unit),
                })}
              </span>
            ) : habit.type === 'bad' && habit.limit !== undefined ? (
              <span className="numeral text-ink-500">
                {t('habitDetail.dailyLimit', {
                  value: fmt(habit.limit),
                  unit: unitLabel(habit.unit),
                })}
              </span>
            ) : null)}
        </div>
      </header>

      {habit.isTwoMinuteVersion && isLevelUpEligible(habit, streak, new Date().toISOString()) && (
        <LevelUpCard habit={habit} streak={streak} />
      )}

      {(replacementOut || replacementIn) && (
        <Card className={
          habit.type === 'bad'
            ? 'border-leaf-200 bg-leaf-50'
            : 'border-sand-200 bg-sand-50'
        }>
          <p className={`text-xs uppercase tracking-wide ${
            habit.type === 'bad' ? 'text-leaf-700' : 'text-sand-700'
          }`}>
            {replacementOut
              ? t('habitDetail.replacement.replaceWith')
              : t('habitDetail.replacement.replacementFor')}
          </p>
          <Link
            href={`/habits/detail?id=${(replacementOut ?? replacementIn)!.id}`}
            className="mt-1 flex items-center justify-between gap-3 rounded-lg hover:opacity-80"
          >
            <span className="text-base font-medium text-ink-800">
              {(replacementOut ?? replacementIn)!.name}
            </span>
            <ChevronEnd className="h-4 w-4 text-ink-500" />
          </Link>
          {replacementOut && (
            <p className="pt-2 text-xs text-ink-600">
              {t('habitDetail.replacement.body')}
            </p>
          )}
        </Card>
      )}

      {habit.type === 'bad' && (
        <CargoCard
          cargo={habit.positiveCargo}
          onSave={(v) => setHabitPositiveCargo(habit.id, v)}
        />
      )}

      {narrative && (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-ink-800">
            {showStakes ? t('habitDetail.atStake') : t('habitDetail.ifYouKeep')}
          </h2>
          {!showStakes && narrative.paceDriven && narrative.recentAvg !== undefined && (
            <p className="numeral text-xs text-leaf-700">
              {t(
                habit.unit
                  ? 'habitDetail.paceLabel'
                  : 'habitDetail.paceLabelNoUnit',
                {
                  avg: fmt(Math.round(narrative.recentAvg)),
                  unit: unitLabel(habit.unit),
                },
              )}
            </p>
          )}
          <ul className="space-y-2 text-ink-700">
            {(showStakes
              ? sliceForSensitivity(narrative.consequenceLines, sensitivity)
              : narrative.projectionLines
            ).map((line, i) => (
              <li key={i} className="flex gap-2">
                <span
                  aria-hidden
                  className={`mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                    showStakes ? 'bg-red-500' : 'bg-leaf-500'
                  }`}
                />
                <span
                  className={`leading-relaxed ${
                    showStakes && sensitivity === 'full' ? 'font-medium text-red-800' : ''
                  }`}
                >
                  {line}
                </span>
              </li>
            ))}
          </ul>

          {/* Spec §21.10: every consequence pairs with a reversal so the user
              never lands on despair. */}
          {showStakes && narrative.reversalLines.length > 0 && (
            <div className="rounded-xl border-s-2 border-leaf-400 bg-leaf-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
                {t('habitDetail.reversalLabel')}
              </p>
              <ul className="mt-1 space-y-1.5 text-sm text-ink-800">
                {narrative.reversalLines.map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span
                      aria-hidden
                      className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-leaf-500"
                    />
                    <span className="leading-relaxed">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {muteVerdict.muted && sensitivity !== 'off' && (
            <p className="rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-xs text-sand-700">
              {t(`habitDetail.muted.${muteVerdict.reason}` as any)}
            </p>
          )}

          {stakesAvailable && (
            <button
              type="button"
              onClick={() => setShowStakes((s) => !s)}
              className="text-sm font-medium text-leaf-700 underline-offset-4 hover:underline"
            >
              {showStakes
                ? t('habitDetail.showGain')
                : t('habitDetail.showLoss')}
            </button>
          )}
        </Card>
      )}

      {narrative?.hadith && (
        <Card className="border-sand-200 bg-sand-50">
          <p className="text-xs uppercase tracking-wide text-sand-600">
            {t('habitDetail.hadithLabel')}
          </p>
          <p className="pt-1 leading-relaxed text-ink-800">{narrative.hadith.text}</p>
          <p className="pt-2 text-xs text-ink-500">— {narrative.hadith.source}</p>
        </Card>
      )}

      <BracketingCard
        startRitual={habit.startRitual}
        endRitual={habit.endRitual}
        onSave={(start, end) =>
          setHabitRituals(habit.id, { startRitual: start, endRitual: end })
        }
      />

      <BooksSection habit={habit} />

      <Card className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="text-sm font-medium text-ink-800">
            {t('habitDetail.criticalToggle')}
          </div>
          <p className="text-xs text-ink-500">{t('habitDetail.criticalHint')}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!!habit.isCritical}
          onClick={() => setHabitCritical(habit.id, !habit.isCritical)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${
            habit.isCritical ? 'bg-red-500' : 'bg-ink-200'
          }`}
        >
          <span
            className={`toggle-knob absolute top-0.5 h-5 w-5 rounded-full shadow transition-all ${
              habit.isCritical ? 'start-[22px]' : 'start-0.5'
            }`}
            aria-hidden
          />
        </button>
      </Card>

      <div className="pt-2">
        <Button
          variant="ghost"
          onClick={() => {
            if (!confirm(t('habitDetail.deleteHabit') + '?')) return;
            deleteHabit(habit.id);
            router.replace(category ? `/categories/detail?id=${category.id}` : '/');
          }}
          className="text-red-600 hover:bg-red-50"
        >
          {t('habitDetail.deleteHabit')}
        </Button>
      </div>
    </div>
  );
}

/** Spec §24.2: the "positive cargo" — a small good deed the user commits to
 *  do right after a slip on a bad habit. Hebbian-plasticity-pair: pair the bad
 *  cue with a good response so the brain learns the linkage. The Quranic
 *  anchor 11:114 makes the pairing concrete.
 */
function CargoCard({
  cargo,
  onSave,
}: {
  cargo?: string;
  onSave: (v: string | undefined) => void;
}) {
  const t = useTranslations();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cargo ?? '');

  // Keep the draft in sync if the underlying cargo changes (e.g. cleared
  // elsewhere) and we're not mid-edit.
  useEffect(() => {
    if (!editing) setDraft(cargo ?? '');
  }, [cargo, editing]);

  const startEdit = () => {
    setDraft(cargo ?? '');
    setEditing(true);
  };

  const save = () => {
    const trimmed = draft.trim();
    onSave(trimmed.length > 0 ? trimmed : undefined);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(cargo ?? '');
    setEditing(false);
  };

  const clear = () => {
    onSave(undefined);
    setDraft('');
    setEditing(false);
  };

  if (editing) {
    return (
      <Card className="space-y-3 border-leaf-200 bg-leaf-50">
        <p className="text-xs uppercase tracking-wide text-leaf-700">
          {t('habitDetail.cargo.editLabel')}
        </p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('habitDetail.cargo.editPlaceholder')}
          maxLength={140}
          rows={3}
          autoFocus
          className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-leaf-500"
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          {cargo && (
            <Button type="button" variant="ghost" onClick={clear} className="text-red-600 hover:bg-red-50">
              {t('habitDetail.cargo.clear')}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={cancel}>
            {t('habitDetail.cargo.cancel')}
          </Button>
          <Button type="button" onClick={save}>
            {t('habitDetail.cargo.save')}
          </Button>
        </div>
      </Card>
    );
  }

  if (!cargo) {
    return (
      <Card className="space-y-2 border-sand-200 bg-sand-50">
        <p className="text-xs uppercase tracking-wide text-sand-700">
          {t('habitDetail.cargo.emptyTitle')}
        </p>
        <p className="text-sm leading-relaxed text-ink-700">
          {t('habitDetail.cargo.emptyBody')}
        </p>
        <div className="pt-1">
          <Button type="button" onClick={startEdit}>
            {t('habitDetail.cargo.set')}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-3 border-leaf-200 bg-leaf-50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1">
          <p className="text-xs uppercase tracking-wide text-leaf-700">
            {t('habitDetail.cargo.title')}
          </p>
          <p className="text-base font-medium leading-relaxed text-ink-800">
            {cargo}
          </p>
          <p className="text-xs text-ink-600">
            {t('habitDetail.cargo.body')}
          </p>
        </div>
        <button
          type="button"
          onClick={startEdit}
          className="text-sm font-medium text-leaf-700 underline-offset-4 hover:underline"
        >
          {t('habitDetail.cargo.edit')}
        </button>
      </div>
      <div className="rounded-xl border-s-2 border-leaf-400 bg-white px-3 py-2">
        <p dir="rtl" lang="ar" className="text-base leading-relaxed text-ink-800">
          {t('habitDetail.cargo.verseArabic')}
        </p>
        <p className="pt-1 text-sm text-ink-600">
          {t('habitDetail.cargo.verseTranslation')}
        </p>
        <p className="pt-1 text-[11px] uppercase tracking-wide text-ink-400">
          {t('habitDetail.cargo.verseSource')}
        </p>
      </div>
    </Card>
  );
}

/** Spec §20.11: a habit flagged linksToBooks pulls its daily total from
 *  book-page logs. Multiple reading habits can co-exist — each one shows the
 *  subset of books with `book.habitId === habit.id` (and unassigned books).
 *  Eligibility for the connect CTA: presetKey === 'reading'.
 */
function BooksSection({ habit }: { habit: Habit }) {
  const t = useTranslations();
  const setReadingHabit = useAppStore((s) => s.setReadingHabit);
  const books = useAppStore((s) => s.books);

  const isLinked = habit.linksToBooks === true;
  // Any pages-based good habit can become a reading habit. This is what lets
  // the user keep a second "Read Quran" habit in Islamic alongside the main
  // "Read 10 pages" preset in Growth, each with its own book list.
  const isCandidate =
    habit.presetKey === 'reading' ||
    (habit.type === 'good' && habit.unit === 'pages');

  if (!isLinked && !isCandidate) return null;

  if (!isLinked) {
    return (
      <Card className="space-y-3 border-sand-200 bg-sand-50">
        <div>
          <p className="text-xs uppercase tracking-wide text-sand-600">
            {t('habitDetail.books.connectTitle')}
          </p>
          <p className="pt-1 text-sm leading-relaxed text-ink-700">
            {t('habitDetail.books.connectBody')}
          </p>
        </div>
        <Button type="button" onClick={() => setReadingHabit(habit.id)}>
          {t('habitDetail.books.connect')}
        </Button>
      </Card>
    );
  }

  const reading = books.filter(
    (b) =>
      b.status === 'reading' &&
      (b.habitId === habit.id || b.habitId === undefined),
  );

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-ink-800">
          {t('habitDetail.books.title')}
        </h2>
        <p className="text-xs text-ink-500">{t('habitDetail.books.subtitle')}</p>
      </div>

      {reading.length === 0 ? (
        <p className="text-sm text-ink-500">{t('habitDetail.books.noActive')}</p>
      ) : (
        <ul className="space-y-2">
          {reading.map((b) => (
            <li key={b.id}>
              <BookLogRow book={b} />
            </li>
          ))}
        </ul>
      )}

      <Link
        href={`/books/new?habitId=${habit.id}`}
        className="tap-44 flex items-center justify-center rounded-xl border-2 border-dashed border-ink-300 px-4 py-3 text-sm text-ink-600 hover:border-leaf-400 hover:text-leaf-700"
      >
        + {t('habitDetail.books.addBook')}
      </Link>
    </Card>
  );
}

function BookLogRow({ book }: { book: Book }) {
  const t = useTranslations();
  const fmt = useNumberFormatter();
  const logBookPages = useAppStore((s) => s.logBookPages);

  const [value, setValue] = useState('');

  useEffect(() => {
    const v = book.pagesByDate[todayKey()];
    setValue(v ? String(v) : '');
  }, [book.id, book.pagesByDate]);

  const read = pagesRead(book);
  const pct = progressPercent(book);
  const audio = isAudiobook(book);
  const progressKey = audio ? 'books.progressShortMinutes' : 'books.progressShort';

  const onLog = () => {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    logBookPages(book.id, n);
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white p-2">
      <Link href={`/books/detail?id=${book.id}`} className="shrink-0">
        <BookCover book={book} size="sm" />
      </Link>
      <div className="min-w-0 flex-1 space-y-1">
        <Link
          href={`/books/detail?id=${book.id}`}
          className="line-clamp-1 text-sm font-medium hover:text-leaf-700"
        >
          {book.title}
        </Link>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
          <div
            className="h-full bg-leaf-500 transition-all"
            style={{ width: `${Math.round(pct * 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-ink-500">
          <span className="numeral">
            {t(progressKey, {
              read: fmt(read),
              total: fmt(book.totalPages),
            })}
          </span>
          <Link
            href={`/books/detail?id=${book.id}`}
            className="inline-flex items-center gap-0.5 text-leaf-700 hover:underline"
          >
            {t('habitDetail.books.openBook')}
            <ChevronEnd className="h-3 w-3" />
          </Link>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          placeholder={t('habitDetail.books.logPlaceholder')}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="numeral w-16 rounded-lg border border-ink-200 px-2 py-1.5 text-sm outline-none focus:border-leaf-500"
        />
        <Button type="button" onClick={onLog} className="px-3 py-1.5 text-xs">
          {t('habitDetail.books.logSave')}
        </Button>
      </div>
    </div>
  );
}

/** Spec §24.1: optional start + end rituals the user does every time they do
 *  this habit. Habit-formation research calls this "task bracketing" — the
 *  repeated bookends teach the brain to flip into the habit on cue and flip
 *  out cleanly when it's done. Either field can stand alone (or both, or
 *  neither — it's optional).
 */
function BracketingCard({
  startRitual,
  endRitual,
  onSave,
}: {
  startRitual?: string;
  endRitual?: string;
  onSave: (start: string | undefined, end: string | undefined) => void;
}) {
  const t = useTranslations();
  const [editing, setEditing] = useState(false);
  const [draftStart, setDraftStart] = useState(startRitual ?? '');
  const [draftEnd, setDraftEnd] = useState(endRitual ?? '');

  useEffect(() => {
    if (!editing) {
      setDraftStart(startRitual ?? '');
      setDraftEnd(endRitual ?? '');
    }
  }, [startRitual, endRitual, editing]);

  const startEdit = () => {
    setDraftStart(startRitual ?? '');
    setDraftEnd(endRitual ?? '');
    setEditing(true);
  };

  const save = () => {
    const s = draftStart.trim();
    const e = draftEnd.trim();
    onSave(s.length > 0 ? s : undefined, e.length > 0 ? e : undefined);
    setEditing(false);
  };

  const cancel = () => {
    setDraftStart(startRitual ?? '');
    setDraftEnd(endRitual ?? '');
    setEditing(false);
  };

  const clearBoth = () => {
    onSave(undefined, undefined);
    setDraftStart('');
    setDraftEnd('');
    setEditing(false);
  };

  const hasAny = Boolean(startRitual || endRitual);

  if (editing) {
    return (
      <Card className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-ink-600">
          {t('habitDetail.bracketing.title')}
        </p>
        <label className="block space-y-1.5">
          <span className="block text-sm font-medium text-ink-700">
            {t('habitDetail.bracketing.startLabel')}
          </span>
          <textarea
            value={draftStart}
            onChange={(e) => setDraftStart(e.target.value)}
            placeholder={t('habitDetail.bracketing.startPlaceholder')}
            maxLength={140}
            rows={2}
            className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-leaf-500"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="block text-sm font-medium text-ink-700">
            {t('habitDetail.bracketing.endLabel')}
          </span>
          <textarea
            value={draftEnd}
            onChange={(e) => setDraftEnd(e.target.value)}
            placeholder={t('habitDetail.bracketing.endPlaceholder')}
            maxLength={140}
            rows={2}
            className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-leaf-500"
          />
        </label>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {hasAny && (
            <Button
              type="button"
              variant="ghost"
              onClick={clearBoth}
              className="text-red-600 hover:bg-red-50"
            >
              {t('habitDetail.bracketing.clear')}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={cancel}>
            {t('habitDetail.bracketing.cancel')}
          </Button>
          <Button type="button" onClick={save}>
            {t('habitDetail.bracketing.save')}
          </Button>
        </div>
      </Card>
    );
  }

  if (!hasAny) {
    return (
      <Card className="space-y-2 border-sand-200 bg-sand-50">
        <p className="text-xs uppercase tracking-wide text-sand-700">
          {t('habitDetail.bracketing.emptyTitle')}
        </p>
        <p className="text-sm leading-relaxed text-ink-700">
          {t('habitDetail.bracketing.emptyBody')}
        </p>
        <div className="pt-1">
          <Button type="button" onClick={startEdit}>
            {t('habitDetail.bracketing.set')}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wide text-ink-600">
            {t('habitDetail.bracketing.title')}
          </p>
          <p className="pt-1 text-xs text-ink-500">
            {t('habitDetail.bracketing.body')}
          </p>
        </div>
        <button
          type="button"
          onClick={startEdit}
          className="text-sm font-medium text-leaf-700 underline-offset-4 hover:underline"
        >
          {t('habitDetail.bracketing.edit')}
        </button>
      </div>
      <div className="space-y-2">
        {startRitual && (
          <div className="rounded-xl border-s-2 border-leaf-400 bg-leaf-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-leaf-700">
              {t('habitDetail.bracketing.startTitle')}
            </p>
            <p className="pt-0.5 text-sm leading-relaxed text-ink-800">
              {startRitual}
            </p>
          </div>
        )}
        {endRitual && (
          <div className="rounded-xl border-s-2 border-sand-400 bg-sand-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-sand-700">
              {t('habitDetail.bracketing.endTitle')}
            </p>
            <p className="pt-0.5 text-sm leading-relaxed text-ink-800">
              {endRitual}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
