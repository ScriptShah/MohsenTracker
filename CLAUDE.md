# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository State

This repository is currently **spec-only**. There is no source code, no `package.json`, no build system, and no tests yet. The single source of truth is `HABIT_TRACKER_SPEC.md` (~2,200 lines), which fully describes the product to be built. `README.md` is a one-line stub.

When a future task involves writing actual code, the first step is scaffolding the Next.js 14+ App Router project described below. Until then, "build/lint/test" commands do not exist — do not invent them.

## Product

A bilingual (English + Persian/Farsi) habit-tracking PWA grounded in *The Compound Effect* and *Atomic Habits*, with first-class Islamic practice tracking (prayers, Quran, Sunnah, Ramadan mode). The defining differentiator is **compound-effect projection** — every habit surfaces a concrete future-self number ("10 pages daily = 120 books a decade"). That visualization is the emotional core of the product, not a side feature.

See `HABIT_TRACKER_SPEC.md` for the complete spec. Important sections:
- §3 Tech Stack
- §4 Six Core Categories (Islamic, Health, Finance, Career, Personal Growth, Relationships)
- §5 Key Features (compound projections, GitHub-style heatmap, future-self vision, reward/punishment systems)
- §6 Ramadan Mode (auto-activates on Hijri calendar)
- §8 Firestore schema
- §13 Bilingual / RTL requirements
- §14–§17 Habit content libraries (Sunnah, Sahaba, Muslim youth, family)
- §19 Dopamine Reset feature
- §20 Book Tracker
- §21 Loss Aversion / Real Consequences Messaging

## Intended Stack (from spec)

- **Next.js 14+ App Router** with TypeScript
- **Tailwind CSS** with logical properties (`ms-`/`me-`/`ps-`/`pe-`) — required for RTL
- **Framer Motion**, **Recharts** (or Chart.js)
- **next-pwa** for PWA, **next-intl** (preferred) for i18n
- **Zustand** (or React Context) for state
- **date-fns** + **date-fns-jalali** + Hijri date library
- **Firebase**: Auth, Firestore, Cloud Storage, Cloud Messaging, Cloud Functions
- **Vercel** hosting; locale routing `/en/...` and `/fa/...`

Keep these aligned when scaffolding — the spec's content libraries, Firestore schema, and feature designs assume them.

## Architectural Constraints (Read Before Coding)

These are non-obvious decisions from the spec that constrain implementation across files. Violating them creates cross-cutting rework.

1. **Bilingual + RTL from day 1, not retrofitted.** Persian is launch-critical, not a future translation. Every component must use Tailwind logical properties (never `ml-`/`pr-`/etc.), every directional icon flips, charts need explicit RTL config (Recharts: reversed X-axis, flipped legend), and `<html dir>` switches per locale. Persian text needs larger line-height (1.7–1.8). Numbers stay LTR even in RTL UI; user toggles between Persian (۰۱۲۳۴۵۶۷۸۹) and Western numerals. See spec §13.

2. **Offline-first habit logging.** Users must check off habits without internet, syncing on reconnect. This shapes the data layer — write through a local store (e.g., IndexedDB) and reconcile to Firestore, not direct Firestore writes. PWA + Firestore offline persistence must be wired in early.

3. **Firestore schema is per-user-rooted** (`users/{uid}`, `categories/{uid}/{catId}`, `habits/{uid}/{habitId}`, `logs/{uid}/{YYYY-MM-DD}/{habitId}`, `streaks/{uid}/{habitId}`, etc.). Daily log documents include a precomputed `summary` field (`totalHabits`, `completedCount`, `completionRate`) so the GitHub-style heatmap can render a year without aggregating client-side. Maintain that summary on every log write. See spec §8.

4. **Categories are user-customizable.** The six defaults (Islamic, Health, Finance, Career, Personal Growth, Relationships) are seeds — users can rename, reorder, archive, or add their own. Do not hardcode category enums in UI logic; drive everything off the user's `categories/{uid}/*` collection. Removing a category archives data (soft delete with `archivedAt`), it does not destroy logs.

5. **Bad habits auto-suggest a good replacement.** When the user creates a bad habit, the system must propose its opposite (e.g., excessive phone → reading). Habits store a `replacementHabitId` link. This is a product-level promise from §5.7, not optional UX polish.

6. **Ramadan Mode auto-activates from the Hijri calendar** and reshapes the home dashboard (Iftar countdown most prominent, prayer checklist, Quran progress; non-Islamic categories minimized, push notifications paused). This is a top-level theme switch, not a settings toggle. Last-10-nights and pre/post-Ramadan sub-modes also exist. See §6.1.

7. **Punishment system has hard safety guardrails.** Default to charity-based (StickK-style) punishments. Never punish in ways that undermine health goals (no skipped meals, no extreme exercise). New users must default to safe options. See §5.5.

8. **Sensitive content stays in original language.** Quranic verses, adhkar, and dua remain in Arabic with translations alongside — never machine-translate them. Sunnah names (Tahajjud, Sadaqah, Zakat) stay as Arabic transliterations with translation as subtitle/tooltip. The Prophet's name uses ﷺ in both languages. See §13.

9. **Privacy: this app holds faith, finance, and personal-goal data.** Encrypt sensitive fields, support full data export and deletion. Don't add analytics or third-party trackers without explicit opt-in.

## Design Principles (from spec §10)

- Mobile-first, fully responsive
- Beautiful charts are non-negotiable — they carry the product's emotional weight
- Minimal friction to log habits (one tap where possible)
- Calming colors default; sacred theme only during Ramadan
- No dark patterns

## Working With the Spec

- The spec contains large content libraries (§11 compound messages, §14 habit coaching, §15–17 habit lists, §19 dopamine reset, §21 consequences). Treat these as **content data** to be loaded from JSON/translation files, not hardcoded into components. They will be edited frequently.
- Translation responsibility: Persian translations of habit content and compound messages should be authored by a native Persian speaker with Islamic knowledge (not Google Translate). When generating Persian strings from this spec, mark them clearly as drafts pending review.
- §22 lists open product questions that remain undecided — flag if a task touches one of them rather than guessing the resolution.
