'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';
import { useAppStore } from '@/lib/store';
import {
  dateKey,
  parseDateKey,
  previousDayKey,
  nextDayKey,
  todayKey,
} from '@/lib/dates';
import { isLogSuccessful } from '@/lib/streaks';
import { useNumberFormatter } from '@/lib/format';
import { useUnitLabel } from '@/lib/units';
import { Button } from './Button';

/** "Time travel" sheet for back-logging habits the user forgot to
 *  tick yesterday (or earlier). Opens as a modal from Home. The user
 *  pages backwards through days with prev / next buttons (or a native
 *  date picker for big jumps), sees only the habits that already
 *  existed on the chosen day (filtered by `createdAt`), and can
 *  toggle each one — the store's `toggleHabit(id, date)` already
 *  supports back-dated writes, this is just the UI surface.
 *
 *  Floor: the earliest habit's createdAt — can't log a habit before
 *  it existed. Ceiling: yesterday — today is handled by the regular
 *  Home checklist; this sheet is for "I missed something previously."
 *
 *  Closes back to Home; never replaces it. Whatever you tick here
 *  flows into streaks, summaries, the heatmap, the overall fire,
 *  and the next cloud-sync push, exactly as if you'd ticked it on
 *  the actual day. */
export function PastDayLogger({ onClose }: { onClose: () => void }) {
  const t = useTranslations();
  const fmt = useNumberFormatter();
  const unitLabel = useUnitLabel();
  const habits = useAppStore((s) => s.habits);
  const toggleHabit = useAppStore((s) => s.toggleHabit);

  const today = todayKey();
  /** Earliest habit `createdAt` (YYYY-MM-DD). Anything before this is
   *  irrelevant — no habits existed yet, nothing to log. */
  const floorDate = useMemo(() => {
    if (habits.length === 0) return today;
    return habits
      .map((h) => h.createdAt.slice(0, 10))
      .sort()[0]!;
  }, [habits, today]);

  // Default to yesterday — by far the most common "I forgot" case.
  const [picked, setPicked] = useState<string>(() => {
    const yesterday = previousDayKey(today);
    return yesterday >= floorDate ? yesterday : floorDate;
  });

  /** Habits that existed on the picked date (createdAt <= picked).
   *  Filtering on this side instead of in the store means the user
   *  doesn't see a "Read 10 pages" row for a day before they created
   *  that habit. */
  const habitsForDate = useMemo(
    () =>
      habits.filter(
        (h) => h.createdAt.slice(0, 10) <= picked && h.frequency === 'daily',
      ),
    [habits, picked],
  );

  // Logs for the picked date. We read directly from the store rather
  // than via a memoised selector so toggling re-renders instantly.
  const logs = useAppStore((s) => s.logs[picked] ?? {});

  const canGoPrev = picked > floorDate;
  const canGoNext = picked < previousDayKey(today); // can't reach today

  const goPrev = () => {
    if (!canGoPrev) return;
    setPicked(previousDayKey(picked));
  };
  const goNext = () => {
    if (!canGoNext) return;
    setPicked(nextDayKey(picked));
  };

  const onDateInput = (value: string) => {
    // Native <input type="date"> emits YYYY-MM-DD already, so no
    // re-formatting needed. Clamp to [floor, yesterday].
    const yesterday = previousDayKey(today);
    if (value < floorDate) setPicked(floorDate);
    else if (value > yesterday) setPicked(yesterday);
    else setPicked(value);
  };

  const friendlyDate = useMemo(() => {
    const d = parseDateKey(picked);
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [picked]);

  const yesterday = previousDayKey(today);
  const isYesterday = picked === yesterday;
  const daysAgo = useMemo(() => {
    const a = parseDateKey(today).getTime();
    const b = parseDateKey(picked).getTime();
    return Math.round((a - b) / (24 * 60 * 60 * 1000));
  }, [today, picked]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="past-day-title"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/60 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-screen-sm flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — sticky so the date stays visible while scrolling */}
        <div className="border-b border-ink-200 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wide text-ink-500">
                {t('pastDay.title')}
              </p>
              <h2 id="past-day-title" className="pt-0.5 text-lg font-semibold text-ink-900">
                {friendlyDate}
              </h2>
              <p className="numeral pt-0.5 text-xs text-ink-500">
                {isYesterday
                  ? t('pastDay.yesterday')
                  : t('pastDay.daysAgo', { n: fmt(daysAgo) })}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('pastDay.close')}
              className="tap-44 -mt-1 -me-1 flex h-9 w-9 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-800"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={goPrev}
              disabled={!canGoPrev}
              aria-label={t('pastDay.prev')}
              className="tap-44 flex h-9 w-9 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-700 hover:border-ink-300 disabled:opacity-40"
            >
              ‹
            </button>
            <input
              type="date"
              value={picked}
              min={floorDate}
              max={yesterday}
              onChange={(e) => onDateInput(e.target.value)}
              className="numeral flex-1 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-leaf-500"
              aria-label={t('pastDay.datePicker')}
            />
            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext}
              aria-label={t('pastDay.next')}
              className="tap-44 flex h-9 w-9 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-700 hover:border-ink-300 disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>

        {/* Body — scrollable list of habits for the picked day */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {habitsForDate.length === 0 ? (
            <p className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-3 text-sm text-ink-700">
              {t('pastDay.empty')}
            </p>
          ) : (
            <ul className="space-y-2">
              {habitsForDate.map((habit) => {
                const log = logs[habit.id];
                const done = isLogSuccessful(habit, log);
                return (
                  <li key={habit.id}>
                    <button
                      type="button"
                      onClick={() => toggleHabit(habit.id, picked)}
                      aria-pressed={done}
                      className={clsx(
                        'tap-44 flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-start transition',
                        done
                          ? 'border-leaf-500 bg-leaf-50'
                          : 'border-ink-200 bg-white hover:border-ink-300',
                      )}
                    >
                      <PastDayCheck active={done} />
                      <span className="flex-1">
                        <span className={clsx('block font-medium', done && 'text-leaf-800')}>
                          {habit.name}
                        </span>
                        {habit.type === 'good' && habit.unit && habit.target !== undefined && (
                          <span className="numeral block text-xs text-ink-500">
                            {fmt(habit.target)} {unitLabel(habit.unit)}
                          </span>
                        )}
                        {habit.type === 'bad' && habit.unit && habit.limit !== undefined && (
                          <span className="numeral block text-xs text-ink-500">
                            ≤ {fmt(habit.limit)} {unitLabel(habit.unit)}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer — explicit "back to today" close button so the user
            knows how to return after time-travelling. */}
        <div className="border-t border-ink-200 px-4 py-3">
          <Button type="button" onClick={onClose} className="w-full">
            {t('pastDay.backToToday')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PastDayCheck({ active }: { active: boolean }) {
  return (
    <span
      className={clsx(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition',
        active ? 'border-leaf-600 bg-leaf-600 text-white' : 'border-ink-300 bg-white',
      )}
      aria-hidden
    >
      {active && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-5 w-5">
          <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}
