'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  ActivePunishment,
  AutophagyFast,
  Book,
  Category,
  CategoryKey,
  DailySummary,
  Debt,
  DopamineReset,
  FastingDayLog,
  FastingPart,
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
  SavingEntry,
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
import {
  tickAutophagyComplete,
  tickAutophagyStart,
  tickResetStart,
} from './activityCounts';
import { playSound } from './sounds';
import { getFireTier, highestCelebratedTier } from './streakFire';
import { recomputeOverallStreak } from './overallStreak';
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

  /* Debts — who owes whom and how much. Currency-agnostic. */
  debts: Debt[];

  /* Savings ledger — deposits and withdrawals, currency-agnostic. */
  savings: SavingEntry[];

  /* Spiritual fasting — multi-part daily log, keyed by date. */
  spiritualFasting: Record<string, FastingDayLog>;

  /* Autophagy fasting — intermittent fasts. The active one (if any) is the
   *  entry whose endedAt is undefined; everything else is history. */
  autophagyFasts: AutophagyFast[];

  /* mutations */
  initFromOnboarding: (args: {
    profile: Profile;
    selectedCategoryKeys: CategoryKey[];
    /** Preset habit keys the user picked during the per-category step.
     *  When omitted, every preset in `selectedCategoryKeys` is used (legacy
     *  back-compat). */
    selectedPresetKeys?: string[];
    /** Resolves a full translation path — called both with `presets.<key>` for
     *  the full-version preset name and with a 2-minute version's `nameKey`
     *  for the smaller starter label. */
    presetTranslate: (key: string) => string;
    categoryTranslate: (key: CategoryKey) => string;
  }) => void;
  setLanguage: (lang: 'en' | 'fa') => void;
  setProfile: (patch: Partial<Profile>) => void;
  /** Create a new active category (custom or matching a default key). */
  addCategory: (input: { name: string; icon: string; color: string; key?: CategoryKey }) => Category;
  /** Patch fields on an existing category. */
  updateCategory: (id: string, patch: Partial<Category>) => void;
  /** Soft delete: marks isActive=false + sets archivedAt. Habits are kept.
   *  Legacy path — retained so existing soft-archived data still restores;
   *  new "Delete category" flows go through `deleteCategory` for hard
   *  cascade delete. */
  archiveCategory: (id: string) => void;
  /** Restore a previously archived category. */
  restoreCategory: (id: string) => void;
  /** Hard cascade delete: removes the category AND every habit in it (with
   *  their logs, streaks, pending rewards, active punishments, and the
   *  reading-habit pointer / linked books). Use this when the user clicks
   *  Delete and confirms — it's irreversible. */
  deleteCategory: (id: string) => void;
  addHabit: (habit: Omit<Habit, 'id' | 'createdAt'>) => Habit;
  deleteHabit: (habitId: string) => void;
  /** Reorder habits by an explicit id sequence. The new order is the
   *  given list, in order; any habits NOT included in `orderedIds`
   *  (e.g. weekly habits invisible on the daily home checklist, or
   *  habits added in another tab during a drag) are appended at the
   *  end so nothing is silently dropped. */
  reorderHabits: (orderedIds: string[]) => void;
  setHabitCritical: (habitId: string, isCritical: boolean) => void;
  setHabitPositiveCargo: (habitId: string, cargo: string | undefined) => void;
  /** Spec §24.1: save the opening + closing rituals for a habit. Either or
   *  both can be undefined; the store trims and normalizes empty values. */
  setHabitRituals: (
    habitId: string,
    rituals: { startRitual?: string; endRitual?: string },
  ) => void;
  /** Spec §23.6: save the habit-stacking sentence ("After I X, I will Y").
   *  Trims and clears empty values to undefined so the detail card hides
   *  itself when the user blanks the field. */
  setHabitStack: (habitId: string, stack: string | undefined) => void;
  /** Spec §23: scale a 2-minute habit up to its full version. The caller
   *  resolves the translated full name and target/unit from the preset and
   *  passes them in; the store just persists. Clears `isTwoMinuteVersion`. */
  levelUpHabit: (
    habitId: string,
    full: { name: string; target?: number; unit?: string },
  ) => void;
  /** Spec §23: user chose "stay at this size" — stamp dismissedAt so we
   *  don't re-pop the prompt for another ~30 days. */
  dismissLevelUpPrompt: (habitId: string) => void;
  toggleHabit: (habitId: string, date?: string) => void;
  /** Three-state checklist cycle: pending → completed → failed → pending.
   *  Reuses toggleHabit for the pending↔completed transitions (preserving
   *  its reward / live-count / sound side-effects) and stamps the log's
   *  `status` for the failed/pending marks. Reading habits (linksToBooks)
   *  are book-driven and ignore this, same as toggleHabit. */
  cycleHabitStatus: (habitId: string, date?: string) => void;
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

  /* Debts */
  addDebt: (input: Omit<Debt, 'id' | 'createdAt' | 'settledAt'>) => Debt;
  updateDebt: (id: string, patch: Partial<Omit<Debt, 'id' | 'createdAt'>>) => void;
  settleDebt: (id: string) => void;
  unsettleDebt: (id: string) => void;
  deleteDebt: (id: string) => void;

  /* Savings */
  addSavingEntry: (input: Omit<SavingEntry, 'id' | 'createdAt'>) => SavingEntry;
  updateSavingEntry: (
    id: string,
    patch: Partial<Omit<SavingEntry, 'id' | 'createdAt'>>,
  ) => void;
  deleteSavingEntry: (id: string) => void;

  /** Stamps profile.lastRestartAt so the "restart smaller" offer cools down
   *  for a week. Called after the user finishes the /restart flow. */
  markRestartDone: () => void;

  /** Marks the user's overall pending streak-fire tier as celebrated and
   *  clears the pending pointer. Single celebration at a time — there's
   *  one overall streak, no queue. */
  dismissOverallTierCelebration: () => void;

  /* Spiritual fasting */
  setFastingPart: (date: string, part: FastingPart, value: boolean) => void;
  setFastingNotes: (date: string, notes: string) => void;

  /* Autophagy fasting */
  startAutophagyFast: (targetHours?: number) => AutophagyFast;
  endAutophagyFast: (id: string, notes?: string) => void;
  cancelAutophagyFast: (id: string) => void;
  deleteAutophagyFast: (id: string) => void;

  /* Dopamine Reset */
  startReset: (tier: ResetTier, target: string) => DopamineReset;
  logResetCheckIn: (
    id: string,
    fields: { mood: number; insteadOf?: string; urges?: string },
    date?: string,
  ) => void;
  logResetRelapse: (id: string, reflection?: string) => void;
  completeReset: (id: string, reflection?: string) => void;
  /** Update the completion reflection on an already-completed reset (used
   *  when the user adds or edits the reflection from the history list). */
  setResetCompletionReflection: (id: string, reflection: string | undefined) => void;
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

/** Recomputes the overall streak from current store state and returns a new
 *  Profile with the updated overallStreak block. If the recompute lifts the
 *  user into a new tier they haven't celebrated yet (and the tier is > 1 —
 *  Spark stays silent), `pendingCelebrationTier` is stamped on the returned
 *  profile. Returns the same profile reference if no changes are needed so
 *  callers can early-out cheaply. */
function applyOverallStreakRecompute(state: AppState): Profile | null {
  const profile = state.profile;
  if (!profile) return null;
  const snap = recomputeOverallStreak(
    state.logs,
    state.habits,
    state.summaries,
    todayKey(),
  );
  const prev = profile.overallStreak ?? {
    current: 0,
    longest: 0,
    lastQualifyingDate: null,
    celebratedTiers: [],
  };
  const ceiling = highestCelebratedTier(prev.celebratedTiers);
  const pendingPrev = prev.pendingCelebrationTier ?? 0;
  const newTier = getFireTier(snap.current);
  const nextLongest = Math.max(prev.longest, snap.longest);
  let nextPending: number | undefined = prev.pendingCelebrationTier;
  if (newTier > 1 && newTier > ceiling && newTier > pendingPrev) {
    nextPending = newTier;
  }
  const next: Profile = {
    ...profile,
    overallStreak: {
      current: snap.current,
      longest: nextLongest,
      lastQualifyingDate: snap.lastQualifyingDate,
      celebratedTiers: prev.celebratedTiers,
      pendingCelebrationTier: nextPending,
    },
  };
  return next;
}

/** Spec §20.11: book pages drive the linked reading habits' daily totals.
 *  A user can have multiple reading habits — one per category, say — and
 *  each habit sums only the pages from books with matching `habitId`. */
function syncBookHabitsForDate(
  state: AppState,
  date: string,
): Pick<AppState, 'logs' | 'summaries' | 'streaks'> | null {
  const readingHabits = state.habits.filter((h) => h.linksToBooks);
  if (readingHabits.length === 0) return null;
  let live: AppState = state;
  let last: Pick<AppState, 'logs' | 'summaries' | 'streaks'> | null = null;
  for (const habit of readingHabits) {
    last = syncOneBookHabitForDate(live, state, habit, date);
    live = { ...live, ...last };
  }
  return last;
}

function syncOneBookHabitForDate(
  liveState: AppState,
  baseState: AppState,
  habit: Habit,
  date: string,
): Pick<AppState, 'logs' | 'summaries' | 'streaks'> {
  // Sum only pages-based books linked to THIS habit. Audiobooks are minutes —
  // different unit, mustn't pollute a pages-based reading habit's daily total.
  let sum = 0;
  for (const b of baseState.books) {
    if (b.format === 'audiobook') continue;
    if (b.habitId !== habit.id) continue;
    sum += b.pagesByDate[date] ?? 0;
  }

  const dayLogs = { ...(liveState.logs[date] ?? {}) };
  const completed =
    habit.type === 'good'
      ? habit.target === undefined
        ? sum > 0
        : sum >= habit.target
      : sum <= (habit.limit ?? 0);
  dayLogs[habit.id] = { habitId: habit.id, date, value: sum, completed };
  const nextLogs = { ...liveState.logs, [date]: dayLogs };
  const probe: AppState = { ...liveState, logs: nextLogs };
  const summary = recomputeSummary(probe, date);
  const streak = recomputeStreakFor(probe, habit.id);
  return {
    logs: nextLogs,
    summaries: { ...liveState.summaries, [date]: summary },
    streaks: streak
      ? { ...liveState.streaks, [habit.id]: streak }
      : liveState.streaks,
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
      debts: [],
      savings: [],
      spiritualFasting: {},
      autophagyFasts: [],

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
        // Spec §23: onboarding habits default to their 2-minute starter
        // size where one exists. Users can level up via the home/detail
        // prompt after a 30-day streak.
        const habits = buildSeedHabits(presetKeys, presetTranslate, {
          useTwoMinuteVersion: true,
        });
        set({
          profile: {
            ...profile,
            overallStreak: profile.overallStreak ?? {
              current: 0,
              longest: 0,
              lastQualifyingDate: null,
              celebratedTiers: [],
            },
          },
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
          debts: [],
          savings: [],
      spiritualFasting: {},
      autophagyFasts: [],
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

      deleteCategory: (id) => {
        // Cascade: each habit's deleteHabit already handles its own logs,
        // streaks, pending rewards, active punishments, profile pointers,
        // and orphaned books. Iterating here gives all of that for free.
        // Snapshot the habit ids first so we don't mutate-while-iterating.
        const habitIds = get()
          .habits.filter((h) => h.categoryId === id)
          .map((h) => h.id);
        for (const habitId of habitIds) {
          get().deleteHabit(habitId);
        }
        // Hard-remove the category record itself (not soft-archive).
        set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }));
      },

      addHabit: (input) => {
        const id = newId('habit');
        const habit: Habit = {
          ...input,
          id,
          createdAt: new Date().toISOString(),
        };
        // Append, NOT prepend — new habits land at the end of the
        // user's existing order. That preserves whatever sequence the
        // user has dragged their list into and avoids surprising
        // them with a fresh entry jumping in at the top.
        set((s) => ({ habits: [...s.habits, habit] }));
        const today = todayKey();
        set((s) => ({ summaries: { ...s.summaries, [today]: recomputeSummary(get(), today) } }));
        return habit;
      },

      reorderHabits: (orderedIds) => {
        set((s) => {
          // Build the reordered prefix from the explicit id list,
          // dropping any ids that no longer correspond to a habit
          // (e.g. one was deleted mid-drag).
          const byId = new Map(s.habits.map((h) => [h.id, h]));
          const reordered: Habit[] = [];
          for (const id of orderedIds) {
            const h = byId.get(id);
            if (h) reordered.push(h);
          }
          // Anything NOT in the explicit list (weekly habits, new
          // additions during the drag) gets appended in its original
          // relative order — no silent drops, no shuffling.
          const seen = new Set(orderedIds);
          const remaining = s.habits.filter((h) => !seen.has(h.id));
          return { habits: [...reordered, ...remaining] };
        });
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
          // Orphan any books that pointed to the deleted habit — keep the
          // book record, but unlink it so it can be reassigned later.
          const books = s.books.map((b) =>
            b.habitId === habitId ? { ...b, habitId: undefined } : b,
          );
          return { habits, logs, streaks, pendingRewards, activePunishments, profile, books };
        });
        const today = todayKey();
        set((s) => ({ summaries: { ...s.summaries, [today]: recomputeSummary(get(), today) } }));
      },

      setHabitCritical: (habitId, isCritical) => {
        set((s) => ({
          habits: s.habits.map((h) => (h.id === habitId ? { ...h, isCritical } : h)),
        }));
      },

      setHabitPositiveCargo: (habitId, cargo) => {
        const trimmed = cargo?.trim();
        set((s) => ({
          habits: s.habits.map((h) =>
            h.id === habitId
              ? { ...h, positiveCargo: trimmed && trimmed.length > 0 ? trimmed : undefined }
              : h,
          ),
        }));
      },

      setHabitRituals: (habitId, rituals) => {
        const start = rituals.startRitual?.trim();
        const end = rituals.endRitual?.trim();
        set((s) => ({
          habits: s.habits.map((h) =>
            h.id === habitId
              ? {
                  ...h,
                  startRitual: start && start.length > 0 ? start : undefined,
                  endRitual: end && end.length > 0 ? end : undefined,
                }
              : h,
          ),
        }));
      },

      setHabitStack: (habitId, stack) => {
        const trimmed = stack?.trim();
        set((s) => ({
          habits: s.habits.map((h) =>
            h.id === habitId
              ? { ...h, habitStack: trimmed && trimmed.length > 0 ? trimmed : undefined }
              : h,
          ),
        }));
      },

      levelUpHabit: (habitId, full) => {
        set((s) => ({
          habits: s.habits.map((h) =>
            h.id === habitId
              ? {
                  ...h,
                  name: full.name,
                  target: full.target,
                  unit: full.unit,
                  isTwoMinuteVersion: undefined,
                  levelUpPromptDismissedAt: undefined,
                }
              : h,
          ),
        }));
      },

      dismissLevelUpPrompt: (habitId) => {
        const now = new Date().toISOString();
        set((s) => ({
          habits: s.habits.map((h) =>
            h.id === habitId ? { ...h, levelUpPromptDismissedAt: now } : h,
          ),
        }));
      },

      toggleHabit: (habitId, date) => {
        const day = date ?? todayKey();
        const prevRate = get().summaries[day]?.completionRate ?? 0;
        const prevStreak = get().streaks[habitId]?.current ?? 0;
        const wasComplete = get().logs[day]?.[habitId]?.completed ?? false;

        // Reading habits (linksToBooks=true) are driven exclusively by book
        // page logs. Manual toggles are a no-op so users can't mark "Read a
        // book" done without actually reading. We still re-run the sync so
        // the log reflects today's book totals (in case a stale entry exists).
        if (get().habits.find((h) => h.id === habitId)?.linksToBooks) {
          const synced = syncBookHabitsForDate(get(), day);
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
        // Overall streak — one fire, one identity (see overallStreak.ts).
        const nextProfile = applyOverallStreakRecompute(get());
        if (nextProfile) set({ profile: nextProfile });

        // Per-toggle sound. Daily-complete and streak-milestone sounds
        // fire below alongside the reward queue, so they replace the
        // plain tick when both fire on the same toggle.
        const nowComplete = get().logs[day]?.[habitId]?.completed ?? false;
        if (nowComplete && !wasComplete) playSound('tick');
        else if (!nowComplete && wasComplete) playSound('untick');

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
          // Pick the most "important" cue rather than stacking sounds.
          const hasMilestone = additions.some((a) => a.origin !== 'dailyComplete');
          const hasDaily = additions.some((a) => a.origin === 'dailyComplete');
          if (hasMilestone) playSound('chime');
          else if (hasDaily) playSound('flourish');
          else playSound('reward');
        }
      },

      cycleHabitStatus: (habitId, date) => {
        const day = date ?? todayKey();
        const habit = get().habits.find((h) => h.id === habitId);
        if (!habit) return;

        // Reading habits are driven by book-page logs — defer to the same
        // no-op-then-sync path toggleHabit uses. No tri-state for them.
        if (habit.linksToBooks) {
          get().toggleHabit(habitId, day);
          return;
        }

        const log = get().logs[day]?.[habitId];
        const current: 'completed' | 'failed' | 'pending' =
          log?.status ?? (log?.completed ? 'completed' : 'pending');

        // Stamp the status field on the existing log without disturbing
        // value/completed (already correct from the toggle below) and
        // without re-running the recompute (completed didn't change in the
        // stamp step, so summary/streak/fire are already up to date).
        const stamp = (status: 'completed' | 'failed') =>
          set((s) => {
            const dayLogs = s.logs[day];
            const existing = dayLogs?.[habitId];
            if (!existing) return s;
            return {
              logs: {
                ...s.logs,
                [day]: { ...dayLogs, [habitId]: { ...existing, status } },
              },
            };
          });

        if (current === 'pending') {
          // → completed. toggleHabit flips completed false→true and runs
          // the full reward / live-count / sound machinery.
          get().toggleHabit(habitId, day);
          stamp('completed');
        } else if (current === 'completed') {
          // → failed. toggleHabit flips completed true→false (untick sound
          // + recompute); then mark it explicitly failed. value is already
          // 0 (good) or limit+1 (bad) from the toggle, which reads as
          // not-successful — exactly what "failed" means.
          get().toggleHabit(habitId, day);
          stamp('failed');
        } else {
          // failed → pending. Clear the log entry entirely so the day reads
          // as untouched. completed was already false, so isLogSuccessful is
          // unchanged — but recompute summary/streak/fire anyway to drop the
          // stale value (a bad habit's failed log carried value=limit+1).
          set((s) => {
            const dayLogs = { ...(s.logs[day] ?? {}) };
            delete dayLogs[habitId];
            return { logs: { ...s.logs, [day]: dayLogs } };
          });
          const newSummary = recomputeSummary(get(), day);
          const newStreak = recomputeStreakFor(get(), habitId);
          set((s) => ({
            summaries: { ...s.summaries, [day]: newSummary },
            streaks: newStreak ? { ...s.streaks, [habitId]: newStreak } : s.streaks,
          }));
          const nextProfile = applyOverallStreakRecompute(get());
          if (nextProfile) set({ profile: nextProfile });
          playSound('untick');
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
        // Overall streak (see overallStreak.ts).
        const nextProfile = applyOverallStreakRecompute(get());
        if (nextProfile) set({ profile: nextProfile });
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

      claimReward: (id) => {
        set((s) => ({
          pendingRewards: s.pendingRewards.map((r) =>
            r.id === id && !r.claimedAt ? { ...r, claimedAt: new Date().toISOString() } : r,
          ),
        }));
        playSound('chime');
      },

      resolvePunishment: (id) => {
        set((s) => ({
          activePunishments: s.activePunishments.map((p) =>
            p.id === id && !p.doneAt ? { ...p, doneAt: new Date().toISOString() } : p,
          ),
        }));
        playSound('softUp');
      },

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
        // Audible nudge when at least one new punishment lands today.
        // Backfill of older days is silent — too noisy on first reopen
        // after a streak of missed days.
        if (newPunishments.some((p) => p.date === yesterday)) {
          playSound('lowTone');
        }
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
        const prevPages = get().books.find((b) => b.id === id)?.pagesByDate[day] ?? 0;
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
        const synced = syncBookHabitsForDate(get(), day);
        if (synced) set(synced);
        // Sound when the user actually adds pages (not on zeroing/edit-down).
        if (sanitized > prevPages) playSound('tick');
      },

      completeBook: (id, fields) => {
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
        }));
        playSound('flourish');
      },

      deleteBook: (id) => {
        const book = get().books.find((b) => b.id === id);
        const datesAffected = book ? Object.keys(book.pagesByDate) : [];
        set((s) => ({ books: s.books.filter((b) => b.id !== id) }));
        for (const d of datesAffected) {
          const synced = syncBookHabitsForDate(get(), d);
          if (synced) set(synced);
        }
      },

      setReadingHabit: (habitId) => {
        // Flip the linksToBooks flag on the targeted habit (or clear it, when
        // habitId is undefined → undo the link on the previous reading habit).
        // Also keep profile.readingHabitId in sync as the legacy "primary"
        // pointer used by older clients; new behaviour reads from the flag.
        const { profile } = get();
        if (!profile) return;
        const previousId = profile.readingHabitId;
        set((s) => ({
          profile: profile ? { ...profile, readingHabitId: habitId } : profile,
          habits: s.habits.map((h) => {
            if (h.id === habitId) return { ...h, linksToBooks: true };
            if (!habitId && h.id === previousId) {
              return { ...h, linksToBooks: false };
            }
            return h;
          }),
          // Books that had no owner adopt the new habit so existing logs keep
          // flowing somewhere — preserves prior behaviour where a single
          // reading habit aggregated everything.
          books: habitId
            ? s.books.map((b) => (b.habitId ? b : { ...b, habitId }))
            : s.books,
        }));
        const dateSet = new Set<string>();
        for (const b of get().books) {
          for (const d of Object.keys(b.pagesByDate)) dateSet.add(d);
        }
        for (const d of dateSet) {
          const synced = syncBookHabitsForDate(get(), d);
          if (synced) set(synced);
        }
      },

      addDebt: (input) => {
        const debt: Debt = {
          ...input,
          id: newId('debt'),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ debts: [debt, ...s.debts] }));
        return debt;
      },

      updateDebt: (id, patch) =>
        set((s) => ({
          debts: s.debts.map((d) => (d.id === id ? { ...d, ...patch } : d)),
        })),

      settleDebt: (id) => {
        set((s) => ({
          debts: s.debts.map((d) =>
            d.id === id ? { ...d, settledAt: new Date().toISOString() } : d,
          ),
        }));
        playSound('flourish');
      },

      unsettleDebt: (id) =>
        set((s) => ({
          debts: s.debts.map((d) =>
            d.id === id ? { ...d, settledAt: undefined } : d,
          ),
        })),

      deleteDebt: (id) =>
        set((s) => ({ debts: s.debts.filter((d) => d.id !== id) })),

      addSavingEntry: (input) => {
        const entry: SavingEntry = {
          ...input,
          id: newId('save'),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ savings: [entry, ...s.savings] }));
        if (input.amount > 0) playSound('softUp');
        return entry;
      },

      updateSavingEntry: (id, patch) =>
        set((s) => ({
          savings: s.savings.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),

      deleteSavingEntry: (id) =>
        set((s) => ({ savings: s.savings.filter((e) => e.id !== id) })),

      markRestartDone: () => {
        const { profile } = get();
        if (!profile) return;
        set({
          profile: { ...profile, lastRestartAt: new Date().toISOString() },
        });
        playSound('flourish');
      },

      dismissOverallTierCelebration: () => {
        const profile = get().profile;
        if (!profile?.overallStreak?.pendingCelebrationTier) return;
        const tier = profile.overallStreak.pendingCelebrationTier;
        const already = profile.overallStreak.celebratedTiers;
        set({
          profile: {
            ...profile,
            overallStreak: {
              ...profile.overallStreak,
              celebratedTiers: already.includes(tier)
                ? already
                : [...already, tier],
              pendingCelebrationTier: undefined,
            },
          },
        });
      },

      setFastingPart: (date, part, value) => {
        const prevDay = get().spiritualFasting[date];
        const prevValue = prevDay?.parts?.[part] === true;
        set((s) => {
          const day: FastingDayLog = prevDay
            ? { ...prevDay, parts: { ...prevDay.parts, [part]: value } }
            : { date, parts: { [part]: value } };
          return { spiritualFasting: { ...s.spiritualFasting, [date]: day } };
        });
        if (value && !prevValue) playSound('tick');
        else if (!value && prevValue) playSound('untick');
      },

      setFastingNotes: (date, notes) =>
        set((s) => {
          const prev = s.spiritualFasting[date];
          const day: FastingDayLog = prev
            ? { ...prev, notes: notes || undefined }
            : { date, parts: {}, notes: notes || undefined };
          return { spiritualFasting: { ...s.spiritualFasting, [date]: day } };
        }),

      startAutophagyFast: (targetHours) => {
        // End any in-progress fast first — only one active fast at a time.
        const inProgress = get().autophagyFasts.find((f) => !f.endedAt);
        if (inProgress) {
          set((s) => ({
            autophagyFasts: s.autophagyFasts.map((f) =>
              f.id === inProgress.id
                ? { ...f, endedAt: new Date().toISOString() }
                : f,
            ),
          }));
        }
        const fast: AutophagyFast = {
          id: newId('fast'),
          startedAt: new Date().toISOString(),
          targetHours,
        };
        set((s) => ({ autophagyFasts: [fast, ...s.autophagyFasts] }));
        playSound('softUp');
        // Best-effort: count the user as one of today's fast-starters.
        // Public aggregate so /autophagy can show "N people started a fast
        // today alongside you". Per-day-per-user dedupe inside the lib.
        void tickAutophagyStart();
        return fast;
      },

      endAutophagyFast: (id, notes) => {
        set((s) => ({
          autophagyFasts: s.autophagyFasts.map((f) =>
            f.id === id
              ? {
                  ...f,
                  endedAt: f.endedAt ?? new Date().toISOString(),
                  notes: notes ?? f.notes,
                }
              : f,
          ),
        }));
        playSound('flourish');
        // Best-effort: count the user as one of today's completed fasts.
        void tickAutophagyComplete();
      },

      cancelAutophagyFast: (id) =>
        set((s) => ({
          autophagyFasts: s.autophagyFasts.filter((f) => f.id !== id),
        })),

      deleteAutophagyFast: (id) =>
        set((s) => ({
          autophagyFasts: s.autophagyFasts.filter((f) => f.id !== id),
        })),

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
        // Best-effort: count the user as one of today's new resetters.
        // Public aggregate for the "N people started a reset today" line.
        void tickResetStart();
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
        playSound('pulse');
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
        playSound('lowTone');
      },

      completeReset: (id, reflection) => {
        const now = new Date().toISOString();
        const trimmed = reflection?.trim();
        set((s) => ({
          resets: s.resets.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: 'completed' as const,
                  completedAt: now,
                  completionReflection:
                    trimmed && trimmed.length > 0 ? trimmed : r.completionReflection,
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
        playSound('flourish');
      },

      setResetCompletionReflection: (id, reflection) => {
        const trimmed = reflection?.trim();
        set((s) => ({
          resets: s.resets.map((r) =>
            r.id === id
              ? {
                  ...r,
                  completionReflection:
                    trimmed && trimmed.length > 0 ? trimmed : undefined,
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
      version: 15,
      migrate: (persisted: any) => {
        if (!persisted) return persisted;
        persisted.rewards = persisted.rewards ?? [];
        persisted.punishments = persisted.punishments ?? [];
        persisted.pendingRewards = persisted.pendingRewards ?? [];
        persisted.activePunishments = persisted.activePunishments ?? [];
        persisted.books = persisted.books ?? [];
        persisted.resets = persisted.resets ?? [];
        persisted.debts = persisted.debts ?? [];
        persisted.savings = persisted.savings ?? [];
        persisted.spiritualFasting = persisted.spiritualFasting ?? {};
        persisted.autophagyFasts = persisted.autophagyFasts ?? [];
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
          // v9: synthesized chimes default ON.
          persisted.profile.soundEnabled = persisted.profile.soundEnabled ?? true;
        }
        // v10: multi-instance reading habits. Carry forward any prior single
        // reading habit (either pointed to by profile.readingHabitId or
        // detected via presetKey === 'reading') by flipping its linksToBooks
        // flag, and assign existing books to it so totals don't reset.
        const readingHabitId: string | undefined = persisted.profile?.readingHabitId;
        if (Array.isArray(persisted.habits)) {
          persisted.habits = persisted.habits.map((h: any) => {
            if (h.linksToBooks) return h;
            if (h.id === readingHabitId || h.presetKey === 'reading') {
              return { ...h, linksToBooks: true };
            }
            return h;
          });
        }
        if (Array.isArray(persisted.books) && readingHabitId) {
          persisted.books = persisted.books.map((b: any) =>
            b.habitId ? b : { ...b, habitId: readingHabitId },
          );
        }
        // v14: seed the new overall-streak field with a fresh compute over
        // the user's full log history. celebratedTiers stays empty so the
        // next toggle queues one celebration for the user's current tier
        // — we don't replay the whole history at upgrade time.
        if (persisted.profile && !persisted.profile.overallStreak) {
          const todayISO = todayKey();
          const snap = recomputeOverallStreak(
            persisted.logs ?? {},
            persisted.habits ?? [],
            persisted.summaries ?? {},
            todayISO,
          );
          persisted.profile.overallStreak = {
            current: snap.current,
            longest: snap.longest,
            lastQualifyingDate: snap.lastQualifyingDate,
            celebratedTiers: [],
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
