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
  /** Missing this habit triggers a punishment via daily reconciliation (spec §5.5). */
  isCritical?: boolean;
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

export type ThemeMode = 'auto' | 'light';
export type CalendarPreference = 'gregorian' | 'jalali' | 'hijri';
export type PrayerCalcMethod = 'mwl' | 'isna' | 'tehran' | 'umm-al-qura';
export type ConsequenceSensitivity = 'off' | 'mild' | 'honest' | 'full';

export interface NotificationPreferences {
  enabled: boolean;
  /** Daily reminder time HH:mm (24h). */
  dailyTime: string;
  /** Per-habit toggles; absent key means "follow the global default". */
  perHabit: Record<string, boolean>;
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
  /** General theme preference. 'auto' allows Ramadan mode to take over (spec §6.1). */
  theme: ThemeMode;
  ramadanAutoMode: boolean;
  /** Free-text city or one of the curated dropdown values. */
  prayerCity?: string;
  prayerMethod: PrayerCalcMethod;
  calendar: CalendarPreference;
  consequenceSensitivity: ConsequenceSensitivity;
  notifications: NotificationPreferences;
  onboardingComplete: boolean;
  createdAt: string;
}

export type DateKey = string;

/* ── Rewards & Punishments (spec §5.4 / §5.5) ────────────────────────── */

export type RewardTier = 'small' | 'medium' | 'big' | 'major';

/** What triggers a reward to be queued. */
export type RewardOrigin = 'dailyComplete' | 'streak7' | 'streak30' | 'streak100';

export interface RewardOption {
  id: string;
  /** User-typed label. Preset entries store the translation key in presetKey. */
  label: string;
  presetKey?: string;
  tier: RewardTier;
  createdAt: string;
}

export interface PunishmentOption {
  id: string;
  label: string;
  presetKey?: string;
  createdAt: string;
}

export interface PendingReward {
  id: string;
  origin: RewardOrigin;
  tier: RewardTier;
  /** Streak rewards reference the habit; daily-complete rewards leave this empty. */
  habitId?: string;
  rewardOptionId?: string;
  earnedAt: string;
  /** Set when the user marks it as enjoyed/redeemed. */
  claimedAt?: string;
}

/* ── Book Tracker (spec §20) ──────────────────────────────────────────── */

export type BookFormat = 'physical' | 'ebook' | 'audiobook';

export type BookCategoryKey =
  | 'islamic'
  | 'selfImprovement'
  | 'fiction'
  | 'biography'
  | 'business'
  | 'science'
  | 'history'
  | 'other';

export type BookStatus = 'reading' | 'completed' | 'archived';

export interface Book {
  id: string;
  title: string;
  author: string;
  totalPages: number;
  category: BookCategoryKey;
  format: BookFormat;
  whyReading?: string;
  targetCompletionDate?: string;
  /** Resized JPEG data URL (~240px wide). Optional. */
  coverImage?: string;
  status: BookStatus;
  startedAt: string;
  completedAt?: string;
  rating?: 1 | 2 | 3 | 4 | 5;
  review?: string;
  favouriteQuote?: string;
  /** pagesByDate[YYYY-MM-DD] = pages read that day. */
  pagesByDate: Record<string, number>;
  createdAt: string;
}

export interface ActivePunishment {
  id: string;
  habitId: string;
  /** The day the critical habit was missed. */
  date: string;
  /** User-assigned punishment option, or undefined → fall back to default charity. */
  punishmentOptionId?: string;
  doneAt?: string;
}
