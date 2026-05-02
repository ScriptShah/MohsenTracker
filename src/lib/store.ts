'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  ActivePunishment,
  Book,
  Category,
  CategoryKey,
  DailySummary,
  DopamineReset,
  Habit,
  HabitLog,
  PendingReward,
  Profile,
  PunishmentOption,
  RamadanProgress,
  ResetCheckIn,
  ResetTier,
  RewardOption,
  RewardOrigin,
  RewardTier,
  Streak,
} from '@/domain/types';
import {
  buildSeedCategories,
  buildSeedHabits,
  presetHabits,
} from '@/domain/seed';
import { dateKey, nextDayKey, previousDayKey, todayKey } from './dates';
import { isLogSuccessful, recomputeStreak } from './streaks';
import { validatePunishment, type SafetyResult } from './safety';
import { tickHabit } from './livecounts';
import { differenceInCalendarDays, parseISO } from 'date-fns';

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

  /* Book Tracker (spec §20) */
  books: Book[];

  /* Dopamine Reset (spec §19) */
  resets: DopamineReset[];

  /* Ramadan (spec §6.1) — one record per Hijri year. */
  ramadan: RamadanProgress[];

  /* mutations */
  initFromOnboarding: (args: {
    profile: Profile;
    selectedCategoryKeys: CategoryKey[];
    /** Preset habit keys the user picked during the per-category step.
     *  When omitted, every preset in `selectedCategoryKeys` is used (legacy
     *  back-compat). */
    selectedPresetKeys?: string[];
    presetTranslate: (presetKey: string) => string;
    categoryTranslate: (key: CategoryKey) => string;
  }) => void;
  setLanguage: (lang: 'en' | 'fa') => void;
  setProfile: (patch: Partial<Profile>) => void;
  /** Create a new active category (custom or matching a default key). */
  addCategory: (input: { name: string; icon: string; color: string; key?: CategoryKey }) => Category;
  /** Patch fields on an existing category. */
  updateCategory: (id: string, patch: Partial<Category>) => void;
  /** Soft delete: marks isActive=false + sets archivedAt. Habits are kept. */
  archiveCategory: (id: string) => void;
  /** Restore a previously archived category. */
  restoreCategory: (id: string) => void;
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

  /* Book Tracker */
  addBook: (input: Omit<Book, 'id' | 'status' | 'startedAt' | 'pagesByDate' | 'createdAt'>) => Book;
  updateBook: (id: string, patch: Partial<Book>) => void;
  logBookPages: (id: string, pages: number, date?: string) => void;
  completeBook: (
    id: string,
    fields: { rating?: 1 | 2 | 3 | 4 | 5; review?: string; favouriteQuote?: string },
  ) => void;
  deleteBook: (id: string) => void;
  /** Link the books module to a habit (spec §20.11). Pass undefined to unlink.
   *  When linking, backfills the habit's daily logs from existing book pages. */
  setReadingHabit: (habitId: string | undefined) => void;

  /* Dopamine Reset */
  startReset: (tier: ResetTier, target: string) => DopamineReset;
  logResetCheckIn: (
    id: string,
    fields: { mood: number; insteadOf?: string; urges?: string },
    date?: string,
  ) => void;
  logResetRelapse: (id: string, reflection?: string) => void;
  completeReset: (id: string) => void;
  abandonReset: (id: string) => void;
  deleteReset: (id: string) => void;

  /* Ramadan */
  ensureRamadanRecord: (hijriYear: number) => RamadanProgress;
  setIftarTime: (hijriYear: number, time: string) => void;
  setRamadanFasts: (hijriYear: number, count: number) => void;
  setJuzRead: (hijriYear: number, count: number) => void;
  setTaraweehNights: (hijriYear: number, count: number) => void;
  addSadaqah: (hijriYear: number, amount: number) => void;
  toggleLaylatNight: (hijriYear: number, date: string) => void;
  setShawwalFasts: (hijriYear: number, count: number) => void;
  toggleRamadanPrayer: (hijriYear: number, date: string, prayer: string) => void;

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

/** Spec §20.11: book pages drive the linked reading habit's daily total. */
function syncReadingHabitForDate(
  state: AppState,
  date: string,
): Pick<AppState, 'logs' | 'summaries' | 'streaks'> | null {
  const habitId = state.profile?.readingHabitId;
  if (!habitId) return null;
  const habit = state.habits.find((h) => h.id === habitId);
  if (!habit) return null;

  // Sum only pages-based books. Audiobooks are minutes — different unit,
  // mustn't pollute a pages-based reading habit's daily total.
  let sum = 0;
  for (const b of state.books) {
    if (b.format === 'audiobook') continue;
    sum += b.pagesByDate[date] ?? 0;
  }

  const dayLogs = { ...(state.logs[date] ?? {}) };
  const completed =
    habit.type === 'good'
      ? habit.target === undefined
        ? sum > 0
        : sum >= habit.target
      : sum <= (habit.limit ?? 0);
  dayLogs[habitId] = { habitId, date, value: sum, completed };
  const nextLogs = { ...state.logs, [date]: dayLogs };
  const probe: AppState = { ...state, logs: nextLogs };
  const summary = recomputeSummary(probe, date);
  const streak = recomputeStreakFor(probe, habitId);
  return {
    logs: nextLogs,
    summaries: { ...state.summaries, [date]: summary },
    streaks: streak ? { ...state.streaks, [habitId]: streak } : state.streaks,
  };
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
      books: [],
      resets: [],
      ramadan: [],

      initFromOnboarding: ({
        profile,
        selectedCategoryKeys,
        selectedPresetKeys,
        presetTranslate,
        categoryTranslate,
      }) => {
        const allCategories = buildSeedCategories(categoryTranslate);
        const categories = allCategories.map((c) => ({
          ...c,
          isActive: selectedCategoryKeys.includes(c.key as CategoryKey),
        }));
        // If the caller didn't pass an explicit preset list, fall back to
        // every preset under the selected categories (legacy behavior).
        const presetKeys = selectedPresetKeys ?? presetHabits
          .filter((p) => selectedCategoryKeys.includes(p.category))
          .map((p) => p.presetKey);
        const habits = buildSeedHabits(presetKeys, presetTranslate);
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
          books: [],
          resets: [],
          ramadan: [],
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

      addCategory: ({ name, icon, color, key }) => {
        const id = key ? `cat_${key}` : newId('cat');
        const order = get().categories.reduce((m, c) => Math.max(m, c.order), -1) + 1;
        const cat: Category = {
          id,
          key,
          name: name.trim() || 'Category',
          icon: icon || '◇',
          color: color || '#64748b',
          order,
          isDefault: !!key,
          isActive: true,
        };
        set((s) => {
          // If a category with the same id already exists (e.g. previously
          // archived default), restore it instead of duplicating.
          const idx = s.categories.findIndex((c) => c.id === id);
          if (idx >= 0) {
            const next = [...s.categories];
            next[idx] = { ...next[idx], isActive: true, archivedAt: undefined, name: cat.name, icon: cat.icon, color: cat.color };
            return { categories: next };
          }
          return { categories: [...s.categories, cat] };
        });
        return cat;
      },

      updateCategory: (id, patch) =>
        set((s) => ({
          categories: s.categories.map((c) =>
            c.id === id ? { ...c, ...patch } : c,
          ),
        })),

      archiveCategory: (id) =>
        set((s) => ({
          categories: s.categories.map((c) =>
            c.id === id
              ? { ...c, isActive: false, archivedAt: new Date().toISOString() }
              : c,
          ),
        })),

      restoreCategory: (id) =>
        set((s) => ({
          categories: s.categories.map((c) =>
            c.id === id ? { ...c, isActive: true, archivedAt: undefined } : c,
          ),
        })),

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
          const profile =
            s.profile && s.profile.readingHabitId === habitId
              ? { ...s.profile, readingHabitId: undefined }
              : s.profile;
          return { habits, logs, streaks, pendingRewards, activePunishments, profile };
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

        // The linked reading habit is driven exclusively by book page logs.
        // Manual toggles are a no-op so users can't mark "Read a book" done
        // without actually reading. We still re-run the sync so the log
        // reflects today's book totals (in case a stale entry exists).
        if (get().profile?.readingHabitId === habitId) {
          const synced = syncReadingHabitForDate(get(), day);
          if (synced) set(synced);
          return;
        }

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

        // Best-effort: bump the public live counter for good preset habits
        // when the user transitions from incomplete → complete today.
        const completedNow = get().logs[day]?.[habitId]?.completed ?? false;
        const habitDef = get().habits.find((h) => h.id === habitId);
        if (
          completedNow &&
          habitDef &&
          habitDef.type === 'good' &&
          habitDef.presetKey
        ) {
          void tickHabit(habitDef.presetKey);
        }

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

      addBook: (input) => {
        const id = newId('book');
        const book: Book = {
          ...input,
          id,
          status: 'reading',
          startedAt: new Date().toISOString(),
          pagesByDate: {},
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ books: [book, ...s.books] }));
        return book;
      },

      updateBook: (id, patch) =>
        set((s) => ({
          books: s.books.map((b) => (b.id === id ? { ...b, ...patch } : b)),
        })),

      logBookPages: (id, pages, date) => {
        const day = date ?? todayKey();
        const sanitized = Math.max(0, Math.floor(pages));
        set((s) => ({
          books: s.books.map((b) => {
            if (b.id !== id) return b;
            const next = { ...b.pagesByDate, [day]: sanitized };
            // If they cross totalPages with a log, leave them as 'reading' —
            // the user explicitly clicks Mark as Complete to enter the
            // rating/review flow. We just don't go higher than totalPages
            // when computing progress percent (the helper clamps).
            return { ...b, pagesByDate: next };
          }),
        }));
        const synced = syncReadingHabitForDate(get(), day);
        if (synced) set(synced);
      },

      completeBook: (id, fields) =>
        set((s) => ({
          books: s.books.map((b) =>
            b.id === id
              ? {
                  ...b,
                  status: 'completed' as const,
                  completedAt: new Date().toISOString(),
                  rating: fields.rating ?? b.rating,
                  review: fields.review ?? b.review,
                  favouriteQuote: fields.favouriteQuote ?? b.favouriteQuote,
                }
              : b,
          ),
        })),

      deleteBook: (id) => {
        const book = get().books.find((b) => b.id === id);
        const datesAffected = book ? Object.keys(book.pagesByDate) : [];
        set((s) => ({ books: s.books.filter((b) => b.id !== id) }));
        for (const d of datesAffected) {
          const synced = syncReadingHabitForDate(get(), d);
          if (synced) set(synced);
        }
      },

      setReadingHabit: (habitId) => {
        const { profile } = get();
        if (!profile) return;
        set({ profile: { ...profile, readingHabitId: habitId } });
        if (!habitId) return;
        const dateSet = new Set<string>();
        for (const b of get().books) {
          for (const d of Object.keys(b.pagesByDate)) dateSet.add(d);
        }
        for (const d of dateSet) {
          const synced = syncReadingHabitForDate(get(), d);
          if (synced) set(synced);
        }
      },

      startReset: (tier, target) => {
        const targetDays =
          tier === 'weekly24h'
            ? 1
            : tier === 'monthly7d'
            ? 7
            : tier === 'quarterly30d'
            ? 30
            : 90;
        const now = new Date().toISOString();
        const reset: DopamineReset = {
          id: newId('rst'),
          tier,
          targetDays,
          target: target.trim() || 'reset',
          status: 'active',
          startedAt: now,
          currentStreakStartedAt: now,
          lifetimeCleanDays: 0,
          relapses: [],
          checkIns: {},
          createdAt: now,
        };
        set((s) => ({ resets: [reset, ...s.resets] }));
        return reset;
      },

      logResetCheckIn: (id, fields, date) => {
        const day = date ?? todayKey();
        const checkIn: ResetCheckIn = {
          date: day,
          mood: Math.max(1, Math.min(5, Math.round(fields.mood))),
          insteadOf: fields.insteadOf?.trim() || undefined,
          urges: fields.urges?.trim() || undefined,
          loggedAt: new Date().toISOString(),
        };
        set((s) => ({
          resets: s.resets.map((r) =>
            r.id === id ? { ...r, checkIns: { ...r.checkIns, [day]: checkIn } } : r,
          ),
        }));
      },

      logResetRelapse: (id, reflection) => {
        const now = new Date();
        set((s) => ({
          resets: s.resets.map((r) => {
            if (r.id !== id) return r;
            const cleanDays =
              differenceInCalendarDays(now, parseISO(r.currentStreakStartedAt)) + 1;
            return {
              ...r,
              currentStreakStartedAt: now.toISOString(),
              lifetimeCleanDays: r.lifetimeCleanDays + Math.max(0, cleanDays),
              relapses: [
                ...r.relapses,
                {
                  at: now.toISOString(),
                  reflection: reflection?.trim() || undefined,
                  daysCleanBefore: Math.max(0, cleanDays),
                },
              ],
            };
          }),
        }));
      },

      completeReset: (id) => {
        const now = new Date().toISOString();
        set((s) => ({
          resets: s.resets.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: 'completed' as const,
                  completedAt: now,
                  lifetimeCleanDays:
                    r.lifetimeCleanDays +
                    (differenceInCalendarDays(
                      new Date(),
                      parseISO(r.currentStreakStartedAt),
                    ) +
                      1),
                }
              : r,
          ),
        }));
      },

      abandonReset: (id) => {
        const now = new Date().toISOString();
        set((s) => ({
          resets: s.resets.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: 'abandoned' as const,
                  abandonedAt: now,
                }
              : r,
          ),
        }));
      },

      deleteReset: (id) =>
        set((s) => ({ resets: s.resets.filter((r) => r.id !== id) })),

      ensureRamadanRecord: (hijriYear) => {
        const existing = get().ramadan.find((r) => r.hijriYear === hijriYear);
        if (existing) return existing;
        const fresh: RamadanProgress = {
          hijriYear,
          fastsCompleted: 0,
          juzRead: 0,
          taraweehNights: 0,
          sadaqahTotal: 0,
          laylatNights: {},
          shawwalFasts: 0,
          iftarTime: '18:30',
          prayersByDate: {},
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ ramadan: [...s.ramadan, fresh] }));
        return fresh;
      },

      setIftarTime: (hijriYear, time) =>
        set((s) => ({
          ramadan: s.ramadan.map((r) =>
            r.hijriYear === hijriYear ? { ...r, iftarTime: time } : r,
          ),
        })),

      setRamadanFasts: (hijriYear, count) =>
        set((s) => ({
          ramadan: s.ramadan.map((r) =>
            r.hijriYear === hijriYear
              ? { ...r, fastsCompleted: Math.max(0, Math.min(30, Math.floor(count))) }
              : r,
          ),
        })),

      setJuzRead: (hijriYear, count) =>
        set((s) => ({
          ramadan: s.ramadan.map((r) =>
            r.hijriYear === hijriYear
              ? { ...r, juzRead: Math.max(0, Math.min(30, Math.floor(count))) }
              : r,
          ),
        })),

      setTaraweehNights: (hijriYear, count) =>
        set((s) => ({
          ramadan: s.ramadan.map((r) =>
            r.hijriYear === hijriYear
              ? { ...r, taraweehNights: Math.max(0, Math.min(30, Math.floor(count))) }
              : r,
          ),
        })),

      addSadaqah: (hijriYear, amount) =>
        set((s) => ({
          ramadan: s.ramadan.map((r) =>
            r.hijriYear === hijriYear
              ? { ...r, sadaqahTotal: Math.max(0, r.sadaqahTotal + Math.max(0, amount)) }
              : r,
          ),
        })),

      toggleLaylatNight: (hijriYear, date) =>
        set((s) => ({
          ramadan: s.ramadan.map((r) => {
            if (r.hijriYear !== hijriYear) return r;
            const next = { ...r.laylatNights };
            if (next[date]) delete next[date];
            else next[date] = true;
            return { ...r, laylatNights: next };
          }),
        })),

      setShawwalFasts: (hijriYear, count) =>
        set((s) => ({
          ramadan: s.ramadan.map((r) =>
            r.hijriYear === hijriYear
              ? { ...r, shawwalFasts: Math.max(0, Math.min(6, Math.floor(count))) }
              : r,
          ),
        })),

      toggleRamadanPrayer: (hijriYear, date, prayer) =>
        set((s) => ({
          ramadan: s.ramadan.map((r) => {
            if (r.hijriYear !== hijriYear) return r;
            const list = r.prayersByDate[date] ?? [];
            const next = list.includes(prayer)
              ? list.filter((p) => p !== prayer)
              : [...list, prayer];
            return {
              ...r,
              prayersByDate: { ...r.prayersByDate, [date]: next },
            };
          }),
        })),

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
          books: [],
          resets: [],
          ramadan: [],
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 8,
      migrate: (persisted: any) => {
        if (!persisted) return persisted;
        persisted.rewards = persisted.rewards ?? [];
        persisted.punishments = persisted.punishments ?? [];
        persisted.pendingRewards = persisted.pendingRewards ?? [];
        persisted.activePunishments = persisted.activePunishments ?? [];
        persisted.books = persisted.books ?? [];
        persisted.resets = persisted.resets ?? [];
        persisted.ramadan = (persisted.ramadan ?? []).map((r: any) => ({
          ...r,
          prayersByDate: r.prayersByDate ?? {},
        }));
        if (persisted.profile) {
          persisted.profile.theme = persisted.profile.theme ?? 'auto';
          // Convert old boolean ramadanAutoMode → tri-state ramadanMode.
          if (persisted.profile.ramadanMode === undefined) {
            persisted.profile.ramadanMode =
              persisted.profile.ramadanAutoMode === false ? 'off' : 'auto';
          }
          delete persisted.profile.ramadanAutoMode;
          persisted.profile.prayerMethod = persisted.profile.prayerMethod ?? 'mwl';
          persisted.profile.calendar = persisted.profile.calendar ?? 'gregorian';
          persisted.profile.consequenceSensitivity =
            persisted.profile.consequenceSensitivity ?? 'honest';
          persisted.profile.notifications = persisted.profile.notifications ?? {
            enabled: false,
            dailyTime: '09:00',
            perHabit: {},
          };
          // v7: optional pointer to a "reading" habit (spec §20.11).
          persisted.profile.readingHabitId = persisted.profile.readingHabitId ?? undefined;
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
