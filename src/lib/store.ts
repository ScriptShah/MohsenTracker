'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Category,
  CategoryKey,
  DailySummary,
  Habit,
  HabitLog,
  Profile,
  Streak,
} from '@/domain/types';
import {
  buildSeedCategories,
  buildSeedHabits,
  presetHabits,
  seedCategories,
} from '@/domain/seed';
import { todayKey } from './dates';
import { isLogSuccessful, recomputeStreak } from './streaks';

interface AppState {
  profile: Profile | null;
  categories: Category[];
  habits: Habit[];
  /** logs[YYYY-MM-DD][habitId] */
  logs: Record<string, Record<string, HabitLog>>;
  /** Daily completion summary, keyed by YYYY-MM-DD. */
  summaries: Record<string, DailySummary>;
  streaks: Record<string, Streak>;

  /* mutations */
  initFromOnboarding: (args: {
    profile: Profile;
    selectedCategoryKeys: CategoryKey[];
    presetTranslate: (presetKey: string) => string;
    categoryTranslate: (key: CategoryKey) => string;
  }) => void;
  setLanguage: (lang: 'en' | 'fa') => void;
  setProfile: (patch: Partial<Profile>) => void;
  addHabit: (habit: Omit<Habit, 'id' | 'createdAt'>) => Habit;
  deleteHabit: (habitId: string) => void;
  toggleHabit: (habitId: string, date?: string) => void;
  setHabitValue: (habitId: string, value: number, date?: string) => void;
  reset: () => void;
}

const STORAGE_KEY = 'mohsen-tracker:v1';

function recomputeSummary(state: AppState, date: string): DailySummary {
  const dayLogs = state.logs[date] ?? {};
  const totalHabits = state.habits.length;
  let completedCount = 0;
  for (const habit of state.habits) {
    if (isLogSuccessful(habit, dayLogs[habit.id])) completedCount += 1;
  }
  return {
    date,
    totalHabits,
    completedCount,
    completionRate: totalHabits === 0 ? 0 : completedCount / totalHabits,
  };
}

function recomputeStreakFor(state: AppState, habitId: string): Streak | null {
  const habit = state.habits.find((h) => h.id === habitId);
  if (!habit) return null;
  const byDate: Record<string, HabitLog> = {};
  for (const date of Object.keys(state.logs)) {
    const log = state.logs[date][habitId];
    if (log) byDate[date] = log;
  }
  const prevLongest = state.streaks[habitId]?.longest ?? 0;
  return recomputeStreak(habit, byDate, prevLongest);
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      profile: null,
      categories: [],
      habits: [],
      logs: {},
      summaries: {},
      streaks: {},

      initFromOnboarding: ({
        profile,
        selectedCategoryKeys,
        presetTranslate,
        categoryTranslate,
      }) => {
        const allCategories = buildSeedCategories(categoryTranslate);
        const categories = allCategories.map((c) => ({
          ...c,
          isActive: selectedCategoryKeys.includes(c.key as CategoryKey),
        }));
        const habits = buildSeedHabits(selectedCategoryKeys, presetTranslate);
        set({ profile, categories, habits, logs: {}, summaries: {}, streaks: {} });
      },

      setLanguage: (lang) => {
        const { profile } = get();
        if (!profile) return;
        set({ profile: { ...profile, language: lang } });
      },

      setProfile: (patch) => {
        const { profile } = get();
        if (!profile) return;
        set({ profile: { ...profile, ...patch } });
      },

      addHabit: (input) => {
        const id = `habit_${Math.random().toString(36).slice(2, 10)}`;
        const habit: Habit = {
          ...input,
          id,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ habits: [...s.habits, habit] }));
        const today = todayKey();
        set((s) => ({ summaries: { ...s.summaries, [today]: recomputeSummary(get(), today) } }));
        return habit;
      },

      deleteHabit: (habitId) => {
        set((s) => {
          const habits = s.habits.filter((h) => h.id !== habitId);
          const logs: Record<string, Record<string, HabitLog>> = {};
          for (const [date, dayLogs] of Object.entries(s.logs)) {
            const { [habitId]: _, ...rest } = dayLogs;
            logs[date] = rest;
          }
          const { [habitId]: __, ...streaks } = s.streaks;
          return { habits, logs, streaks };
        });
        const today = todayKey();
        set((s) => ({ summaries: { ...s.summaries, [today]: recomputeSummary(get(), today) } }));
      },

      toggleHabit: (habitId, date) => {
        const day = date ?? todayKey();
        set((s) => {
          const dayLogs = { ...(s.logs[day] ?? {}) };
          const habit = s.habits.find((h) => h.id === habitId);
          if (!habit) return s;
          const existing = dayLogs[habitId];
          const nextCompleted = !existing?.completed;
          let value = existing?.value ?? 0;
          if (habit.type === 'good' && habit.target !== undefined) {
            value = nextCompleted ? habit.target : 0;
          } else if (habit.type === 'bad') {
            // Toggling a bad habit means "I stayed within my limit today".
            value = nextCompleted ? habit.limit ?? 0 : (habit.limit ?? 0) + 1;
          } else {
            value = nextCompleted ? 1 : 0;
          }
          dayLogs[habitId] = { habitId, date: day, value, completed: nextCompleted };
          return { logs: { ...s.logs, [day]: dayLogs } };
        });
        // Recompute summary + streak.
        set((s) => {
          const summary = recomputeSummary(get(), day);
          const streak = recomputeStreakFor(get(), habitId);
          return {
            summaries: { ...s.summaries, [day]: summary },
            streaks: streak ? { ...s.streaks, [habitId]: streak } : s.streaks,
          };
        });
      },

      setHabitValue: (habitId, value, date) => {
        const day = date ?? todayKey();
        set((s) => {
          const habit = s.habits.find((h) => h.id === habitId);
          if (!habit) return s;
          const dayLogs = { ...(s.logs[day] ?? {}) };
          let completed = false;
          if (habit.type === 'good') {
            completed = habit.target === undefined ? value > 0 : value >= habit.target;
          } else {
            completed = value <= (habit.limit ?? 0);
          }
          dayLogs[habitId] = { habitId, date: day, value, completed };
          return { logs: { ...s.logs, [day]: dayLogs } };
        });
        set((s) => {
          const summary = recomputeSummary(get(), day);
          const streak = recomputeStreakFor(get(), habitId);
          return {
            summaries: { ...s.summaries, [day]: summary },
            streaks: streak ? { ...s.streaks, [habitId]: streak } : s.streaks,
          };
        });
      },

      reset: () => set({
        profile: null,
        categories: [],
        habits: [],
        logs: {},
        summaries: {},
        streaks: {},
      }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

