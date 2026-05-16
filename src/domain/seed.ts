import type { Category, CategoryKey, Habit, HabitType } from './types';

interface SeedCategory {
  key: CategoryKey;
  icon: string;
  color: string;
}

export const seedCategories: SeedCategory[] = [
  { key: 'islamic', icon: '☪', color: '#0ea5e9' },
  { key: 'health', icon: '❤', color: '#ef4444' },
  { key: 'sport', icon: '⚡', color: '#0d9488' },
  { key: 'finance', icon: '$', color: '#16a34a' },
  { key: 'career', icon: '◆', color: '#7c3aed' },
  { key: 'growth', icon: '✦', color: '#f59e0b' },
  { key: 'relationships', icon: '◐', color: '#ec4899' },
];

export interface PresetHabit {
  presetKey: string;
  category: CategoryKey;
  type: HabitType;
  unit?: string;
  target?: number;
  limit?: number;
  /** Spec §23: the smaller starter alternative. When present, the habit
   *  creation UI offers both versions side-by-side and recommends this one.
   *  After a 30-day streak the app prompts the user to level up to the full
   *  target above. Only set for target-based good habits; binary toggles and
   *  bad habits don't carry it. */
  twoMinuteVersion?: {
    /** Translation key for the smaller name, e.g. "Read 1 page of Quran". */
    nameKey: string;
    target: number;
    /** Falls back to the preset's full unit when omitted. */
    unit?: string;
  };
}

export const presetHabits: PresetHabit[] = [
  // Islamic
  {
    presetKey: 'fivePrayers',
    category: 'islamic',
    type: 'good',
    unit: 'prayers',
    target: 5,
    twoMinuteVersion: { nameKey: 'presets.fivePrayersTwoMinute', target: 1, unit: 'prayers' },
  },
  { presetKey: 'fajr', category: 'islamic', type: 'good' },
  {
    presetKey: 'quranPages',
    category: 'islamic',
    type: 'good',
    unit: 'pages',
    target: 5,
    twoMinuteVersion: { nameKey: 'presets.quranPagesTwoMinute', target: 1, unit: 'pages' },
  },
  { presetKey: 'morningAdhkar', category: 'islamic', type: 'good' },
  { presetKey: 'eveningAdhkar', category: 'islamic', type: 'good' },
  { presetKey: 'tahajjud', category: 'islamic', type: 'good' },
  { presetKey: 'sadaqah', category: 'islamic', type: 'good' },
  { presetKey: 'gheebat', category: 'islamic', type: 'bad', unit: 'incidents', limit: 0 },
  { presetKey: 'manageAnger', category: 'islamic', type: 'good' },

  // Health
  { presetKey: 'sleep', category: 'health', type: 'good', unit: 'hours', target: 7 },
  {
    presetKey: 'water',
    category: 'health',
    type: 'good',
    unit: 'glasses',
    target: 8,
    twoMinuteVersion: { nameKey: 'presets.waterTwoMinute', target: 1, unit: 'glasses' },
  },
  { presetKey: 'screenTime', category: 'health', type: 'bad', unit: 'hours', limit: 2 },
  { presetKey: 'junkFood', category: 'health', type: 'bad', unit: 'servings', limit: 0 },

  // Sport
  {
    presetKey: 'exercise',
    category: 'sport',
    type: 'good',
    unit: 'minutes',
    target: 30,
    twoMinuteVersion: { nameKey: 'presets.exerciseTwoMinute', target: 5, unit: 'minutes' },
  },
  {
    presetKey: 'steps',
    category: 'sport',
    type: 'good',
    unit: 'steps',
    target: 8000,
    twoMinuteVersion: { nameKey: 'presets.stepsTwoMinute', target: 1000, unit: 'steps' },
  },
  {
    presetKey: 'pushups',
    category: 'sport',
    type: 'good',
    unit: 'reps',
    target: 30,
    twoMinuteVersion: { nameKey: 'presets.pushupsTwoMinute', target: 5, unit: 'reps' },
  },
  {
    presetKey: 'squats',
    category: 'sport',
    type: 'good',
    unit: 'reps',
    target: 30,
    twoMinuteVersion: { nameKey: 'presets.squatsTwoMinute', target: 5, unit: 'reps' },
  },
  {
    presetKey: 'jumpRope',
    category: 'sport',
    type: 'good',
    unit: 'minutes',
    target: 10,
    twoMinuteVersion: { nameKey: 'presets.jumpRopeTwoMinute', target: 2, unit: 'minutes' },
  },
  {
    presetKey: 'walking',
    category: 'sport',
    type: 'good',
    unit: 'minutes',
    target: 30,
    twoMinuteVersion: { nameKey: 'presets.walkingTwoMinute', target: 5, unit: 'minutes' },
  },
  {
    presetKey: 'running',
    category: 'sport',
    type: 'good',
    unit: 'minutes',
    target: 20,
    twoMinuteVersion: { nameKey: 'presets.runningTwoMinute', target: 5, unit: 'minutes' },
  },

  // Finance
  {
    presetKey: 'saving',
    category: 'finance',
    type: 'good',
    unit: 'amount',
    target: 10,
    twoMinuteVersion: { nameKey: 'presets.savingTwoMinute', target: 1, unit: 'amount' },
  },
  { presetKey: 'noImpulseBuy', category: 'finance', type: 'good' },

  // Career
  {
    presetKey: 'deepWork',
    category: 'career',
    type: 'good',
    unit: 'minutes',
    target: 90,
    twoMinuteVersion: { nameKey: 'presets.deepWorkTwoMinute', target: 15, unit: 'minutes' },
  },
  { presetKey: 'noSocialBeforeWork', category: 'career', type: 'good' },

  // Growth
  {
    presetKey: 'reading',
    category: 'growth',
    type: 'good',
    unit: 'pages',
    target: 10,
    twoMinuteVersion: { nameKey: 'presets.readingTwoMinute', target: 1, unit: 'pages' },
  },
  {
    presetKey: 'learning',
    category: 'growth',
    type: 'good',
    unit: 'minutes',
    target: 15,
    twoMinuteVersion: { nameKey: 'presets.learningTwoMinute', target: 2, unit: 'minutes' },
  },
  { presetKey: 'negativeSelfTalk', category: 'growth', type: 'bad', unit: 'incidents', limit: 0 },

  // Relationships
  { presetKey: 'callFamily', category: 'relationships', type: 'good' },
  { presetKey: 'phoneFreeMeals', category: 'relationships', type: 'good' },
];

/** Spec §5.7: every preset bad habit suggests its good-habit counterpart so
 *  the user is never just removing a behaviour — they're replacing it. Keys
 *  here are bad-preset keys; values are the suggested good-preset key. Bad
 *  presets without an entry fall back to free-text in the full form. */
export const presetReplacements: Record<string, string> = {
  screenTime: 'reading',
  gheebat: 'morningAdhkar',
  junkFood: 'water',
  negativeSelfTalk: 'morningAdhkar',
};

export function buildSeedCategories(translate: (key: CategoryKey) => string): Category[] {
  const now = new Date().toISOString();
  return seedCategories.map((c, idx) => ({
    id: `cat_${c.key}`,
    key: c.key,
    name: translate(c.key),
    icon: c.icon,
    color: c.color,
    order: idx,
    isDefault: true,
    isActive: true,
  }));
}

export function buildSeedHabits(
  selectedPresetKeys: string[],
  /** Resolves any translation path. Called with `presets.<key>` for the full
   *  preset name and with the 2-minute version's `nameKey` for the smaller
   *  starter label. */
  translate: (key: string) => string,
  options?: { useTwoMinuteVersion?: boolean },
): Habit[] {
  const now = new Date().toISOString();
  const set = new Set(selectedPresetKeys);
  const preferTwoMinute = options?.useTwoMinuteVersion ?? false;
  return presetHabits
    .filter((p) => set.has(p.presetKey))
    .map((p) => {
      const useSmall = preferTwoMinute && p.twoMinuteVersion !== undefined;
      const tmv = useSmall ? p.twoMinuteVersion! : undefined;
      return {
        id: `habit_${p.presetKey}`,
        categoryId: `cat_${p.category}`,
        presetKey: p.presetKey,
        name: tmv ? translate(tmv.nameKey) : translate(`presets.${p.presetKey}`),
        type: p.type,
        unit: tmv ? tmv.unit ?? p.unit : p.unit,
        target: tmv ? tmv.target : p.target,
        limit: p.limit,
        frequency: 'daily' as const,
        isTwoMinuteVersion: useSmall || undefined,
        createdAt: now,
      };
    });
}
