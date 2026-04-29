import type { Habit } from '@/domain/types';

export interface Hadith {
  text: string;
  source: string;
}

export interface Narrative {
  projectionLines: string[];
  consequenceLines: string[];
  hadith?: Hadith;
}

export type Translator = (key: string, vars?: Record<string, any>) => string;

interface Ctx {
  habit: Habit;
  t: Translator;
  fmt: (n: number) => string;
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
  reading: ({ habit, t, fmt }) => {
    const pagesPerDay = habit.target ?? 10;
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
      hadith: hadithFromKey(t, 'reading'),
    };
  },

  saving: ({ habit, t, fmt }) => {
    const daily = habit.target ?? 1;
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
      hadith: hadithFromKey(t, 'saving'),
    };
  },

  exercise: ({ habit, t, fmt }) => {
    const minPerDay = habit.target ?? 30;
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
      hadith: hadithFromKey(t, 'exercise'),
    };
  },

  quranPages: ({ habit, t, fmt }) => {
    const pagesPerDay = habit.target ?? 1;
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
      hadith: hadithFromKey(t, 'quranPages'),
    };
  },

  screenTime: ({ habit, t, fmt }) => {
    const limit = habit.limit ?? 2;
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
      hadith: hadithFromKey(t, 'sadaqah'),
    };
  },

  learning: ({ habit, t, fmt }) => {
    const minPerDay = habit.target ?? 15;
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
      hadith: hadithFromKey(t, 'gheebat'),
    };
  },
};

function genericNarrative({ habit, t, fmt }: Ctx): Narrative {
  const occ = occurrencesPerYear(habit);
  if (habit.type === 'good' && habit.target !== undefined && habit.unit) {
    const yearly = habit.target * occ;
    const decade = yearly * 10;
    return {
      projectionLines: [
        t('narratives.generic.yearly', { value: fmt(yearly), unit: habit.unit }),
        t('narratives.generic.decade', {
          value: fmt(yearly),
          unit: habit.unit,
          decade: fmt(decade),
        }),
      ],
      consequenceLines: [
        t('narratives.generic.lostYear', { value: fmt(yearly), unit: habit.unit }),
        t('narratives.generic.lostDecade', { decade: fmt(decade), unit: habit.unit }),
      ],
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
  };
}

export function getNarrative(ctx: Ctx): Narrative {
  const key = ctx.habit.presetKey;
  if (key && builders[key]) return builders[key](ctx);
  return genericNarrative(ctx);
}
