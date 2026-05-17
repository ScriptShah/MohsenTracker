export type CategoryKey =
  | 'islamic'
  | 'health'
  | 'sport'
  | 'finance'
  | 'career'
  | 'growth'
  | 'relationships';

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
  /** Spec §24.2: bad habits can carry a "positive cargo" — a small good deed
   *  the user commits to doing immediately after a slip. When set, the
   *  checklist surfaces it as a prompt the moment a slip is logged, paired
   *  with the Quranic anchor (11:114): "Indeed, good deeds erase bad deeds."
   *  Free text; meaningful only on bad habits. */
  positiveCargo?: string;
  /** Spec §24.1: optional opening + closing rituals the user does every time
   *  they do this habit. Same two-second moves before and after train the
   *  brain to flip into the habit on cue and flip out cleanly when it's done
   *  ("task bracketing" — habit-formation research). Free text on both
   *  sides; meaningful on any habit type. */
  startRitual?: string;
  endRitual?: string;
  /** Missing this habit triggers a punishment via daily reconciliation (spec §5.5). */
  isCritical?: boolean;
  /** When true, this habit is driven by book-page logs (spec §20.11). Tapping
   *  its check opens the book picker scoped to this habit, and its daily value
   *  is the sum of pages logged today across books with matching `Book.habitId`.
   *  Multiple habits can carry this flag — e.g. one per category of reading. */
  linksToBooks?: boolean;
  /** Spec §23: true when the habit was created at its 2-minute starter size
   *  rather than the full preset target. After a 30-day streak the home and
   *  detail screens surface a one-time "ready to level up?" prompt. Cleared
   *  when the user accepts the level-up. Only set for preset habits whose
   *  preset has a `twoMinuteVersion` defined. */
  isTwoMinuteVersion?: boolean;
  /** Spec §23: ISO timestamp set when the user chooses "stay at this size".
   *  Suppresses the level-up prompt for ~30 days so we don't nag. */
  levelUpPromptDismissedAt?: string;
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

export type ThemeMode = 'auto' | 'light' | 'dark';
export type CalendarPreference = 'gregorian' | 'jalali' | 'hijri';
export type PrayerCalcMethod = 'mwl' | 'isna' | 'tehran' | 'umm-al-qura';
export type ConsequenceSensitivity = 'off' | 'mild' | 'honest' | 'full';
export type RamadanModeSetting = 'auto' | 'on' | 'off';

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
  /** auto = activate during Ramadan; on = always on; off = never. */
  ramadanMode: RamadanModeSetting;
  /** Free-text city or one of the curated dropdown values. */
  prayerCity?: string;
  prayerMethod: PrayerCalcMethod;
  calendar: CalendarPreference;
  consequenceSensitivity: ConsequenceSensitivity;
  notifications: NotificationPreferences;
  /** Habit id of the user's reading habit. Book page logs feed this habit's
   *  daily total via the store's sync helper (spec §20.11). */
  readingHabitId?: string;
  /** Synthesized chimes on habit toggles, rewards, milestones, etc. */
  soundEnabled: boolean;
  /** The Firebase uid this local snapshot last synced to/from. Used to
   *  detect cross-account contamination on a shared device: if a fresh
   *  user signs in (no cloud snapshot yet) but local data is stamped with
   *  a DIFFERENT uid, we know the local data belongs to a previous user
   *  on this device and must NOT be pushed into the new user's cloud.
   *  Stamped on every push and overwritten on every successful pull. */
  cloudSyncUid?: string;
  /** Spec §22: when true, Home surfaces a one-tap "I'm angry" button that
   *  opens the Prophetic ﷺ anger protocol overlay (ta'awwudh → posture →
   *  wudu → 90s silence → dua). Off by default — the feature is opt-in so
   *  users who'd find it judgmental never see it. */
  angerProtocolEnabled?: boolean;
  /** Which sentence track the streak-fire celebrations use. 'smart' picks
   *  Islamic for habits in the Islamic Practices category and Universal
   *  for everything else. Default 'smart'. Optional for back-compat. */
  fireSentenceStyle?: 'smart' | 'islamic' | 'universal';
  /** Last time the user went through the "restart smaller" flow (ISO). Used
   *  as a cooldown so the offer doesn't re-pop the day after — the user
   *  committed to a leaner list; let it breathe for a week. */
  lastRestartAt?: string;
  /** ONE fire for the user's overall journey. A day qualifies if all
   *  critical habits done OR (no critical habits AND any habit done).
   *  Replaces the old per-habit fire grid on Future Self. Optional for
   *  back-compat; migration v14 seeds it from the user's full log history. */
  overallStreak?: {
    current: number;
    longest: number;
    lastQualifyingDate: string | null;
    /** Tiers (1-7) already shown in the celebration modal. */
    celebratedTiers: number[];
    /** Tier number stashed by a fresh tier-cross, awaiting celebration. */
    pendingCelebrationTier?: number;
  };
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

/* ── Ramadan progress (spec §6.1) ──────────────────────────────────────── */

export interface RamadanProgress {
  hijriYear: number;
  /** Days the user fasted (0..30). */
  fastsCompleted: number;
  /** Quran juz read this Ramadan (0..30). */
  juzRead: number;
  /** Number of nights Taraweeh was attended. */
  taraweehNights: number;
  /** Cumulative sadaqah given this Ramadan (currency-agnostic). */
  sadaqahTotal: number;
  /** Laylat al-Qadr nights worshipped — Gregorian YYYY-MM-DD → marked. */
  laylatNights: Record<string, boolean>;
  /** Six fasts of Shawwal — completed count (0..6). */
  shawwalFasts: number;
  /** User-set Iftar time HH:mm (24h). */
  iftarTime: string;
  /** YYYY-MM-DD → array of prayer keys done that day (fajr, dhuhr, …, tahajjud). */
  prayersByDate: Record<string, string[]>;
  createdAt: string;
}

/* ── Dopamine Reset (spec §19) ─────────────────────────────────────────── */

export type ResetTier = 'weekly24h' | 'monthly7d' | 'quarterly30d' | 'deep90d';
export type ResetStatus = 'active' | 'completed' | 'abandoned';

export type ResetStage =
  | 'cravings'
  | 'adjustment'
  | 'clarity'
  | 'restoration'
  | 'integration'
  | 'mastery';

export interface ResetCheckIn {
  date: string;            // YYYY-MM-DD
  /** 1 = struggling, 5 = thriving. */
  mood: number;
  /** What the user did instead of the thing they're resetting from. */
  insteadOf?: string;
  /** Urges journal — free text. */
  urges?: string;
  loggedAt: string;
}

export interface ResetRelapse {
  at: string;
  reflection?: string;
  /** How many clean days were on the streak before this relapse. */
  daysCleanBefore: number;
}

export interface DopamineReset {
  id: string;
  tier: ResetTier;
  targetDays: number;
  /** Free-text label for what the user is taking a break from. */
  target: string;
  status: ResetStatus;
  startedAt: string;
  completedAt?: string;
  abandonedAt?: string;
  /** ISO timestamp; resets to "now" on every relapse. */
  currentStreakStartedAt: string;
  /** Sum of clean days across all earlier streaks of THIS reset. Spec §19.7
   * keeps "lifetime clean days" growing even when the streak resets. */
  lifetimeCleanDays: number;
  relapses: ResetRelapse[];
  checkIns: Record<string, ResetCheckIn>;
  /** Optional free-text reflection captured when the reset completes — what
   *  changed, what they learned, what's different now. Surfaced in the
   *  history list so the user can look back on the result of each reset. */
  completionReflection?: string;
  createdAt: string;
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
  /** The reading-type habit that owns this book's daily page totals. Multiple
   *  reading habits can exist; each book belongs to one. Unassigned books
   *  appear in every reading habit's picker as "unattached". */
  habitId?: string;
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

/* ── Spiritual fasting (multi-part daily log) ──────────────────────────── */

/** The five parts of fasting in the Islamic tradition — food/drink is the
 *  obvious one, but the senses are equally meant to fast from sin: eyes
 *  from haram looks, ears from gossip, hands from harm, tongue from lies. */
export type FastingPart = 'eyes' | 'ears' | 'hands' | 'tongue' | 'food';

export interface FastingDayLog {
  /** YYYY-MM-DD. */
  date: string;
  /** Which parts the user kept fasted that day. Absent keys default to false. */
  parts: Partial<Record<FastingPart, boolean>>;
  /** Optional free-text reflection — what they slipped on, what helped. */
  notes?: string;
}

/* ── Autophagy fasting (intermittent-fasting timer) ────────────────────── */

export interface AutophagyFast {
  id: string;
  /** ISO timestamp the user started the fast. */
  startedAt: string;
  /** ISO timestamp the user ended the fast. Absent → fast is in progress. */
  endedAt?: string;
  /** Optional target window in hours (e.g. 16 for 16:8, 18 for 18:6). */
  targetHours?: number;
  notes?: string;
}

/* ── Savings (ledger) ──────────────────────────────────────────────────── */

export interface SavingEntry {
  id: string;
  /** Positive = deposit, negative = withdrawal. The UI splits the two but
   *  storage uses a single signed amount so a running total is one reduce. */
  amount: number;
  /** YYYY-MM-DD — the date the user assigns to this entry. */
  date: string;
  /** Free-text — what the deposit/withdrawal was for. */
  note?: string;
  createdAt: string;
}

/* ── Debts (who-owes-who tracker) ──────────────────────────────────────── */

export type DebtDirection = 'theyOwe' | 'youOwe';

export interface Debt {
  id: string;
  /** Who the debt is with — free text, e.g. "Hassan", "Mum", "the office". */
  counterparty: string;
  /** Currency-agnostic. The number is what's owed, not a signed value —
   *  direction carries the sign. */
  amount: number;
  direction: DebtDirection;
  notes?: string;
  createdAt: string;
  /** Set when the debt is repaid in full. The debt is kept in storage so the
   *  user has a history; the UI moves settled debts into a collapsed list. */
  settledAt?: string;
}

/* ── Workspaces (shared habit spaces) ──────────────────────────────────── */

/** Pair = exactly 2 members (buddy / spouse). Group = 3 to maxMembers
 *  (family, study circle, team). Same data shape under the hood — only
 *  `mode` and `maxMembers` differ; the UX framing per mode differs. */
export type WorkspaceMode = 'pair' | 'group';

/** Member roles inside a workspace. Owner can edit shared habits, rotate
 *  the invite code, and remove members. Members can only manage their own
 *  daily logs and their own membership (leave / share toggles). */
export type WorkspaceRole = 'owner' | 'member';

/** Lives at `workspaces/{id}` in Firestore. The local Zustand store also
 *  caches a copy under the user's snapshot so workspace info is available
 *  offline; the Firestore doc is the source of truth. */
export interface Workspace {
  id: string;
  mode: WorkspaceMode;
  /** Free-text label the owner picked at creation. */
  title: string;
  /** Single-emoji icon, used in lists and the home-screen badge. */
  icon: string;
  /** Firebase uid of the creator — has owner permissions. */
  ownerUid: string;
  /** Every current member's Firebase uid, including the owner. Kept on the
   *  parent doc (not only in the subcollection) so Firestore rules can
   *  verify membership without a cross-doc `get()`. Capped at maxMembers. */
  memberUids: string[];
  /** 2 for pair, 10 for group (v1). Hard ceiling enforced both client-side
   *  and in Firestore rules. */
  maxMembers: number;
  /** Short, rotatable, random alphanumeric. The invite URL is
   *  `/workspaces/join?code=…`. Rotating clears old links. Resolved via
   *  the public `workspaceInvites/{code}` lookup doc. */
  inviteCode: string;
  createdAt: string;
}

/** Lives at `workspaces/{wsId}/members/{uid}`. Holds the denormalized
 *  display info so the member list doesn't need a parallel auth-server
 *  lookup. Each member writes their own member doc; the owner can delete
 *  any member doc (kick). */
export interface WorkspaceMember {
  uid: string;
  displayName: string;
  photoURL?: string;
  joinedAt: string;
  role: WorkspaceRole;
}

/** Lives at `workspaceInvites/{inviteCode}`. Public-read so a new device
 *  visiting an invite link can resolve the code → wsId before requesting
 *  the workspace doc itself. Created/rotated by the owner. */
export interface WorkspaceInvite {
  inviteCode: string;
  wsId: string;
  createdAt: string;
}
