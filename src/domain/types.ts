export type CategoryKey = 'islamic' | 'health' | 'finance' | 'career' | 'growth' | 'relationships';

export type HabitType = 'good' | 'bad';

export type Frequency = 'daily' | 'weekly';

export interface Category {
  id: string;
  /** For default categories this matches a translation key under categories.names. */
  key?: CategoryKey;
  name: string;
  icon: string;
  color: string;
  order: number;
  isDefault: boolean;
  isActive: boolean;
  archivedAt?: string;
}

export interface Habit {
  id: string;
  categoryId: string;
  /** Translation key under presets.* if this came from a preset; otherwise undefined. */
  presetKey?: string;
  name: string;
  type: HabitType;
  unit?: string;
  /** For good habits: daily target. For bad habits: undefined. */
  target?: number;
  /** For bad habits: stay at or below this. */
  limit?: number;
  frequency: Frequency;
  replacementHabitId?: string;
  createdAt: string;
}

/** A single day's log for one habit. */
export interface HabitLog {
  habitId: string;
  date: string;
  value: number;
  completed: boolean;
}

/** Precomputed per-day summary for the heatmap (spec §8). */
export interface DailySummary {
  date: string;
  totalHabits: number;
  completedCount: number;
  completionRate: number;
}

export interface Streak {
  habitId: string;
  current: number;
  longest: number;
  lastCompleted?: string;
}

export interface Profile {
  name: string;
  /** Optional; Future Self screen prompts to fill it if missing. */
  futureSelfName?: string;
  futureSelfVision: string;
  /** The "why" — the reason that drives the user when motivation fades (spec §5.1). */
  whyItMatters?: string;
  language: 'en' | 'fa';
  numeralSystem: 'western' | 'persian';
  onboardingComplete: boolean;
  createdAt: string;
}

export type DateKey = string;
