import type { Habit, HabitLog } from '@/domain/types';
import { dateKey } from './dates';
import { localizeUnit } from './units';

export interface Hadith {
  text: string;
  source: string;
}

export interface Narrative {
  projectionLines: string[];
  consequenceLines: string[];
  /**
   * Hopeful counterweights paired with the consequence lines.
   * Spec §21.10: never end on despair. Every "if you keep going down this
   * path" is paired with "but here's how to start reversing it today."
   */
  reversalLines: string[];
  hadith?: Hadith;
  /** Mean daily value across recent days that had any log. 0 when no data. */
  recentAvg?: number;
  /** True when we projected from recent pace because it exceeded the target. */
  paceDriven?: boolean;
}

export type Translator = (key: string, vars?: Record<string, any>) => string;

interface Ctx {
  habit: Habit;
  t: Translator;
  fmt: (n: number) => string;
  /** Pre-computed mean daily value (last N days with any log). When provided
   *  and greater than the habit's target, builders project from this number
   *  so the user's actual pace drives the compound math, not the target. */
  recentAvg?: number;
}

/** Mean daily value across the last `days` days that had any log entry.
 *  Returns 0 when there's no data. */
export function recentAvgValue(
  habit: Habit,
  logs: Record<string, Record<string, HabitLog>>,
  days = 14,
): number {
  let sum = 0;
  let n = 0;
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    const log = logs[key]?.[habit.id];
    if (log && log.value > 0) {
      sum += log.value;
      n += 1;
    }
  }
  return n === 0 ? 0 : sum / n;
}

/** For a good habit: max(target, recentAvg). For a bad habit: min(limit, recentAvg).
 *  Falls back to the static fallback when no target/limit is set. */
function effective(habit: Habit, ctx: Ctx, fallback: number): number {
  const avg = ctx.recentAvg ?? 0;
  if (habit.type === 'good') {
    const t = habit.target ?? fallback;
    return avg > t ? avg : t;
  }
  // bad habit
  const lim = habit.limit ?? fallback;
  return avg > 0 && avg < lim ? avg : lim;
}

function isPaceDriven(habit: Habit, ctx: Ctx): boolean {
  const avg = ctx.recentAvg ?? 0;
  if (avg <= 0) return false;
  if (habit.type === 'good' && habit.target !== undefined) return avg > habit.target;
  if (habit.type === 'bad' && habit.limit !== undefined) return avg < habit.limit;
  return false;
}

const BOOK_PAGES = 300;
const WALK_KMH = 5;
const LONDON_PARIS_KM = 460;
const QURAN_PAGES = 604;
const SAVING_RATE = 0.05;
const HOUR_RECLAIM_DAYS = 365 / 24;

function annuityFV(yearly: number, years: number, rate: number) {
  return (yearly * (Math.pow(1 + rate, years) - 1)) / rate;
}

function occurrencesPerYear(habit: Habit) {
  return habit.frequency === 'weekly' ? 52 : 365;
}

function hadithFromKey(t: Translator, key: string): Hadith {
  return {
    text: t(`narratives.${key}.hadithText`),
    source: t(`narratives.${key}.hadithSource`),
  };
}

type Builder = (ctx: Ctx) => Narrative;

const builders: Record<string, Builder> = {
  reading: (ctx) => {
    const { habit, t, fmt } = ctx;
    const pagesPerDay = effective(habit, ctx, 10);
    const pagesYearly = pagesPerDay * 365;
    const books = Math.max(1, Math.round(pagesYearly / BOOK_PAGES));
    const decadeBooks = books * 10;
    return {
      projectionLines: [
        t('narratives.reading.p1', { pages: fmt(pagesYearly), books: fmt(books) }),
        t('narratives.reading.p2', { decadeBooks: fmt(decadeBooks) }),
      ],
      consequenceLines: [
        t('narratives.reading.c1', { books: fmt(books) }),
        t('narratives.reading.c2', { decadeBooks: fmt(decadeBooks) }),
      ],
      reversalLines: [
        t('narratives.reading.r1'),
        t('narratives.reading.r2'),
      ],
      hadith: hadithFromKey(t, 'reading'),
    };
  },

  saving: (ctx) => {
    const { habit, t, fmt } = ctx;
    const daily = effective(habit, ctx, 1);
    const yearly = daily * 365;
    const tenYear = annuityFV(yearly, 10, SAVING_RATE);
    const thirtyYear = annuityFV(yearly, 30, SAVING_RATE);
    return {
      projectionLines: [
        t('narratives.saving.p1', { yearly: fmt(Math.round(yearly)) }),
        t('narratives.saving.p2', {
          tenYear: fmt(Math.round(tenYear)),
          rate: fmt(Math.round(SAVING_RATE * 100)),
        }),
        t('narratives.saving.p3', { thirtyYear: fmt(Math.round(thirtyYear)) }),
      ],
      consequenceLines: [
        t('narratives.saving.c1', { yearly: fmt(Math.round(yearly)) }),
        t('narratives.saving.c2', { tenYear: fmt(Math.round(tenYear)) }),
      ],
      reversalLines: [
        t('narratives.saving.r1', { yearly: fmt(Math.round(yearly)) }),
        t('narratives.saving.r2'),
      ],
      hadith: hadithFromKey(t, 'saving'),
    };
  },

  steps: (ctx) => {
    const { habit, t, fmt } = ctx;
    const stepsPerDay = effective(habit, ctx, 8000);
    // Average adult step length ~0.762 m. Convert to km.
    const STEP_M = 0.762;
    const kmYearly = Math.max(1, Math.round((stepsPerDay * STEP_M * 365) / 1000));
    const kmDecade = kmYearly * 10;
    // A "neighbourhood lap" ≈ 2 km is a relatable comparison; the
    // narrative says "roughly N times around your neighbourhood".
    const laps = Math.max(1, Math.round(kmYearly / 2));
    return {
      projectionLines: [
        t('narratives.steps.p1', { km: fmt(kmYearly), laps: fmt(laps) }),
        t('narratives.steps.p2', { decadeKm: fmt(kmDecade) }),
      ],
      consequenceLines: [
        t('narratives.steps.c1', { km: fmt(kmYearly) }),
        t('narratives.steps.c2'),
      ],
      reversalLines: [
        t('narratives.steps.r1'),
        t('narratives.steps.r2'),
      ],
      hadith: hadithFromKey(t, 'steps'),
    };
  },

  exercise: (ctx) => {
    const { habit, t, fmt } = ctx;
    const minPerDay = effective(habit, ctx, 30);
    const hoursYearly = Math.round((minPerDay * 365) / 60);
    const km = Math.round(hoursYearly * WALK_KMH);
    const trips = Math.max(1, Math.round(km / LONDON_PARIS_KM));
    return {
      projectionLines: [
        t('narratives.exercise.p1', { hours: fmt(hoursYearly) }),
        t('narratives.exercise.p2', { km: fmt(km), trips }),
        t('narratives.exercise.p3', { decadeHours: fmt(hoursYearly * 10) }),
      ],
      consequenceLines: [
        t('narratives.exercise.c1', { hours: fmt(hoursYearly) }),
        t('narratives.exercise.c2'),
      ],
      reversalLines: [
        t('narratives.exercise.r1'),
        t('narratives.exercise.r2'),
      ],
      hadith: hadithFromKey(t, 'exercise'),
    };
  },

  quranPages: (ctx) => {
    const { habit, t, fmt } = ctx;
    const pagesPerDay = effective(habit, ctx, 1);
    const pagesYearly = pagesPerDay * 365;
    const yearsPerKhatm = QURAN_PAGES / pagesYearly;
    const monthsPerKhatm = Math.max(1, Math.round(yearsPerKhatm * 12));
    const khatmsPerYear = Math.max(1, Math.round(pagesYearly / QURAN_PAGES));
    const decadeKhatms = Math.round((10 * pagesYearly) / QURAN_PAGES);
    return {
      projectionLines: [
        t('narratives.quranPages.p1', { pages: fmt(pagesYearly) }),
        t('narratives.quranPages.p2', {
          monthsPerKhatm: fmt(monthsPerKhatm),
          khatmsPerYear,
        }),
        t('narratives.quranPages.p3', { decadeKhatms: fmt(decadeKhatms) }),
      ],
      consequenceLines: [
        t('narratives.quranPages.c1', { pages: fmt(pagesYearly) }),
        t('narratives.quranPages.c2', { decadeKhatms: fmt(decadeKhatms) }),
      ],
      reversalLines: [
        t('narratives.quranPages.r1'),
        t('narratives.quranPages.r2'),
      ],
      hadith: hadithFromKey(t, 'quranPages'),
    };
  },

  screenTime: (ctx) => {
    const { habit, t, fmt } = ctx;
    const limit = effective(habit, ctx, 2);
    const daysReclaimed = Math.round(HOUR_RECLAIM_DAYS);
    const decadeDaysReclaimed = daysReclaimed * 10;
    return {
      projectionLines: [
        t('narratives.screenTime.p1', {
          limit: fmt(limit),
          daysReclaimed: fmt(daysReclaimed),
        }),
        t('narratives.screenTime.p2', {
          decadeDaysReclaimed: fmt(decadeDaysReclaimed),
        }),
      ],
      consequenceLines: [
        t('narratives.screenTime.c1', { daysReclaimed: fmt(daysReclaimed) }),
        t('narratives.screenTime.c2', {
          decadeDaysReclaimed: fmt(decadeDaysReclaimed),
        }),
      ],
      reversalLines: [
        t('narratives.screenTime.r1'),
        t('narratives.screenTime.r2'),
      ],
      hadith: hadithFromKey(t, 'screenTime'),
    };
  },

  tahajjud: ({ habit, t, fmt }) => {
    const nights = occurrencesPerYear(habit);
    return {
      projectionLines: [
        t('narratives.tahajjud.p1', { nights: fmt(nights) }),
        t('narratives.tahajjud.p2', { decadeNights: fmt(nights * 10) }),
      ],
      consequenceLines: [
        t('narratives.tahajjud.c1', { nights: fmt(nights) }),
        t('narratives.tahajjud.c2'),
      ],
      reversalLines: [
        t('narratives.tahajjud.r1'),
        t('narratives.tahajjud.r2'),
      ],
      hadith: hadithFromKey(t, 'tahajjud'),
    };
  },

  sadaqah: ({ habit, t, fmt }) => {
    const count = occurrencesPerYear(habit);
    return {
      projectionLines: [
        t('narratives.sadaqah.p1', { count: fmt(count) }),
        t('narratives.sadaqah.p2', { decadeCount: fmt(count * 10) }),
      ],
      consequenceLines: [
        t('narratives.sadaqah.c1', { count: fmt(count) }),
        t('narratives.sadaqah.c2', { decadeCount: fmt(count * 10) }),
      ],
      reversalLines: [
        t('narratives.sadaqah.r1'),
        t('narratives.sadaqah.r2'),
      ],
      hadith: hadithFromKey(t, 'sadaqah'),
    };
  },

  learning: (ctx) => {
    const { habit, t, fmt } = ctx;
    const minPerDay = effective(habit, ctx, 15);
    const hoursYearly = Math.round((minPerDay * 365) / 60);
    return {
      projectionLines: [
        t('narratives.learning.p1', { hours: fmt(hoursYearly) }),
        t('narratives.learning.p2', { decadeHours: fmt(hoursYearly * 10) }),
      ],
      consequenceLines: [
        t('narratives.learning.c1', { hours: fmt(hoursYearly) }),
        t('narratives.learning.c2'),
      ],
      reversalLines: [
        t('narratives.learning.r1'),
        t('narratives.learning.r2'),
      ],
      hadith: hadithFromKey(t, 'learning'),
    };
  },

  gheebat: ({ t, fmt }) => {
    const days = 365;
    return {
      projectionLines: [
        t('narratives.gheebat.p1', { days: fmt(days) }),
        t('narratives.gheebat.p2', { decadeDays: fmt(days * 10) }),
      ],
      consequenceLines: [t('narratives.gheebat.c1'), t('narratives.gheebat.c2')],
      reversalLines: [
        t('narratives.gheebat.r1'),
        t('narratives.gheebat.r2'),
      ],
      hadith: hadithFromKey(t, 'gheebat'),
    };
  },

  callFamily: ({ habit, t, fmt }) => {
    const callsPerYear = habit.frequency === 'weekly' ? 52 : 365;
    return {
      projectionLines: [
        t('narratives.callFamily.p1', { calls: fmt(callsPerYear) }),
        t('narratives.callFamily.p2', {
          decadeCalls: fmt(callsPerYear * 10),
        }),
      ],
      consequenceLines: [
        t('narratives.callFamily.c1'),
        t('narratives.callFamily.c2'),
      ],
      reversalLines: [
        t('narratives.callFamily.r1'),
        t('narratives.callFamily.r2'),
      ],
      hadith: hadithFromKey(t, 'callFamily'),
    };
  },
};

function genericNarrative(ctx: Ctx): Narrative {
  const { habit, t, fmt } = ctx;
  const occ = occurrencesPerYear(habit);
  const reversalLines = [
    t('narratives.generic.r1'),
    t('narratives.generic.r2'),
  ];
  if (habit.type === 'good' && habit.target !== undefined && habit.unit) {
    const daily = effective(habit, ctx, habit.target);
    const yearly = daily * occ;
    const decade = yearly * 10;
    const unit = localizeUnit(habit.unit, t);
    return {
      projectionLines: [
        t('narratives.generic.yearly', { value: fmt(yearly), unit }),
        t('narratives.generic.decade', {
          value: fmt(yearly),
          unit,
          decade: fmt(decade),
        }),
      ],
      consequenceLines: [
        t('narratives.generic.lostYear', { value: fmt(yearly), unit }),
        t('narratives.generic.lostDecade', { decade: fmt(decade), unit }),
      ],
      reversalLines,
    };
  }
  return {
    projectionLines: [
      t('narratives.generic.yearlyNoUnit', { days: fmt(occ) }),
      t('narratives.generic.decadeNoUnit', { decade: fmt(occ * 10) }),
    ],
    consequenceLines: [
      t('narratives.generic.lostYearNoUnit', { days: fmt(occ) }),
      t('narratives.generic.lostDecadeNoUnit', { decade: fmt(occ * 10) }),
    ],
    reversalLines,
  };
}

export function getNarrative(ctx: Ctx): Narrative {
  const key = ctx.habit.presetKey;
  const base = key && builders[key] ? builders[key](ctx) : genericNarrative(ctx);
  return {
    ...base,
    recentAvg: ctx.recentAvg,
    paceDriven: isPaceDriven(ctx.habit, ctx),
  };
}
