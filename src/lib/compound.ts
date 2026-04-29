import type { Habit } from '@/domain/types';

export interface CompoundProjection {
  yearly: number;
  decade: number;
  lifetime: number;
  unit?: string;
}

const DAYS_PER_YEAR = 365;
const LIFETIME_YEARS = 50;

/** A habit's per-day target (good) or per-day saving (bad → limit avoided). */
function dailyValue(habit: Habit): number {
  if (habit.type === 'good') return habit.target ?? 1;
  return habit.limit !== undefined ? Math.max(0, habit.limit) : 1;
}

export function projectCompound(habit: Habit): CompoundProjection {
  const daily = dailyValue(habit);
  const yearly = daily * DAYS_PER_YEAR;
  return {
    yearly,
    decade: yearly * 10,
    lifetime: yearly * LIFETIME_YEARS,
    unit: habit.unit,
  };
}
