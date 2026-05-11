# Mohsen Tracker — Project State Snapshot

> External-review snapshot. Pairs with `HABIT_TRACKER_SPEC.md` (design
> intent) and `CLAUDE.md` (architecture + operational guide). This file
> describes the **concrete reality** on `main` right now.

---

## 1. Last Updated

- **Timestamp (UTC)**: 2026-05-11T09:00:17Z
- **Branch**: `main`
- **Commit SHA**: `614966c636d380d16d0efabc9d54ff3b4258bc9f`
- **Tip commit**: `614966c — Merge pull request #11 from ScriptShah/claude/future-self-fire-streak`
- **Typecheck**: ✅ passes (`tsc --noEmit`)
- **Lint**: passes with 3 pre-existing warnings (none on streak-fire code) — `<img>` instead of `<Image>` in `BookCover.tsx` + book pages, missing `useEffect` dep in `books/[id]/page.tsx`. All unchanged from before this snapshot.

---

## 2. Quick Summary

Mohsen Tracker is a bilingual (English + Persian) habit-tracking PWA grounded in *The Compound Effect* + *Atomic Habits*, with first-class Islamic practice tracking (prayers, Quran, Sunnah, Ramadan mode). It runs as a local-first Zustand-persisted Next.js 14 app, with optional Firebase (Auth + Firestore live counts + per-user snapshot sync). The most recent major change is the **per-habit StreakFire tier system** that just landed via PR #11: each habit's streak now maps to one of 7 tiers (Spark → Flame → Burn → Blaze → Inferno → Sacred → Diamond) rendered via premium 3D-rendered PNG icons on the Future Self page, with a celebration modal that fires when a habit crosses into a new tier. The app remains undeployed — it runs only on the developer's machine.

---

## 3. Feature Completion Matrix

| Feature | Spec Section | Status | Files | Notes |
|---|---|---|---|---|
| Onboarding (8-step) | §7.1 | ✅ Complete | `src/app/[locale]/onboarding/page.tsx` | Skippable sign-in when Firebase unconfigured. |
| Home dashboard | §7.2 | ✅ Complete | `src/app/[locale]/page.tsx` | Greeting + 3 hearts + completion ring + Ramadan/restart banners + rotating compound + reset card + reading card + habit checklist. |
| 3-lives hearts indicator | (post-spec) | ✅ Complete | `src/app/[locale]/page.tsx`, `src/lib/restart.ts` | <50% day loses one; 3 consecutive ≥50% days earn one back. |
| Habit creation/edit/delete | §4 | ✅ Complete | `src/app/[locale]/habits/{new,[id]}/page.tsx` | Custom + preset (31 presets). |
| Habit toggle/log | §4 | ✅ Complete | `src/lib/store.ts` (`toggleHabit`, `setHabitValue`) | |
| Per-habit streaks | §5.6 | ✅ Complete | `src/lib/streaks.ts` | Recomputed from log history on every mutation. |
| StreakFire tier system (per-habit) | post-spec | ✅ Complete | `src/lib/streakFire.ts`, `src/components/StreakFire.tsx`, `src/components/StreakTierCelebration.tsx`, `public/icons/streak/*.png` | 7 tiers, two sentence tracks, celebration modal in `AuthLayout`. See §4. |
| Categories management | §4, §5.10 | ✅ Complete | `src/app/[locale]/categories/{,[id]}/page.tsx` | 7 default categories (Sport split out vs the spec's six), rename/reorder/archive/restore/add-custom. |
| Heatmap (year, GitHub-style) | §5.9, §7.4 | ✅ Complete | `src/components/Heatmap.tsx`, `src/lib/dates.ts` | Today is leftmost column for mobile. |
| Progress page | §7.4 | ✅ Complete | `src/app/[locale]/progress/page.tsx` | Heatmap + 14-day bars + streak ranking + per-category 30-day. |
| Compound projections | §5.2, §11, §14 | 🟡 Partial | `src/lib/projections.ts` | 11 hand-written narratives (reading, saving, steps, exercise, quranPages, screenTime, tahajjud, sadaqah, learning, gheebat, callFamily). The other 20 of 31 presets fall through to `genericNarrative`. |
| Future Self screen | §5.1, §7.5 | ✅ Complete | `src/app/[locale]/future-self/page.tsx` | Vision, why, days-in counter, "Your becoming" StreakFire grid, leverage prompt, 30-day category bars, rotating daily quote. |
| Reward + punishment system | §5.4, §5.5 | ✅ Complete | `src/app/[locale]/rewards/page.tsx`, `src/lib/safety.ts` | 21 reward presets, 17 punishment presets (incl. new `spiritualFastDay` + `autophagyFast`). `validatePunishment` blocks meal-skip / extreme-exercise / sleep-dep / self-harm wording. |
| Real-consequences messaging | §21 | 🟡 Partial | `src/lib/sensitivity.ts`, `src/lib/projections.ts` | Tone gating (off/mild/honest/full) wired; library coverage matches the same ~11 habits as projections. |
| Ramadan mode | §6.1 | ✅ Complete | `src/app/[locale]/ramadan/page.tsx`, `src/lib/hijri.ts`, `src/components/IftarCountdown.tsx` | Auto-activates from Hijri date; manual override (`profile.ramadanMode`). Prayer checklist, juz progress, taraweeh, sadaqah, Laylat al-Qadr odd-night marks, Shawwal six fasts, pre-Ramadan + Shawwal banners. |
| Dopamine reset | §19 | ✅ Complete | `src/app/[locale]/reset/page.tsx`, `src/lib/reset.ts` | 4 tiers, 6-stage progression, daily check-in, relapse logging with lifetime clean days, replacement-activity rotation. |
| Book tracker | §20 | ✅ Complete | `src/app/[locale]/books/*`, `src/lib/books.ts`, `src/components/Book{Cover,LogSheet}.tsx` | Multi-instance per-habit reading link via `Book.habitId` + `Habit.linksToBooks`. Year-end review at `/books/year`. |
| Spiritual fasting (5 parts) | post-spec | ✅ Complete | `src/app/[locale]/fasting/page.tsx` | Eyes/ears/hands/tongue/food daily toggles + 7-day heatmap strip + Bukhari 1903 hadith card. |
| Autophagy timer | post-spec | ✅ Complete | `src/app/[locale]/autophagy/page.tsx` | 16/18/20/24/36h targets, live 1s tick, conic-ring progress, history. |
| Debts ledger | post-spec | ✅ Complete | `src/app/[locale]/debts/page.tsx` | They-owe/you-owe, totals + net, settled history. |
| Savings ledger | post-spec | ✅ Complete | `src/app/[locale]/savings/page.tsx` | Signed deposits/withdrawals, balance + 30-day net + yearly projection. |
| Restart-smaller flow | post-spec | ✅ Complete | `src/app/[locale]/restart/page.tsx`, `src/lib/restart.ts` | 3 strikes (days <50%) → home banner → `/restart` page lets user pare habits down. 7-day cooldown after commit. |
| Live habit counts | (spec implies) | ✅ Complete (when Firebase configured) | `src/lib/livecounts.ts`, `src/lib/useLiveCounts.ts` | Atomic transaction; falls back silently when unconfigured. |
| Authentication | §8 (implied) | ✅ Complete | `src/lib/auth.ts`, `src/components/SignInForm.tsx` | Google, email/password, anonymous-guest, account delete with Firestore wipe. |
| Cloud sync (per-user snapshot) | §8 alt | ✅ Complete | `src/lib/sync.ts`, `src/components/CloudSync.tsx` | Single `userSnapshots/{uid}` doc. **Not** the per-collection schema in spec §8 — pragmatic v1; last-writer-wins on concurrent edits. |
| Bilingual EN + FA, RTL | §13 | 🟡 Partial | `src/middleware.ts`, `src/i18n/*`, `messages/*.json` | Plumbing complete (logical Tailwind utilities, larger Persian line-height, Persian numerals via locale). Persian content quality: most strings outside splash + onboarding + streakFire still read as English-thinking-in-Persian. New streakFire FA strings marked `_draft: true`. |
| Numerals follow UI locale | post-spec fix | ✅ Complete | `src/lib/format.ts` | `Profile.numeralSystem` deprecated; locale is the single source. |
| Theme (light/dark/auto) | §10 | ✅ Complete | `src/components/ThemeApplier.tsx`, `src/app/globals.css` | Override pattern in globals.css, not `dark:` variants. |
| PWA (installable + offline) | §3 | ✅ Complete | `next.config.mjs`, `public/manifest.webmanifest`, `public/sw.js`, `src/components/InstallPrompt.tsx`, `src/lib/firebase.ts` (persistent IndexedDB cache) | Android `beforeinstallprompt` + iOS hint. Generated PNG icons from SVG at prebuild. |
| Splash screen | (post-spec) | 🟡 Partial | `src/components/SplashScreen.tsx`, `messages/*.json` (`splash.*`) | Once-per-device via localStorage. Content debt: 4 of the 5 wisdom quotes (`words`, `actions`, `character`, `destiny`) remain from rejected literary drafts — only `habits` (seed metaphor) was finalized. |
| Sound effects | (post-spec) | ✅ Complete | `src/lib/sounds.ts`, `src/components/SoundUnlock.tsx` | Web-Audio synthesized chimes (no audio files), 8 sound types, iOS unlock on first gesture. Default ON, toggle in Settings. |
| Auth-aware app shell | (post-spec) | ✅ Complete | `src/components/{AppShell,AuthLayout,PublicLayout}.tsx` | Signed-out users see logo + tagline + sign-in form only. |
| Settings page | §7.7 | ✅ Complete | `src/app/[locale]/profile/page.tsx` | Edit profile, language, calendar, theme, ramadan mode, sound, prayer city/method, consequence sensitivity, motivation voice, reading-habit linker, notification toggles (see Known Bugs), export JSON, reset progress, delete account. |
| Bad-habit auto-replacement | §5.7 | ✅ Complete | `src/app/[locale]/habits/new/page.tsx`, `src/domain/seed.ts` (`presetReplacements`), `src/app/[locale]/habits/[id]/page.tsx` | Free-text replacement in form; preset picker auto-pairs `screenTime→reading`, `gheebat→morningAdhkar`, `junkFood→water`, `negativeSelfTalk→morningAdhkar`. Replacement link surfaces on the habit detail page. |
| Push notifications | §3, §7.7 | ⚠️ Broken | `src/app/[locale]/profile/page.tsx` (UI only) | **Lie**: UI toggles persist values but no notifications are ever delivered. No FCM SDK calls, no SW push handler. Spec §24.3 wants notifications off by default — currently default is `false`, so the lie is dormant for new users. |
| 2-Minute Rule (twoMinuteVersion fields) | §23 | 🔴 Not built | — | No `fullVersion`/`twoMinuteVersion` fields on `PresetHabit` or `Habit`. Habit creation only offers the full version. |
| Anger management protocol | §22 | 🔴 Not built | — | No `manageAnger` preset, no `AngerProtocol.tsx` modal. |
| Task bracketing (start/end rituals) | §24.1 | 🔴 Not built | — | No `startRitual`/`endRitual` on `Habit`. |
| Positive cargo (good-deed after slip) | §24.2 | 🔴 Not built | — | No `positiveCargo` field on bad-habit `Habit`. |
| Notifications-off-by-default | §24.3 | 🟡 Partial | `src/domain/types.ts` (`NotificationPreferences.enabled` defaults to `false` in migrations) | Default IS `false`, but the UI still promises delivery (see Push Notifications above). Identity-framed opt-in copy not implemented. |
| Vercel deployment | §3 hosting | 🔴 Not built | — | No `vercel.json`, no deploy URL. Runs only on developer's machine. |
| Habit packs (Sahaba / Muslim Youth / Family) | §15, §16, §17 | 🔴 Not built | — | Spec content libraries exist on paper; no data files, no UI. |
| Tests | — | 🔴 Not built | — | No test framework. No `__tests__/`, no `vitest`/`jest`/`playwright`/test-library deps in `package.json`. Zero coverage. |
| Encryption of sensitive fields | (CLAUDE.md constraint #9) | 🔴 Not built | — | Snapshot pushed to Firestore as plain JSON. Firestore-at-rest encryption only. |

---

## 4. The StreakFire System (Detail)

Active feature, just landed via PR #11. Treating it specifically per the brief.

- **Scope**: **per-habit**, not overall. Each habit has its own streak (already computed by `recomputeStreak` in `src/lib/streaks.ts`); the tier is a pure visual layer keyed off `Streak.current`.
- **Qualifying day**: any day where the habit's log is "successful" per `isLogSuccessful` (good habit: hits target or marked done with no target; bad habit: stays at-or-below the limit). The system inherits the existing streak definition — no separate qualifying rule.
- **Icon files in `public/icons/streak/`** (all 7 present, all PNG, ~800KB–1.4MB each, transparent backgrounds, square):
    - `spark.png` (Tier 1, days 1–6)
    - `flame.png` (Tier 2, days 7–20)
    - `burn.png` (Tier 3, days 21–55)
    - `blaze.png` (Tier 4, days 56–111)
    - `inferno.png` (Tier 5, days 112–223)
    - `sacred.png` (Tier 6, days 224–364)
    - `diamond.png` (Tier 7, days 365+)
- **`StreakFire` component**: `src/components/StreakFire.tsx`. Sizes `sm` (32px), `md` (48px), `lg` (80px), `xl` (160px). Renders via `next/image`. Animation only at xl by default (`streak-fire-pulse` 2s for fire tiers, `streak-diamond-shimmer` 3s for diamond), both honor `prefers-reduced-motion`. Keyframes live in `src/app/globals.css`.
- **Where it renders**: `src/app/[locale]/future-self/page.tsx` only — the "Your becoming" grid (one card per daily habit, sorted by streak descending) + a tap-detail bottom-sheet/modal showing the xl icon + the tier sentence + days-until-next (or "Forged forever" for diamond). Per the spec constraint, **no icons on home, habit checklist, habit detail, categories, or anywhere else**.
- **Celebration modal**: `src/components/StreakTierCelebration.tsx`. Mounted in `src/components/AuthLayout.tsx` so it surfaces app-wide on any route. Queue-based — shows one habit at a time, advances on Continue/Esc/backdrop tap. Diamond gets an extra subdued line.
- **Tier-up detection**: `src/lib/store.ts` → `maybeQueueTierCelebration` helper called after both `toggleHabit` and `setHabitValue` streak recomputes. Skips Tier 1 (Spark) — first reveal is Day 7 (Flame).
- **Sentences (translation keys)**:
    - `streakFire.tierNames.{spark|flame|burn|blaze|inferno|sacred|diamond}` — short tier label
    - `streakFire.tiers.{tier}.{islamic|universal}` — main motivational sentence per tier × track
    - `streakFire.diamondExtra.{islamic|universal}` — extra line shown only at diamond in the celebration modal
    - `streakFire.daysUntilNext`, `streakFire.forgedForever`
- **Persian translations**: present, full coverage of all keys above. Marked **draft** via `_draft: true` at the `streakFire` root in `fa.json` (line 1022). Needs native review.
- **Motivation voice setting**: ✅ Built. `Profile.fireSentenceStyle?: 'smart' | 'islamic' | 'universal'`, default `'smart'`. UI lives in `src/app/[locale]/profile/page.tsx` under the Language section as a `<select>` styled like the Calendar dropdown. Smart routes Islamic-Practices habits to Islamic, everything else to Universal.
- **Known issues with the fire system**:
    - PNGs are large (avg ~1.2MB each) — could add `priority` selectively and consider WebP/AVIF later; currently `priority` is set only on xl and `loading="lazy"` on sm. Future Self pages with many habits will fetch several at once.
    - Spark celebration is suppressed by design (no Day-1 modal). On Day 7 the first Flame reveal fires. This is intentional but could feel abrupt for users who never see Spark celebrated. Acceptable v1.
    - Track-selection logic uses `category.key === 'islamic'` — works for the default category but breaks if a user renames or replaces their Islamic-Practices category (the key persists, but a custom category with no key falls through to Universal even if the user considers it Islamic). Documented constraint.
    - Day-of-tier-cross is detected reactively (on next mutation). If a user crosses a tier purely by time passing (e.g. didn't open the app for the day; reopens 2 days later), the celebration only fires after they tick something. No timer-based detection. Acceptable for a habit app.

---

## 5. Routes & Screens

All routes are under `/[locale]/` where locale ∈ `{en, fa}`.

| Path | Purpose | Status | Major UI |
|---|---|---|---|
| `/` | Home dashboard | ✅ | Greeting + 3 hearts + "Today" + completion ring; restart banner (if 3 strikes); Ramadan/Shawwal/preRamadan card; rotating compound card; rewards-setup nudge; active-reset or start-reset card; current-reading card; future-self vision reminder; habit checklist; +Add habit. |
| `/onboarding` | 8-step setup | ✅ | Language → name → future-self name → vision → why → sign-in (optional) → category pick → preset-habit pick → finish. |
| `/categories` | Category list | ✅ | Each category with habit count + add custom + archive/restore. |
| `/categories/[id]` | Category detail | ✅ | Habits in category; feature cards on Islamic (Quran verse), Health (Fasting + Autophagy), Finance (Savings + Debts), Growth (Books). +Add habit. |
| `/habits/new` | Create habit | ✅ | Preset chip-row with auto-pair for bad-habit pairings; full form with type/category/unit/target/limit/replacement. |
| `/habits/[id]` | Habit detail | ✅ | Header (streak + target/limit), replacement-link card, projection narrative (gain/stake toggle), reversal lines, hadith pairing, books section (if `linksToBooks`), critical toggle, delete. |
| `/progress` | Progress | ✅ | Year heatmap, 14-day bars, streak ranking, per-category 30-day consistency. |
| `/future-self` | Future Self | ✅ | Becoming label + name + days-in counter, vision card, why quote, **"Your becoming" StreakFire grid + tap-detail sheet**, leverage prompt, 30-day category bars, rotating daily quote, edit form. |
| `/ramadan` | Ramadan hub | ✅ | Iftar countdown, prayer checklist, fasting count, juz progress, taraweeh, sadaqah running total, Laylat al-Qadr odd-night marks, Shawwal six fasts. Only auto-active during Ramadan; manually accessible always. |
| `/reset` | Dopamine reset | ✅ | Tier picker (24h/7d/30d/90d), active reset card with stage + day counter, check-in (mood/insteadOf/urges), relapse logging, replacement-activity rotation. Islamic-aware messaging when Islamic category active. |
| `/restart` | Restart smaller | ✅ | Ink→leaf gradient hero, paring UI (default keep-all, tap to drop), commit/cancel. Cooldown via `profile.lastRestartAt`. |
| `/rewards` | Rewards + punishments | ✅ | 4-tier reward picker (21 presets), punishment library (17 presets incl. spiritualFastDay/autophagyFast), claim/resolve. |
| `/books` | Books home | ✅ | Currently-reading list + completed + add. |
| `/books/new` | Create book | ✅ | Title, author, totalPages, category (book-categories), format, why-reading, target date, cover image upload, optional habit-link via `?habitId=...`. |
| `/books/[id]` | Book detail | ✅ | Cover + progress + log pages + mark complete (rating/review/favorite quote) + delete. |
| `/books/year` | Year-end review | ✅ | Totals + category breakdown + compound line. |
| `/fasting` | Spiritual fasting | ✅ | 5 toggles (eyes/ears/hands/tongue/food), reflection note, 7-day heatmap strip, Bukhari 1903 hadith. |
| `/autophagy` | Autophagy timer | ✅ | Target picker (16/18/20/24/36h), active fast card with live elapsed counter + conic-ring progress, history. |
| `/debts` | Debts ledger | ✅ | They-owe / You-owe totals + net, active + collapsed-settled, add/settle/unsettle/delete. |
| `/savings` | Savings ledger | ✅ | Balance + 30-day net + naive yearly projection, deposit/withdrawal entries, delete. |
| `/profile` | Profile + settings | ✅ | Sign-in/out, edit profile, language, calendar, theme, ramadan mode override, sound, prayer city/method, motivation voice, consequence sensitivity, daily-notification time + per-habit toggles, reading-habit linker, export JSON, reset progress, delete account. |

**Routes that don't exist (would-be features)**: `/anger`, `/packs`, no per-habit creation flow with two-minute toggle. Anything in §22–24 of the spec.

---

## 6. State & Data Model

### Zustand store (`src/lib/store.ts`) — top-level fields

```
profile: Profile | null
categories: Category[]
habits: Habit[]
logs: Record<YYYY-MM-DD, Record<habitId, HabitLog>>
summaries: Record<YYYY-MM-DD, DailySummary>
streaks: Record<habitId, Streak>

rewards: RewardOption[]
punishments: PunishmentOption[]
pendingRewards: PendingReward[]
activePunishments: ActivePunishment[]
lastReconciledDate?: YYYY-MM-DD

books: Book[]
resets: DopamineReset[]
ramadan: RamadanProgress[]
debts: Debt[]
savings: SavingEntry[]
spiritualFasting: Record<YYYY-MM-DD, FastingDayLog>
autophagyFasts: AutophagyFast[]
```

Persist middleware: `localStorage` under key `mohsen-tracker:v1`, **schema version 13**, additive migrations from 1→13. No destructive migrations; existing users' state survives every release.

### `Habit` type (current)

```ts
interface Habit {
  id: string;
  categoryId: string;
  presetKey?: string;          // links to presets.* and narratives.* translations
  name: string;
  type: 'good' | 'bad';
  unit?: string;
  target?: number;             // good: hit-or-above; ignored for bad
  limit?: number;              // bad: stay at-or-below; ignored for good
  frequency: 'daily' | 'weekly';
  replacementHabitId?: string;     // used (spec §5.7) — surfaced on detail page
  isCritical?: boolean;            // used (§5.5) — triggers punishment via reconcile
  linksToBooks?: boolean;          // used — flips habit to book-driven (§20.11)
  celebratedTiers?: number[];      // used — tracks shown StreakFire tiers
  pendingCelebrationTier?: number; // used — celebrates on next app open
  createdAt: string;
}
```

No dead fields on Habit.

### `Profile` type (current)

```ts
interface Profile {
  name: string;
  futureSelfName?: string;
  futureSelfVision: string;
  whyItMatters?: string;
  language: 'en' | 'fa';
  numeralSystem: 'western' | 'persian';   // DEAD-ISH — see below
  theme: 'auto' | 'light' | 'dark';
  ramadanMode: 'auto' | 'on' | 'off';
  prayerCity?: string;
  prayerMethod: 'mwl' | 'isna' | 'tehran' | 'umm-al-qura';
  calendar: 'gregorian' | 'jalali' | 'hijri';
  consequenceSensitivity: 'off' | 'mild' | 'honest' | 'full';
  notifications: NotificationPreferences;
  readingHabitId?: string;        // LEGACY — kept for migration but no longer read
  soundEnabled: boolean;
  lastRestartAt?: string;         // used — restart cooldown
  fireSentenceStyle?: 'smart' | 'islamic' | 'universal';
  onboardingComplete: boolean;
  createdAt: string;
}
```

**Dead / legacy fields on Profile**:
- `numeralSystem` — written by `onboarding/page.tsx` and the type still has it, but `useNumberFormatter` ignores it after the EN/FA-numeral fix (PR #7). Could be removed in a future migration; kept now so older snapshots still parse.
- `readingHabitId` — superseded by `Habit.linksToBooks` + `Book.habitId` (PR #4 multi-instance). The migration carries the value forward by flagging the corresponding habit; no current code path reads it.

### Firestore document structure (in use)

```
habitCounts/{YYYY-MM-DD}        # Public daily counters; { [presetKey]: number }
                                # Authenticated read + atomic-tx write

habitTicks/{uid}/days/{date}    # Per-user dedupe so live counts can't be inflated
                                # Owner-only

userSnapshots/{uid}             # FULL Zustand state mirror as one JSON doc
                                # Owner-only
                                # Fields: version, state{profile, categories, habits, logs, summaries, streaks, rewards, punishments, pendingRewards, activePunishments, lastReconciledDate, books, resets, ramadan, debts, savings, spiritualFasting, autophagyFasts}, updatedAt(serverTimestamp)
```

This is **NOT** the per-collection schema described in spec §8. The spec calls for granular per-doc writes (`users/{uid}`, `habits/{uid}/{habitId}`, `logs/{uid}/{date}/{habitId}`, etc.). Today we ship a single per-user snapshot doc. Last-writer-wins on concurrent edits from two devices. Pragmatic for v1; doesn't scale to multi-device real-time without refactor.

---

## 7. Translation Coverage

- **`messages/en.json`**: ~1,030 lines, full coverage of every key referenced in code. No missing critical strings detected.
- **`messages/fa.json`**: ~1,030 lines (1029). Full key coverage parity with EN — no missing keys. **Quality**: most sections outside `splash.*`, `onboarding.*`, and the newly added `streakFire.*` still read as English-thinking-in-Persian — literal translation, not native idiom. Per the working agreement (CLAUDE.md memory note + spec §13), all Persian content should be considered drafts pending native review.
- **`_draft` markers**: one — `messages/fa.json` line 1022, `streakFire._draft: true`. Persian streakFire sentences are explicit drafts.
- **Sections with the most idiomatic Persian** (rewritten this past session): `splash.*`, `onboarding.*`, `streakFire.*` (newly added, marked draft).
- **Sections still reading as translated English**: everything else — `habitDetail.*`, `narratives.*`, `progress.*`, `rewards.*`, `ramadan.*`, `reset.*`, `books.*`, `debts.*`, `savings.*`, `fasting.*`, `autophagy.*`, `restart.*`, `settings.*`, `home.*`, `auth.*`.
- **Quranic verses & adhkar**: stored in Arabic with translations alongside, never machine-translated. The Bukhari 1903 hadith on the Fasting page and the Al-Baqarah 2:222 verse on the Islamic category page are correct.

---

## 8. Known Bugs & Lies

Brutal list. Sorted by user-visible severity.

1. **Notification UI is a lie**. `/profile` shows a daily-time picker + per-habit notification toggles; the values persist; no notifications ever fire. No FCM SDK initialized, no service-worker push handler, no permission prompt. A user who toggles this and waits will get nothing. Recommended fix: either wire FCM end-to-end OR remove the toggles and add identity-framed opt-in copy per spec §24.3.

2. **Cloud sync is last-writer-wins**. Two devices editing concurrently → whichever writes last clobbers the other. No conflict resolution. The snapshot push has no visible debounce in `CloudSync.tsx` — every store mutation can trigger a Firestore write. Mostly invisible unless a user has multiple devices.

3. **`negativeSelfTalk` preset has no custom narrative**. Falls through to `genericNarrative`. Acceptable; documented here so the reviewer doesn't flag it as a regression.

4. **20 of 31 preset habits use generic narratives** (no custom compound projection / hadith pairing). Workable but bland.

5. **Splash content debt**: 4 of 5 wisdom-quote slides (`words`, `actions`, `character`, `destiny`) are the original literary drafts the user rejected. `habits` was finalized (seed metaphor). The others remain English-leaning even after the Persian rewrite session.

6. **`profile.numeralSystem` is dead code**. The field is still on the type and gets written by `onboarding/page.tsx`, but no consumer reads it. Kept on the type so older snapshots parse during migration; removing it cleanly is a future migration task.

7. **`profile.readingHabitId` is legacy**. Same situation — the migration to multi-instance reading habits (PR #4) made it unused but kept in storage so older clients don't crash on parse.

8. **Force-quit before sync push = data loss window**. The Firestore push fires post-commit on store changes; if a user mutates and closes the app within milliseconds (before the network round-trip), the mutation lives locally only until the next sign-in or store-change push.

9. **Hot-reload swallows persistent IndexedDB cache**. `firebase.ts` wraps `persistentLocalCache` in try/catch so dev-server reloads don't throw, but the silent fallback to `getFirestore` means dev sessions lose offline cache. Affects dev only.

10. **`onboardingComplete: false` users with stale local profile can land on a category-pick step they already completed**. Onboarding doesn't deeply validate state on resume. Edge case.

11. **No `TODO` / `FIXME` / `HACK` comments anywhere in `src/`** — searched with grep, returned zero hits. Take this with one grain of salt: it just means devs haven't littered the code with markers; it doesn't mean every assumption is sound.

12. **3 pre-existing lint warnings**, unchanged from before this snapshot:
    - `src/app/[locale]/books/new/page.tsx:190` — uses `<img>` instead of next/image (cover preview).
    - `src/app/[locale]/books/[id]/page.tsx:62` — `useEffect` missing dep `book`.
    - `src/components/BookCover.tsx:35` — uses `<img>` instead of next/image.
    None affect correctness; all are perf/style nits.

13. **Sound on iOS Safari requires a gesture unlock**. Handled by `SoundUnlock.tsx`, but if the user denies the unlock gesture (rare), subsequent chimes are silent. No fallback messaging.

14. **PWA icons are generated from the SVG at prebuild**. If `scripts/generate-pwa-icons.mjs` fails (e.g. `sharp` unavailable on the host), the build still proceeds with stale icons. No CI gate.

---

## 9. Recent Work (Last 10 Commits)

Reverse chronological. SHAs are short.

| SHA | Subject | What it actually changed | Regressions |
|---|---|---|---|
| `614966c` | Merge PR #11 — StreakFire system | Folded the 5-commit StreakFire branch into main. | None observed. |
| `5af061f` | Settings: Motivation voice selector | Adds the Smart/Islamic/Universal `<select>` under the Language section on `/profile`. | None. |
| `772c883` | StreakFire celebration modal | `StreakTierCelebration.tsx` + `dismissTierCelebration` store action + `maybeQueueTierCelebration` hook in both `toggleHabit` and `setHabitValue`. | None. Spark intentionally suppressed. |
| `48dd127` | Future Self "Your becoming" grid | Adds the per-habit grid + tap-detail sheet between why-quote and leverage card. | None. |
| `ba5a437` | StreakFire icon component + translations + animations | `StreakFire.tsx`, two `@keyframes` in `globals.css`, full EN+FA strings (FA marked `_draft`). | None. |
| `fe4cab7` | StreakFire data layer | `src/lib/streakFire.ts` helper + 7 PNG icons in `public/icons/streak/` + optional `Habit.celebratedTiers`/`pendingCelebrationTier` + `Profile.fireSentenceStyle`. | None. All fields optional → no migration. |
| `70909ff` | Merge PR #10 — Lives tweaks | Bigger red hearts + new lose/recharge mechanic + caption. | None. |
| `81feabe` | Lives: lose <50% / recharge after 3 days ≥50% | Rewrites `computeStrikes` to be Mario-style (lose on bad day, recover after 3 good days). | None. Old rolling-14-day model dropped. |
| `8ee8172` | Lives: bigger hearts, always red | Heart SVG bumped from h-3.5 to h-6, all red. | None. |
| `418d785` | Merge PR #9 — 3 lives on header | Adds 3-heart row next to greeting. | None. |

No regressions detected in any of the last 10 commits. Typecheck + lint pass across the range.

---

## 10. Pending Work (Ordered)

Priority order, derived from spec §25.5 + CLAUDE.md Next Steps + the working session backlog.

1. **Notifications: stop the lie**. Either wire FCM end-to-end OR remove the delivery-promising toggles and add identity-framed opt-in copy per §24.3. Small-medium. No blockers.
2. **Vercel deployment**. Without a deploy URL, no one but the developer can use the app. `vercel.json` + first deploy. Small. No blockers other than account setup.
3. **2-Minute Rule (§23)**. Add `fullVersion` + `twoMinuteVersion` to `PresetHabit` and `Habit`. Habit-creation UI offers both, recommends the 2-minute version. After a 30-day streak, prompt the user to level up. Optional habit-stacking phrase field on creation. Medium. Touches `presetHabits`, habit form, habit detail, and translations.
4. **Anger management protocol (§22)**. New `manageAnger` preset + `AngerProtocol.tsx` modal walking the Prophetic protocol (ta'awwudh → posture → wudu → 90s breathing → dua) + home trigger button + settings toggle (off by default). Medium.
5. **Positive cargo (§24.2)**. Optional `positiveCargo` field on bad habits; UI prompts the cargo after the user logs a slip. Quran 11:114 anchor. Small-medium.
6. **Task bracketing (§24.1)**. Optional `startRitual` / `endRitual` text on each habit, shown on the detail page. Small.
7. **Idiomatic Persian rewrite**, section by section. The Persian content quality is the biggest experiential gap for FA users. Ongoing, chunk-by-chunk.
8. **Compound-narrative coverage for the remaining 20 presets**. Each preset deserves a hand-written compound projection + reversal + hadith pairing. Spec §11/§14 content. Large in aggregate, small per habit.
9. **Splash content finalization**. The 4 rejected slides need new copy or removal. The user agreed in concept on a future-self-visualization arc; never landed in code. Small.
10. **Per-doc Firestore writes (spec §8 schema)**. Refactor `userSnapshots/{uid}` → per-collection (`users/{uid}`, `habits/{uid}/{habitId}`, `logs/{uid}/{date}/{habitId}`, etc.) so multi-device real-time sync works without last-writer-wins. Large.
11. **Encryption of sensitive fields**. Faith/finance/personal-goal data should be encrypted before persisting. Currently plain JSON in Firestore. Architectural Constraint #9 in CLAUDE.md. Medium-large.
12. **Tests**. Zero coverage today. Highest-value first targets: `store.ts` (stateful logic), `hijri.ts` (date math), `streaks.ts`, `restart.ts`, `streakFire.ts`. Set up `vitest` first. Medium.
13. **Habit packs (§15–17)**. Sahaba/Muslim Youth/Family habit libraries. Content work + a "pack picker" UI. Large.

No blockers on items 1–9. Items 10–11 should wait until the deployed app shows whether multi-device sync demand is real.

---

## 11. Open Questions / Decisions Needed

None right now. Last open question — "how should we handle the conflict between the old `/future-self` fire-emoji card and the new per-habit StreakFire grid?" — was resolved by force-pushing PR #11 to replace the older approach.

---

## 12. What I'm Confident About vs. Uncertain About

**Confident**:
- Local-first habit logging via Zustand persist. The store's `toggleHabit` / `setHabitValue` paths are battle-tested across every UI surface; the streak recompute and tier detection are pure functions called from a single anchor.
- The 13 sequential migrations are additive — every release I've added has only added optional fields and defaulted new arrays/records to empty. Users on any v9+ snapshot can load v13 without data loss.
- The StreakFire system's correctness on the happy path: icons exist, tier math is straightforward integer comparisons, celebration de-dupe via `celebratedTiers`.
- The Books module's multi-instance reading-habit model (PR #4). The migration carries forward existing single-reading-habit users cleanly.
- TypeScript across the codebase. Typecheck passes; the surface area is small enough that strict-mode catches most refactor breakage.

**Uncertain**:
- Cloud sync race conditions. With no automated tests and no per-doc writes, I can't prove a specific concurrent-edit scenario doesn't lose data — just that no user has reported it. The snapshot debounce is implicit (Zustand persist + post-set effect), not measured.
- The exact behavior of `maybeQueueTierCelebration` when a user toggles repeatedly within seconds across a tier boundary (e.g. mark complete, undo, mark complete). The de-dupe via `celebratedTiers` should still hold, but I haven't stress-tested. No test coverage to verify.
- Hijri date calculation correctness near month boundaries. `src/lib/hijri.ts` is hand-rolled without a library; the Ramadan auto-activation relies on it. No tests. Lookups against published Hijri tables would be reassuring.
- Persian text quality across the app. I can read it well enough to ship; I can't tell if a phrase reads as "translated awkwardly" vs. "native fluent" without a native reviewer.
- The `negativeSelfTalk` preset and its generic narrative. The compound math fires, but the messaging is bland and may not feel honest in either language.
- Firestore offline persistence on first-load failures. The try/catch around `persistentLocalCache` means we'd silently fall back; I haven't validated what an actual cold-cache load looks like to the user when the network is also down.
- The InstallPrompt's iOS detection. Works for me on the developer hardware; could mis-fire on iPad-as-desktop or in-app browsers (Instagram/Telegram webviews).

The system that scares me most if it breaks: **the per-user snapshot push**. A bad write here could corrupt a user's entire state. The safety net is the migration code's tolerance for missing/optional fields, but a malformed write (e.g. wrong field types) would only be caught by the next read.

---

*This file is regenerated on demand — after major features ship, after significant refactors, or whenever the truth on `main` materially diverges from the last snapshot. It is not auto-updated.*
