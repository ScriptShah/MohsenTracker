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
}

export const presetHabits: PresetHabit[] = [
  // Islamic
  { presetKey: 'fivePrayers', category: 'islamic', type: 'good', unit: 'prayers', target: 5 },
  { presetKey: 'fajr', category: 'islamic', type: 'good' },
  { presetKey: 'quranPages', category: 'islamic', type: 'good', unit: 'pages', target: 5 },
  { presetKey: 'morningAdhkar', category: 'islamic', type: 'good' },
  { presetKey: 'eveningAdhkar', category: 'islamic', type: 'good' },
  { presetKey: 'tahajjud', category: 'islamic', type: 'good' },
  { presetKey: 'sadaqah', category: 'islamic', type: 'good' },
  { presetKey: 'gheebat', category: 'islamic', type: 'bad', unit: 'incidents', limit: 0 },
  { presetKey: 'manageAnger', category: 'islamic', type: 'good' },

  // Health
  { presetKey: 'sleep', category: 'health', type: 'good', unit: 'hours', target: 7 },
  { presetKey: 'water', category: 'health', type: 'good', unit: 'glasses', target: 8 },
  { presetKey: 'screenTime', category: 'health', type: 'bad', unit: 'hours', limit: 2 },
  { presetKey: 'junkFood', category: 'health', type: 'bad', unit: 'servings', limit: 0 },

  // Sport
  { presetKey: 'exercise', category: 'sport', type: 'good', unit: 'minutes', target: 30 },
  { presetKey: 'steps', category: 'sport', type: 'good', unit: 'steps', target: 8000 },
  { presetKey: 'pushups', category: 'sport', type: 'good', unit: 'reps', target: 30 },
  { presetKey: 'squats', category: 'sport', type: 'good', unit: 'reps', target: 30 },
  { presetKey: 'jumpRope', category: 'sport', type: 'good', unit: 'minutes', target: 10 },
  { presetKey: 'walking', category: 'sport', type: 'good', unit: 'minutes', target: 30 },
  { presetKey: 'running', category: 'sport', type: 'good', unit: 'minutes', target: 20 },

  // Finance
  { presetKey: 'saving', category: 'finance', type: 'good', unit: 'amount', target: 10 },
  { presetKey: 'noImpulseBuy', category: 'finance', type: 'good' },

  // Career
  { presetKey: 'deepWork', category: 'career', type: 'good', unit: 'minutes', target: 90 },
  { presetKey: 'noSocialBeforeWork', category: 'career', type: 'good' },

  // Growth
  { presetKey: 'reading', category: 'growth', type: 'good', unit: 'pages', target: 10 },
  { presetKey: 'learning', category: 'growth', type: 'good', unit: 'minutes', target: 15 },
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
  translate: (presetKey: string) => string,
): Habit[] {
  const now = new Date().toISOString();
  const set = new Set(selectedPresetKeys);
  return presetHabits
    .filter((p) => set.has(p.presetKey))
    .map((p) => ({
      id: `habit_${p.presetKey}`,
      categoryId: `cat_${p.category}`,
      presetKey: p.presetKey,
      name: translate(p.presetKey),
      type: p.type,
      unit: p.unit,
      target: p.target,
      limit: p.limit,
      frequency: 'daily' as const,
      createdAt: now,
    }));
}
