'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  ActivePunishment,
  Category,
  CategoryKey,
  DailySummary,
  Habit,
  HabitLog,
  PendingReward,
  Profile,
  PunishmentOption,
  RewardOption,
  RewardOrigin,
  RewardTier,
  Streak,
} from '@/domain/types';
import {
  buildSeedCategories,
  buildSeedHabits,
} from '@/domain/seed';
import { dateKey, nextDayKey, previousDayKey, todayKey } from './dates';
import { isLogSuccessful, recomputeStreak } from './streaks';
import { validatePunishment, type SafetyResult } from './safety';
import { parseISO } from 'date-fns';

interface AppState {
  profile: Profile | null;
  categories: Category[];
  habits: Habit[];
  /** logs[YYYY-MM-DD][habitId] */
  logs: Record<string, Record<string, HabitLog>>;
  summaries: Record<string, DailySummary>;
  streaks: Record<string, Streak>;

  /* Rewards & Punishments (spec §5.4 / §5.5) */
  rewards: RewardOption[];
  punishments: PunishmentOption[];
  pendingRewards: PendingReward[];
  activePunishments: ActivePunishment[];
  /** Last YYYY-MM-DD that we walked the log history queueing punishments. */
  lastReconciledDate?: string;

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
  setHabitCritical: (habitId: string, isCritical: boolean) => void;
  toggleHabit: (habitId: string, date?: string) => void;
  setHabitValue: (habitId: string, value: number, date?: string) => void;

  addReward: (label: string, tier: RewardTier, presetKey?: string) => RewardOption;
  removeReward: (id: string) => void;
  setRewardTier: (id: string, tier: RewardTier) => void;
  addPunishment: (label: string, presetKey?: string) => SafetyResult & { added?: PunishmentOption };
  removePunishment: (id: string) => void;
  claimReward: (id: string) => void;
  resolvePunishment: (id: string) => void;
  reconcilePunishments: () => void;

  reset: () => void;
}

const STORAGE_KEY = 'mohsen-tracker:v1';

const STREAK_THRESHOLDS: Array<{ length: number; origin: RewardOrigin; tier: RewardTier }> = [
  { length: 7, origin: 'streak7', tier: 'medium' },
  { length: 30, origin: 'streak30', tier: 'big' },
  { length: 100, origin: 'streak100', tier: 'major' },
];

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

function pickRewardOptionId(tier: RewardTier, options: RewardOption[]): string | undefined {
  const candidates = options.filter((o) => o.tier === tier);
  if (candidates.length === 0) return undefined;
  return candidates[Math.floor(Math.random() * candidates.length)].id;
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
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

      rewards: [],
      punishments: [],
      pendingRewards: [],
      activePunishments: [],

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
        set({
          profile,
          categories,
          habits,
          logs: {},
          summaries: {},
          streaks: {},
          rewards: [],
          punishments: [],
          pendingRewards: [],
          activePunishments: [],
          lastReconciledDate: undefined,
        });
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
        const id = newId('habit');
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
          // Drop pending streak rewards for the deleted habit too.
          const pendingRewards = s.pendingRewards.filter((r) => r.habitId !== habitId);
          const activePunishments = s.activePunishments.filter((p) => p.habitId !== habitId);
          return { habits, logs, streaks, pendingRewards, activePunishments };
        });
        const today = todayKey();
        set((s) => ({ summaries: { ...s.summaries, [today]: recomputeSummary(get(), today) } }));
      },

      setHabitCritical: (habitId, isCritical) => {
        set((s) => ({
          habits: s.habits.map((h) => (h.id === habitId ? { ...h, isCritical } : h)),
        }));
      },

      toggleHabit: (habitId, date) => {
        const day = date ?? todayKey();
        const prevRate = get().summaries[day]?.completionRate ?? 0;
        const prevStreak = get().streaks[habitId]?.current ?? 0;

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
            value = nextCompleted ? habit.limit ?? 0 : (habit.limit ?? 0) + 1;
          } else {
            value = nextCompleted ? 1 : 0;
          }
          dayLogs[habitId] = { habitId, date: day, value, completed: nextCompleted };
          return { logs: { ...s.logs, [day]: dayLogs } };
        });

        const newSummary = recomputeSummary(get(), day);
        const newStreak = recomputeStreakFor(get(), habitId);
        set((s) => ({
          summaries: { ...s.summaries, [day]: newSummary },
          streaks: newStreak ? { ...s.streaks, [habitId]: newStreak } : s.streaks,
        }));

        if (day !== todayKey()) return;

        const additions: PendingReward[] = [];
        const state = get();
        const seen = new Set(state.pendingRewards.map((r) => r.id));
        const now = new Date().toISOString();

        // Daily 100% completion → small reward.
        if (
          newSummary.totalHabits > 0 &&
          newSummary.completionRate === 1 &&
          prevRate < 1
        ) {
          const id = `dc-${day}`;
          if (!seen.has(id)) {
            additions.push({
              id,
              origin: 'dailyComplete',
              tier: 'small',
              earnedAt: now,
              rewardOptionId: pickRewardOptionId('small', state.rewards),
            });
          }
        }

        // Streak milestone rewards.
        if (newStreak) {
          for (const t of STREAK_THRESHOLDS) {
            if (newStreak.current === t.length && prevStreak < t.length) {
              const id = `${habitId}-${t.origin}-${day}`;
              if (!seen.has(id)) {
                additions.push({
                  id,
                  origin: t.origin,
                  tier: t.tier,
                  habitId,
                  earnedAt: now,
                  rewardOptionId: pickRewardOptionId(t.tier, state.rewards),
                });
              }
            }
          }
        }

        if (additions.length > 0) {
          set((s) => ({ pendingRewards: [...s.pendingRewards, ...additions] }));
        }
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

      addReward: (label, tier, presetKey) => {
        const reward: RewardOption = {
          id: newId('rwd'),
          label: label.trim(),
          presetKey,
          tier,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ rewards: [...s.rewards, reward] }));
        return reward;
      },

      removeReward: (id) =>
        set((s) => ({
          rewards: s.rewards.filter((r) => r.id !== id),
          // Forget any pending reward that pointed to this option, but keep
          // the pending reward itself so the user still sees their win.
          pendingRewards: s.pendingRewards.map((r) =>
            r.rewardOptionId === id ? { ...r, rewardOptionId: undefined } : r,
          ),
        })),

      setRewardTier: (id, tier) =>
        set((s) => ({
          rewards: s.rewards.map((r) => (r.id === id ? { ...r, tier } : r)),
        })),

      addPunishment: (label, presetKey) => {
        const verdict = validatePunishment(label);
        if (!verdict.ok) return verdict;
        const punishment: PunishmentOption = {
          id: newId('pun'),
          label: label.trim(),
          presetKey,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ punishments: [...s.punishments, punishment] }));
        return { ok: true, added: punishment };
      },

      removePunishment: (id) =>
        set((s) => ({
          punishments: s.punishments.filter((p) => p.id !== id),
          activePunishments: s.activePunishments.map((p) =>
            p.punishmentOptionId === id ? { ...p, punishmentOptionId: undefined } : p,
          ),
        })),

      claimReward: (id) =>
        set((s) => ({
          pendingRewards: s.pendingRewards.map((r) =>
            r.id === id && !r.claimedAt ? { ...r, claimedAt: new Date().toISOString() } : r,
          ),
        })),

      resolvePunishment: (id) =>
        set((s) => ({
          activePunishments: s.activePunishments.map((p) =>
            p.id === id && !p.doneAt ? { ...p, doneAt: new Date().toISOString() } : p,
          ),
        })),

      reconcilePunishments: () => {
        const state = get();
        if (!state.profile?.onboardingComplete) return;
        const today = todayKey();
        if (state.lastReconciledDate === today) return;

        // Walk from last-reconciled+1 (or profile creation) up to yesterday.
        const startISO = state.lastReconciledDate ?? state.profile.createdAt;
        const startKey = dateKey(parseISO(startISO));
        const yesterday = previousDayKey(today);

        let cursor = state.lastReconciledDate ? nextDayKey(startKey) : startKey;

        const newPunishments: ActivePunishment[] = [];
        const existingIds = new Set(state.activePunishments.map((p) => p.id));

        while (cursor <= yesterday) {
          const dayLogs = state.logs[cursor] ?? {};
          for (const habit of state.habits) {
            if (!habit.isCritical) continue;
            const createdKey = dateKey(parseISO(habit.createdAt));
            if (cursor < createdKey) continue;
            if (isLogSuccessful(habit, dayLogs[habit.id])) continue;
            const id = `pun-${habit.id}-${cursor}`;
            if (existingIds.has(id)) continue;
            newPunishments.push({
              id,
              habitId: habit.id,
              date: cursor,
              punishmentOptionId: pickRewardOptionIdForPunishment(state.punishments),
            });
            existingIds.add(id);
          }
          cursor = nextDayKey(cursor);
        }

        set((s) => ({
          activePunishments: [...s.activePunishments, ...newPunishments],
          lastReconciledDate: today,
        }));
      },

      reset: () =>
        set({
          profile: null,
          categories: [],
          habits: [],
          logs: {},
          summaries: {},
          streaks: {},
          rewards: [],
          punishments: [],
          pendingRewards: [],
          activePunishments: [],
          lastReconciledDate: undefined,
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 3,
      migrate: (persisted: any) => {
        if (!persisted) return persisted;
        persisted.rewards = persisted.rewards ?? [];
        persisted.punishments = persisted.punishments ?? [];
        persisted.pendingRewards = persisted.pendingRewards ?? [];
        persisted.activePunishments = persisted.activePunishments ?? [];
        if (persisted.profile) {
          persisted.profile.theme = persisted.profile.theme ?? 'auto';
          persisted.profile.ramadanAutoMode =
            persisted.profile.ramadanAutoMode ?? true;
          persisted.profile.prayerMethod = persisted.profile.prayerMethod ?? 'mwl';
          persisted.profile.calendar = persisted.profile.calendar ?? 'gregorian';
          persisted.profile.consequenceSensitivity =
            persisted.profile.consequenceSensitivity ?? 'honest';
          persisted.profile.notifications = persisted.profile.notifications ?? {
            enabled: false,
            dailyTime: '09:00',
            perHabit: {},
          };
        }
        return persisted;
      },
    },
  ),
);

function pickRewardOptionIdForPunishment(options: PunishmentOption[]): string | undefined {
  if (options.length === 0) return undefined;
  return options[Math.floor(Math.random() * options.length)].id;
}
