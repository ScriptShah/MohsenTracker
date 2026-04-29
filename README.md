# MohsenTracker

A bilingual (English + فارسی) habit-tracking PWA. Tiny daily actions compound into the person you become.

See [`HABIT_TRACKER_SPEC.md`](./HABIT_TRACKER_SPEC.md) for the full product spec and [`CLAUDE.md`](./CLAUDE.md) for architecture notes.

## Stack

Next.js 14 App Router · TypeScript · Tailwind · next-intl (en/fa, RTL) · Zustand + `localStorage` (offline-first; Firebase swap-in to come).

## Develop

```bash
npm install
npm run dev          # http://localhost:3000  → redirects to /en or /fa
npm run typecheck    # tsc --noEmit
npm run build        # production build
```

The app boots into onboarding the first time. Reset from the Profile tab.

## What's working (Phase 1 MVP)

- Locale-prefixed routes `/en/...` and `/fa/...` with `dir` switching automatically
- Onboarding (welcome → name → future-self vision → category picker)
- Home dashboard: today's checklist, streak chips, completion ring, future-self reminder
- Categories: six defaults seeded, drill-down per category, add custom habits, good/bad type with replacement-habit suggestion for bad habits
- Progress: GitHub-style 52-week heatmap (driven by precomputed daily `summary` per spec §8) and current-streak leaderboard
- PWA manifest

## Not yet (deferred to later phases)

Firebase auth/Firestore/FCM, push notifications, prayer times integration, Ramadan mode, intermittent-fasting timer, dopamine-reset, book tracker, charity tracker, real consequences messaging library, Persian translation review by a native speaker (current strings are drafts).
