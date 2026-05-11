# Mohsen Tracker — Project State Snapshot

> External-review snapshot. Pairs with `HABIT_TRACKER_SPEC.md` (design
> intent) and `CLAUDE.md` (architecture + operational guide). This file
> describes the **concrete reality** at the tip of branch
> `claude/overall-streak` — the StreakFire per-habit → overall refactor
> in flight as PR #13 (about to be opened). Last `main` SHA referenced is
> `72cab77`; everything since is the seven-commit refactor described in
> §4 and §9.

---

## 1. Last Updated

- **Timestamp (UTC)**: 2026-05-11T09:57:10Z
- **Branch**: `claude/overall-streak` (off `main` @ `72cab77`)
- **Tip commit SHA**: `f81841aa656a614c195f6a02246e6606bb0925a1`
- **Tip commit**: `f81841a — StreakFire: remove per-habit fire fields + helper + legacy dismiss`
- **Typecheck**: ✅ passes (`tsc --noEmit`)
- **Lint**: passes with 3 pre-existing warnings (none on streak-fire code) — `<img>` instead of `<Image>` in `BookCover.tsx` + `books/new/page.tsx`, missing `useEffect` dep in `books/[id]/page.tsx`. Unchanged from the previous snapshot.

---

## 2. Quick Summary

Mohsen Tracker is a bilingual (English + Persian) habit-tracking PWA grounded in *The Compound Effect* + *Atomic Habits*, with first-class Islamic practice tracking (prayers, Quran, Sunnah, Ramadan mode). It runs as a local-first Zustand-persisted Next.js 14 app, with optional Firebase (Auth + Firestore live counts + per-user snapshot sync). The most recent change is the **per-habit → overall StreakFire refactor** on the current branch: the seven Spark-through-Diamond tiers no longer attach to individual habits; they now represent the user's overall journey via a single qualifying-day rule (all critical habits done OR — when there are no critical habits — any habit done). The Future Self page renders one XL fire instead of a per-habit grid. The celebration modal fires once per tier crossing the user hasn't seen yet. The app remains undeployed — it runs only on the developer's machine.

---

## 3. Feature Completion Matrix

| Feature | Spec Section | Status | Files | Notes |
|---|---|---|---|---|
| Onboarding (8-step) | §7.1 | ✅ Complete | `src/app/[locale]/onboarding/page.tsx` | Skippable sign-in when Firebase unconfigured. |
| Home dashboard | §7.2 | ✅ Complete | `src/app/[locale]/page.tsx` | Greeting + 3 hearts + completion ring + Ramadan/restart banners + rotating compound + reset card + reading card + habit checklist. |
| 3-lives hearts indicator | (post-spec) | ✅ Complete | `src/app/[locale]/page.tsx`, `src/lib/restart.ts` | <50% day loses one; 3 consecutive ≥50% days earn one back. |
| Habit creation/edit/delete | §4 | ✅ Complete | `src/app/[locale]/habits/{new,[id]}/page.tsx` | Custom + preset (31 presets). |
| Habit toggle/log | §4 | ✅ Complete | `src/lib/store.ts` (`toggleHabit`, `setHabitValue`) | |
| Per-habit streaks | §5.6 | ✅ Complete | `src/lib/streaks.ts` | Recomputed from log history on every mutation. Still rendered as a simple number on home checklist + habit detail. |
| **Overall StreakFire (ONE fire)** | post-spec | ✅ Complete (this branch) | `src/lib/streakFire.ts`, `src/lib/overallStreak.ts`, `src/components/StreakFire.tsx`, `src/components/StreakTierCelebration.tsx`, `public/icons/streak/*.png` | 7 tiers (Spark→Diamond) keyed off `profile.overallStreak.current`. Hero on Future Self; celebration in `AuthLayout`. See §4. |
| Categories management | §4, §5.10 | ✅ Complete | `src/app/[locale]/categories/{,[id]}/page.tsx` | 7 default categories (Sport split out vs the spec's six). |
| Heatmap (year, GitHub-style) | §5.9, §7.4 | ✅ Complete | `src/components/Heatmap.tsx`, `src/lib/dates.ts` | Today is leftmost column for mobile. |
| Progress page | §7.4 | ✅ Complete | `src/app/[locale]/progress/page.tsx` | Heatmap + 14-day bars + streak ranking + per-category 30-day. |
| Compound projections | §5.2, §11, §14 | 🟡 Partial | `src/lib/projections.ts` | 11 hand-written narratives. 20 of 31 presets fall through to `genericNarrative`. |
| Future Self screen | §5.1, §7.5 | ✅ Complete | `src/app/[locale]/future-self/page.tsx` | Vision, why, days-in counter, **overall-fire hero**, leverage prompt, 30-day category bars, rotating daily quote. |
| Reward + punishment system | §5.4, §5.5 | ✅ Complete | `src/app/[locale]/rewards/page.tsx`, `src/lib/safety.ts` | 21 reward presets, 17 punishment presets. `validatePunishment` blocks meal-skip / extreme-exercise / sleep-dep / self-harm wording. |
| Real-consequences messaging | §21 | 🟡 Partial | `src/lib/sensitivity.ts`, `src/lib/projections.ts` | Tone gating wired; library coverage matches the ~11 hand-written habits. |
| Ramadan mode | §6.1 | ✅ Complete | `src/app/[locale]/ramadan/page.tsx`, `src/lib/hijri.ts`, `src/components/IftarCountdown.tsx` | Auto-activates from Hijri date; manual override. |
| Dopamine reset | §19 | ✅ Complete | `src/app/[locale]/reset/page.tsx`, `src/lib/reset.ts` | 4 tiers, 6-stage progression, daily check-in, relapse logging. |
| Book tracker | §20 | ✅ Complete | `src/app/[locale]/books/*`, `src/lib/books.ts`, `src/components/Book{Cover,LogSheet}.tsx` | Multi-instance per-habit reading link via `Book.habitId` + `Habit.linksToBooks`. |
| Spiritual fasting (5 parts) | post-spec | ✅ Complete | `src/app/[locale]/fasting/page.tsx` | Eyes/ears/hands/tongue/food daily toggles + 7-day strip + Bukhari 1903 hadith. |
| Autophagy timer | post-spec | ✅ Complete | `src/app/[locale]/autophagy/page.tsx` | 16/18/20/24/36h targets, live 1s tick, conic-ring progress, history. |
| Debts ledger | post-spec | ✅ Complete | `src/app/[locale]/debts/page.tsx` | They-owe/you-owe, totals + net, settled history. |
| Savings ledger | post-spec | ✅ Complete | `src/app/[locale]/savings/page.tsx` | Signed deposits/withdrawals, balance + 30-day net + yearly projection. |
| Restart-smaller flow | post-spec | ✅ Complete | `src/app/[locale]/restart/page.tsx`, `src/lib/restart.ts` | 3 strikes (days <50%) → home banner → `/restart`. 7-day cooldown after commit. |
| Live habit counts | (spec implies) | ✅ Complete (when Firebase configured) | `src/lib/livecounts.ts`, `src/lib/useLiveCounts.ts` | Atomic transaction; falls back silently when unconfigured. |
| Authentication | §8 (implied) | ✅ Complete | `src/lib/auth.ts`, `src/components/SignInForm.tsx` | Google, email/password, anonymous-guest, account delete with Firestore wipe. |
| Cloud sync (per-user snapshot) | §8 alt | ✅ Complete | `src/lib/sync.ts`, `src/components/CloudSync.tsx` | Single `userSnapshots/{uid}` doc. Last-writer-wins. |
| Bilingual EN + FA, RTL | §13 | 🟡 Partial | `src/middleware.ts`, `src/i18n/*`, `messages/*.json` | Plumbing complete. Persian content quality: most sections still read as English-thinking-in-Persian. New `streakFire.*` Persian strings marked `_draft: true`. |
| Numerals follow UI locale | post-spec fix | ✅ Complete | `src/lib/format.ts` | `Profile.numeralSystem` deprecated; locale is the single source. |
| Theme (light/dark/auto) | §10 | ✅ Complete | `src/components/ThemeApplier.tsx`, `src/app/globals.css` | Override pattern in globals.css. |
| PWA (installable + offline) | §3 | ✅ Complete | `next.config.mjs`, `public/*`, `src/components/InstallPrompt.tsx`, `src/lib/firebase.ts` | Android `beforeinstallprompt` + iOS hint. |
| Splash screen | (post-spec) | 🟡 Partial | `src/components/SplashScreen.tsx`, `messages/*.json` (`splash.*`) | Once-per-device. Content debt: 4 of the 5 wisdom quotes remain rejected literary drafts. |
| Sound effects | (post-spec) | ✅ Complete | `src/lib/sounds.ts`, `src/components/SoundUnlock.tsx` | Web-Audio chimes. iOS gesture unlock. |
| Auth-aware app shell | (post-spec) | ✅ Complete | `src/components/{AppShell,AuthLayout,PublicLayout}.tsx` | |
| Settings page | §7.7 | ✅ Complete | `src/app/[locale]/profile/page.tsx` | Includes Motivation voice (smart/islamic/universal). |
| Bad-habit auto-replacement | §5.7 | ✅ Complete | `src/app/[locale]/habits/{new,[id]}/page.tsx`, `src/domain/seed.ts` | Free-text + auto-pair for known bad presets. |
| Push notifications | §3, §7.7 | ⚠️ Broken | `src/app/[locale]/profile/page.tsx` (UI only) | **Lie**: UI toggles persist, nothing fires. No FCM, no SW handler. |
| 2-Minute Rule (twoMinuteVersion fields) | §23 | 🔴 Not built | — | No `fullVersion`/`twoMinuteVersion` on `PresetHabit` or `Habit`. |
| Anger management protocol | §22 | 🔴 Not built | — | No `manageAnger` preset, no `AngerProtocol.tsx`. |
| Task bracketing (start/end rituals) | §24.1 | 🔴 Not built | — | No `startRitual`/`endRitual` on `Habit`. |
| Positive cargo (good-deed after slip) | §24.2 | 🔴 Not built | — | No `positiveCargo` field. |
| Notifications-off-by-default | §24.3 | 🟡 Partial | `src/domain/types.ts` | Default IS `false`, but the UI still promises delivery (see Push Notifications). |
| Vercel deployment | §3 hosting | 🔴 Not built | — | No `vercel.json`, no deploy URL. |
| Habit packs (Sahaba / Muslim Youth / Family) | §15, §16, §17 | 🔴 Not built | — | No data files, no UI. |
| Tests | — | 🔴 Not built | — | No test framework, zero coverage. Overall-streak math is the prime first target — see §10 and §12. |
| Encryption of sensitive fields | CLAUDE.md constraint #9 | 🔴 Not built | — | Snapshot pushed to Firestore as plain JSON. |

---

## 4. The Streak Fire System (Detail)

Just refactored from per-habit to **one overall fire**. Detail follows the new shape.

### Scope
- **One fire per user**, displayed on Future Self only.
- Each habit still has its own `Streak.current` integer (rendered as a small flame chip on the home checklist + habit detail). The **tier** lives at the user level, not the habit level.

### Qualifying-day rule (`src/lib/overallStreak.ts`)
A past or current day "qualifies" iff one of:
- The user had at least one **critical** habit that existed on that day (`isCritical === true` AND `createdAt <= date`), AND every such critical habit's log passes `isLogSuccessful` for that day.
- OR no critical habits existed that day, AND at least one habit that existed that day has a successful log (fallback).

Days with zero habits at all (e.g. pre-onboarding) do not qualify and break the chain. Today is handled the same way `streaks.ts` does — if today already qualifies it counts, else the walk starts from yesterday so a partial today doesn't break the chain at midnight.

### Files
- `src/lib/overallStreak.ts` (new, ~95 lines): `dayQualifies(date, habits, dayLogs)` + `recomputeOverallStreak(logs, habits, summaries, todayISO) → { current, longest, lastQualifyingDate }`.
- `src/lib/streakFire.ts`: simplified `getFireTrack(profile, habits, islamicCategoryId)` — uses whether *any* habit lives in the Islamic Practices category to pick the Islamic vs Universal sentence track (instead of the deleted per-habit reasoning).
- `src/components/StreakFire.tsx`: unchanged from previous — renders the tier PNG icon with sm/md/lg/xl sizes + optional animation.
- `src/components/StreakTierCelebration.tsx`: rewritten to read `profile.overallStreak.pendingCelebrationTier`. No queue (one streak, one modal). Dismissal calls `dismissOverallTierCelebration()`.
- `src/app/[locale]/future-self/page.tsx`: the grid + `FireDetailSheet` + `selectedHabitId` state are gone. A single centred Card hero replaces them between the why-quote and the leverage card, showing XL fire → tier name → day count → sentence → "X days until [Next]" (or "Forged forever" for diamond) → optional "Longest ever: N days" tail when longest > current.

### Icons (`public/icons/streak/`)
All 7 present: `spark.png` (1-6), `flame.png` (7-20), `burn.png` (21-55), `blaze.png` (56-111), `inferno.png` (112-223), `sacred.png` (224-364), `diamond.png` (365+). Tier thresholds in `src/lib/streakFire.ts`'s `TIER_THRESHOLDS`.

### Triggers
- Both `toggleHabit` and `setHabitValue` in `src/lib/store.ts` call `applyOverallStreakRecompute(get())` after their per-habit streak set block. The helper recomputes the snapshot, compares the new tier against `overallStreak.celebratedTiers`, and stamps `pendingCelebrationTier` when (newTier > highestCelebrated AND newTier > 1). Spark stays silent.
- Migration v13 → v14 runs `recomputeOverallStreak` once over the user's full history when `profile.overallStreak` is undefined. `celebratedTiers` stays empty so the very next toggle queues a single celebration for the user's current tier — we don't replay history.

### Translation keys
- `streakFire.tierNames.{spark|flame|burn|blaze|inferno|sacred|diamond}`
- `streakFire.tiers.{tier}.{islamic|universal}` — main sentence
- `streakFire.diamondExtra.{islamic|universal}` — modal-only extra line
- `streakFire.daysUntilNext`, `streakFire.forgedForever`, `streakFire.longestEver`
- Persian: full coverage, marked `_draft: true` at the `streakFire` root in `fa.json`.

### Motivation voice setting
Unchanged from before. `profile.fireSentenceStyle?: 'smart' | 'islamic' | 'universal'`, default `smart`. UI under Language section of `/profile`. Smart now reads "does the user have any habit in the Islamic Practices category?" — not "which category is this habit in?".

### Known issues
- **No tests.** The qualifying-day rule reads two signals (critical-set existence + `isLogSuccessful`) and the rebuilding walk handles today-handling + gap-day chain breaks; correctness is plausible but unproven. See §12.
- **`createdAt`-based existence check.** Habits without a `createdAt` (impossible in practice, but defensive code paths may pass partial objects) would be filtered out of the qualifying set. Fine in normal use.
- **No timer-based detection.** A user who hits a tier purely by time passing (e.g. logged off for a day; reopens) sees the celebration only after the next mutation. Same caveat as before.
- **The first-time compute on migration is O(days × habits)**. For heavy users (2 years × 15 habits ≈ 10k checks) this is milliseconds; for nobody is it slow enough to matter. Documented.
- **Cloud sync compatibility.** Old clients reading a new snapshot ignore unknown fields (Zustand persist's migrate runs on read). Old clients writing a snapshot without `overallStreak` are seamlessly re-seeded by a new client's migrate. Forward + backward safe.

---

## 5. Routes & Screens

Unchanged from the previous snapshot. All routes under `/[locale]/` where locale ∈ `{en, fa}`.

| Path | Purpose | Status | Notes |
|---|---|---|---|
| `/` | Home dashboard | ✅ | 3 hearts + completion ring + restart banner + Ramadan card + rotating compound + reset + reading + habit checklist. |
| `/onboarding` | 8-step setup | ✅ | |
| `/categories`, `/categories/[id]` | Category nav | ✅ | Feature cards on Islamic / Health / Finance / Growth. |
| `/habits/new`, `/habits/[id]` | Habit CRUD | ✅ | Replacement link, books section, critical toggle. |
| `/progress` | Progress | ✅ | Year heatmap, 14-day bars, streak ranking. |
| `/future-self` | **Future Self (overall fire hero)** | ✅ | Now shows ONE fire, not a grid. |
| `/ramadan` | Ramadan hub | ✅ | |
| `/reset` | Dopamine reset | ✅ | |
| `/restart` | Restart smaller | ✅ | |
| `/rewards` | Rewards + punishments | ✅ | |
| `/books/*` | Book tracker (4 routes) | ✅ | |
| `/fasting` | Spiritual fasting | ✅ | |
| `/autophagy` | Autophagy timer | ✅ | |
| `/debts` | Debts ledger | ✅ | |
| `/savings` | Savings ledger | ✅ | |
| `/profile` | Profile + settings | ✅ | |

**Routes that don't exist (would-be features)**: `/anger`, `/packs`. Nothing in §22–24 of the spec.

---

## 6. State & Data Model

### Zustand store (`src/lib/store.ts`) — top-level fields

Unchanged top-level shape:

```
profile: Profile | null
categories: Category[]
habits: Habit[]
logs: Record<YYYY-MM-DD, Record<habitId, HabitLog>>
summaries: Record<YYYY-MM-DD, DailySummary>
streaks: Record<habitId, Streak>

rewards, punishments, pendingRewards, activePunishments, lastReconciledDate
books, resets, ramadan, debts, savings
spiritualFasting, autophagyFasts
```

Persist middleware: `localStorage` under `mohsen-tracker:v1`, **schema version 14** (bumped from 13 for `Profile.overallStreak` seeding). Additive migration.

### `Habit` type (current — slimmer)

```ts
interface Habit {
  id: string;
  categoryId: string;
  presetKey?: string;
  name: string;
  type: 'good' | 'bad';
  unit?: string;
  target?: number;
  limit?: number;
  frequency: 'daily' | 'weekly';
  replacementHabitId?: string;     // used (spec §5.7)
  isCritical?: boolean;            // used (§5.5) — also the qualifying-day signal for overall streak
  linksToBooks?: boolean;          // used — book-driven daily total
  createdAt: string;
}
```

**Removed in this refactor**: `celebratedTiers?: number[]`, `pendingCelebrationTier?: number`. Persisted values on old snapshots become inert — Zustand persist will simply ignore unknown fields on read.

### `Profile` type (current)

```ts
interface Profile {
  name: string;
  futureSelfName?: string;
  futureSelfVision: string;
  whyItMatters?: string;
  language: 'en' | 'fa';
  numeralSystem: 'western' | 'persian';   // LEGACY — ignored by formatter
  theme: 'auto' | 'light' | 'dark';
  ramadanMode: 'auto' | 'on' | 'off';
  prayerCity?: string;
  prayerMethod: 'mwl' | 'isna' | 'tehran' | 'umm-al-qura';
  calendar: 'gregorian' | 'jalali' | 'hijri';
  consequenceSensitivity: 'off' | 'mild' | 'honest' | 'full';
  notifications: NotificationPreferences;
  readingHabitId?: string;        // LEGACY — superseded by Habit.linksToBooks
  soundEnabled: boolean;
  fireSentenceStyle?: 'smart' | 'islamic' | 'universal';
  lastRestartAt?: string;
  overallStreak?: {
    current: number;
    longest: number;
    lastQualifyingDate: string | null;
    celebratedTiers: number[];
    pendingCelebrationTier?: number;
  };
  onboardingComplete: boolean;
  createdAt: string;
}
```

**Dead / legacy fields**:
- `numeralSystem` (formatter ignores it after PR #7)
- `readingHabitId` (multi-instance reading habits superseded it in PR #4)

### Firestore document structure (unchanged)

```
habitCounts/{YYYY-MM-DD}        # Public daily counters
habitTicks/{uid}/days/{date}    # Per-user dedupe
userSnapshots/{uid}             # Full Zustand state mirror as one JSON doc — now includes profile.overallStreak
```

Still pragmatic v1 — not the per-collection schema in spec §8. Last-writer-wins.

---

## 7. Translation Coverage

- **`messages/en.json`**: ~1,030 lines, full coverage of every code-referenced key. Added `streakFire.longestEver` in this refactor.
- **`messages/fa.json`**: ~1,030 lines, parity with EN. Added the same key in Persian (marked `_draft`).
- **`_draft` markers**: still just one — `messages/fa.json` line `streakFire._draft: true`. Persian streakFire sentences (including the new `longestEver` and the existing tier sentences for all 7 tiers) are explicit drafts pending native review.
- **Sections still reading as translated English**: same list as before — `habitDetail.*`, `narratives.*`, `progress.*`, `rewards.*`, `ramadan.*`, `reset.*`, `books.*`, `debts.*`, `savings.*`, `fasting.*`, `autophagy.*`, `restart.*`, `settings.*`, `home.*`, `auth.*`.

---

## 8. Known Bugs & Lies

Largely unchanged. Updates marked **NEW** or **CHANGED**.

1. **Notification UI is a lie**. UI toggles persist, no notifications ever fire. No FCM, no SW push handler.
2. **Cloud sync is last-writer-wins**. Two devices editing concurrently → whichever writes last clobbers the other. **NEW caveat**: the new `profile.overallStreak` block is also subject to this — a stale device pushing an outdated `overallStreak` could roll back a fresher tier celebration. In practice, both clients recompute on next mutation, so self-heals within one toggle.
3. **`negativeSelfTalk` preset has no custom narrative**.
4. **20 of 31 preset habits use generic narratives**.
5. **Splash content debt**: 4 of 5 wisdom-quote slides are rejected literary drafts.
6. **`profile.numeralSystem` is dead code**. Field still written by onboarding, but no consumer reads it.
7. **`profile.readingHabitId` is legacy**. Migration carries it forward; no current code reads it.
8. **Force-quit before sync push = data loss window**. Includes `overallStreak` mutations now.
9. **Hot-reload swallows persistent IndexedDB cache** (dev only).
10. **`onboardingComplete: false` users with stale local profile** can land on a category-pick step they already saw. Edge case.
11. **No `TODO` / `FIXME` / `HACK` comments anywhere in `src/`** — grep returns zero. Take with one grain of salt.
12. **3 pre-existing lint warnings** — `<img>` in `BookCover.tsx` + `books/new/page.tsx`, missing `useEffect` dep in `books/[id]/page.tsx`.
13. **Sound on iOS Safari** requires a gesture unlock.
14. **PWA icons are generated from the SVG at prebuild**. No CI gate.
15. **CHANGED — Per-habit fire fields removed**. Old snapshots with `Habit.celebratedTiers` / `Habit.pendingCelebrationTier` populated will load fine — the fields are just ignored. No migration cleanup yet; they remain in storage as inert dead data until the next snapshot rewrite naturally drops them (Zustand persist serializes only the known interface).

---

## 9. Recent Work (Last 10 Commits)

Reverse chronological. The top 6 are the overall-streak refactor commits on `claude/overall-streak`; the rest are on `main`.

| SHA | Subject | Branch | Regressions |
|---|---|---|---|
| `f81841a` | StreakFire: remove per-habit fire fields + helper + legacy dismiss | overall-streak | None — deletion only. Old persisted values become inert. |
| `a4aef19` | StreakFire: celebration modal reads overall streak, no queue | overall-streak | None. |
| `c07a73f` | Future Self: hero replaces per-habit grid (one fire, one identity) | overall-streak | None. Grid + detail sheet deleted whole. |
| `e3888fd` | StreakFire: getFireTrack now reasons about the user, not a habit | overall-streak | None. Both callsites updated. |
| `8a49547` | StreakFire: wire overall recompute into toggleHabit/setHabitValue | overall-streak | None. Per-habit triggers retained alongside until step 6. |
| `e2e0323` | StreakFire: Profile.overallStreak + first-time compute on migrate | overall-streak | None. All optional fields. |
| `72cab77` | Merge PR #12 — Add PROJECT_STATE.md for external review | main | None (docs). |
| `7e071f6` | Add PROJECT_STATE.md for external review | main (via PR #12) | None. |
| `614966c` | Merge PR #11 — StreakFire system (per-habit, now superseded) | main | Superseded by this branch's refactor. |
| `5af061f` | Settings: Motivation voice selector | main (via PR #11) | None. Setting still meaningful in the overall model. |

No regressions observed across the refactor. Typecheck + lint pass at every commit.

---

## 10. Pending Work (Ordered)

1. **Land this PR** (claude/overall-streak → main).
2. **Notifications: stop the lie**. Either wire FCM end-to-end OR remove the delivery-promising toggles and add identity-framed opt-in copy per §24.3. Small-medium.
3. **Vercel deployment**. Without a deploy URL, no one but the developer can use the app. Small.
4. **2-Minute Rule (§23)**. Add `fullVersion` + `twoMinuteVersion` to `PresetHabit` and `Habit`. Medium.
5. **Anger management protocol (§22)**. Medium.
6. **Positive cargo (§24.2)**. Small-medium.
7. **Task bracketing (§24.1)**. Small.
8. **Idiomatic Persian rewrite**, section by section.
9. **Compound-narrative coverage for the remaining 20 presets**.
10. **Splash content finalization**.
11. **Per-doc Firestore writes (spec §8 schema)**. Large.
12. **Encryption of sensitive fields**. Medium-large.
13. **Tests** — set up `vitest`. **Highest-value first target is `overallStreak.ts`**: the qualifying-day rule reads two independent signals (critical-set existence + `isLogSuccessful`) and the rebuilding walk handles today, gap-day chain breaks, and the migration's one-time compute. More complex than the per-habit streak math and currently shipped without any verification. Flagged here as a v2 task and called out again in §12.
14. **Habit packs (§15–17)**. Large.

---

## 11. Open Questions / Decisions Needed

None right now.

---

## 12. What I'm Confident About vs. Uncertain About

**Confident**:
- Local-first habit logging via Zustand persist.
- The 14 sequential migrations are additive — every release has only added optional fields and defaulted new arrays/records to empty. Users on any v9+ snapshot can load v14 without data loss.
- The StreakFire system's overall design: one fire keyed off one number, derived in one place, consumed in one place (hero) plus one modal (celebration). Far simpler than the per-habit fan-out.
- The Books module's multi-instance reading-habit model (PR #4).
- TypeScript across the codebase. Typecheck passes.

**Uncertain**:
- **`overallStreak.ts` correctness — explicit callout per the brief.** The qualifying-day rule reads two signals (critical-set existence + `isLogSuccessful`) and the rebuilding walk handles today-handling + gap-day chain breaks + the migration's one-time compute over full history. More complex than the per-habit `streaks.ts` math. **No automated tests verify any of it.** Plausible by inspection, unverified in practice. This module is the **prime first target for `vitest`** whenever tests get introduced — table-driven cases over a fixture of logs covering today/yesterday qualifying, critical-set transitions, fallback rule, gaps that break the chain, and the migration walking a full history. Flagged as a v2 task.
- **The "what about repeated toggles across a tier boundary" case**: a user marks complete, undoes, re-marks within seconds. `pendingCelebrationTier` should still resolve to one queued tier via the `nextPending > pendingPrev` guard in `applyOverallStreakRecompute`. Plausible; untested.
- Cloud sync race conditions (still). The new `overallStreak` block adds another field to the per-user snapshot but doesn't change the last-writer-wins semantics. Two devices crossing the same tier near-simultaneously could each queue and dismiss their own celebration; the second push wins. Self-heals on the next mutation.
- Hijri date calculation correctness near month boundaries. `src/lib/hijri.ts` is hand-rolled without a library.
- Persian text quality. Especially the new `streakFire.*` Persian sentences — marked draft.
- Firestore offline persistence on first-load failures.
- The InstallPrompt's iOS detection across in-app browsers.

The system that scares me most if it breaks: still the per-user snapshot push. A bad write here could corrupt a user's entire state — including the freshly-introduced `overallStreak` block.

---

*This file is regenerated on demand — after major features ship, after significant refactors, or whenever the truth on `main` materially diverges from the last snapshot. It is not auto-updated.*
