'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import type { Habit } from '@/domain/types';
import { useAppStore } from '@/lib/store';
import { todayKey } from '@/lib/dates';
import { isLogSuccessful } from '@/lib/streaks';
import { useLiveCounts } from '@/lib/useLiveCounts';
import { useNumberFormatter } from '@/lib/format';
import { useUnitLabel } from '@/lib/units';
import { ChevronEnd } from './Chevron';
import { BookLogSheet } from './BookLogSheet';
import { CargoSlipSheet } from './CargoSlipSheet';

export function HabitChecklist({ habits }: { habits: Habit[] }) {
  const t = useTranslations();
  const fmt = useNumberFormatter();
  const today = todayKey();
  const logs = useAppStore((s) => s.logs[today] ?? {});
  const streaks = useAppStore((s) => s.streaks);
  const toggleHabit = useAppStore((s) => s.toggleHabit);
  const setReadingHabit = useAppStore((s) => s.setReadingHabit);
  const liveCounts = useLiveCounts();
  const unitLabel = useUnitLabel();

  const [showDone, setShowDone] = useState(false);
  const [bookSheetHabitId, setBookSheetHabitId] = useState<string | null>(null);
  const [cargoSlip, setCargoSlip] = useState<{ habitId: string; cargo: string } | null>(null);

  const isReadingHabit = (h: Habit) =>
    h.linksToBooks === true || h.presetKey === 'reading';

  const onCheck = (habit: Habit) => {
    if (isReadingHabit(habit)) {
      // Auto-link the books module the first time the user taps a reading
      // preset's check, so future book-page logs flow into this habit's
      // daily total + streak (spec §20.11).
      if (!habit.linksToBooks && habit.presetKey === 'reading') {
        setReadingHabit(habit.id);
      }
      setBookSheetHabitId(habit.id);
      return;
    }

    // Spec §24.2: bad-habit slips pair with the "positive cargo." Capture
    // the pre-toggle success state, then read post-toggle from the store
    // (the selector won't have re-rendered yet inside this handler).
    const wasSuccessful = isLogSuccessful(habit, logs[habit.id]);
    toggleHabit(habit.id);
    if (habit.type === 'bad' && habit.positiveCargo?.trim()) {
      const after = useAppStore.getState().logs[today]?.[habit.id];
      const isNowSuccessful = isLogSuccessful(habit, after);
      if (wasSuccessful && !isNowSuccessful) {
        setCargoSlip({ habitId: habit.id, cargo: habit.positiveCargo.trim() });
      }
    }
  };

  if (habits.length === 0) {
    return <p className="text-ink-500">{t('home.noHabits')}</p>;
  }

  const pending: Habit[] = [];
  const done: Habit[] = [];
  for (const h of habits) {
    if (isLogSuccessful(h, logs[h.id])) done.push(h);
    else pending.push(h);
  }

  const visibleHabits = showDone ? habits : pending;

  return (
    <div className="space-y-2">
      {pending.length === 0 && !showDone && (
        <p className="rounded-xl border border-leaf-200 bg-leaf-50 px-3 py-2 text-sm text-leaf-700">
          {t('home.allDone')}
        </p>
      )}
      <ul className="space-y-2">
      {visibleHabits.map((habit) => {
        const log = logs[habit.id];
        const done = isLogSuccessful(habit, log);
        const streak = streaks[habit.id]?.current ?? 0;
        const liveCount =
          habit.type === 'good' && habit.presetKey
            ? liveCounts[habit.presetKey] ?? 0
            : 0;
        return (
          <li key={habit.id}>
            <Link
              href={`/habits/detail?id=${habit.id}`}
              className={clsx(
                'tap-44 flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-start transition',
                done
                  ? 'border-leaf-500 bg-leaf-50'
                  : 'border-ink-200 bg-white hover:border-ink-300',
              )}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCheck(habit);
                }}
                aria-pressed={done}
                aria-label={
                  done
                    ? `${habit.name} — ${t('common.done')}`
                    : `${habit.name} — ${t('common.add')}`
                }
                className="tap-44 -m-2 flex items-center justify-center p-2"
              >
                <Checkmark active={done} />
              </button>
              <span className="flex-1">
                <span className={clsx('block font-medium', done && 'text-leaf-800')}>
                  {habit.name}
                </span>
                {habit.type === 'good' && habit.unit && habit.target !== undefined && (
                  <span className="block text-xs text-ink-500">
                    {log && log.value > 0 ? (
                      <>
                        <span
                          className={clsx(
                            'numeral',
                            log.value > habit.target && 'font-semibold text-leaf-700',
                          )}
                        >
                          {log.value}
                        </span>{' '}
                        / <span className="numeral">{habit.target}</span> {unitLabel(habit.unit)}
                        {log.value > habit.target && (
                          <span className="ms-1 text-leaf-600" aria-hidden>
                            ✨
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="numeral">{habit.target}</span> {unitLabel(habit.unit)}
                      </>
                    )}
                  </span>
                )}
                {habit.type === 'bad' && habit.unit && habit.limit !== undefined && (
                  <span className="block text-xs text-ink-500">
                    {log && log.value > 0 ? (
                      <>
                        <span
                          className={clsx(
                            'numeral',
                            log.value > habit.limit && 'font-semibold text-red-600',
                          )}
                        >
                          {log.value}
                        </span>{' '}
                        / ≤ <span className="numeral">{habit.limit}</span> {unitLabel(habit.unit)}
                      </>
                    ) : (
                      <>
                        ≤ <span className="numeral">{habit.limit}</span> {unitLabel(habit.unit)}
                      </>
                    )}
                  </span>
                )}
                {liveCount > 0 && (
                  <span className="numeral block text-[11px] text-leaf-700">
                    🌱 {t('home.liveCount', { n: fmt(liveCount) })}
                  </span>
                )}
              </span>
              {streak > 0 && (
                <span className="rounded-full bg-sand-100 px-2 py-1 text-xs text-sand-600">
                  🔥 <span className="numeral">{streak}</span>
                </span>
              )}
              <ChevronEnd className="h-4 w-4 text-ink-300" />
            </Link>
          </li>
        );
      })}
      </ul>
      {done.length > 0 && (
        <button
          type="button"
          onClick={() => setShowDone((v) => !v)}
          className="block w-full text-center text-xs text-leaf-700 underline-offset-4 hover:underline"
        >
          {showDone
            ? t('home.hideDone', { n: fmt(done.length) })
            : t('home.showDone', { n: fmt(done.length) })}
        </button>
      )}
      {bookSheetHabitId && (
        <BookLogSheet
          habitId={bookSheetHabitId}
          onClose={() => setBookSheetHabitId(null)}
        />
      )}
      {cargoSlip && (
        <CargoSlipSheet
          cargo={cargoSlip.cargo}
          onClose={() => setCargoSlip(null)}
        />
      )}
    </div>
  );
}

function Checkmark({ active }: { active: boolean }) {
  return (
    <span
      className={clsx(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition',
        active ? 'border-leaf-600 bg-leaf-600 text-white animate-pop' : 'border-ink-300 bg-white',
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
