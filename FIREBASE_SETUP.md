# Firebase setup — live habit counts

The "live habit counts" feature ("142 doing this today" badges on each
habit on the home screen) is the only feature in MohsenTracker that
requires a backend. Everything else runs entirely client-side. The app
works perfectly without Firebase configured — the badges just don't
render.

## What you need to do

You need a Firebase project. The Spark (free) tier is enough.

### 1. Create the Firebase project

1. Go to <https://console.firebase.google.com/> and click **Add project**.
2. Pick a name (e.g. `mohsentracker`).
3. Disable Google Analytics (optional — not used here).
4. Wait for the project to provision.

### 2. Add a Web app

1. In the project's **Project Overview**, click the `</>` (Web) icon.
2. Register the app — any nickname is fine.
3. Skip Hosting; we use Vercel.
4. Firebase will show a `firebaseConfig` object. **Keep this tab open** —
   you'll paste 6 values in the next step.

### 3. Paste the config into `.env.local`

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in:

| env var | Firebase config key |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `appId` |

For the deployed Vercel app, add the same variables under **Project
Settings → Environment Variables** in the Vercel dashboard.

### 4. Enable sign-in providers

The app supports three sign-in options. Enable all three for the best
UX (users pick whichever they prefer).

1. Firebase console → **Build → Authentication → Get started**.
2. Under **Sign-in method**, click **Google** → toggle **Enable** → pick
   the support email → **Save**. (One-tap social sign-in.)
3. Click **Add new provider → Email/Password** → toggle **Enable** →
   **Save**. (Email + password fallback for users who don't want Google.)
4. Click **Add new provider → Anonymous** → toggle **Enable** → **Save**.
   (Lets users try the app without giving an email; they can convert to
   a real account later.)
5. Under the **Settings → Authorized domains** tab, make sure
   `localhost` is listed (it usually is by default) and **add your Vercel
   domain** (e.g. `mohsentracker.vercel.app`) so Google sign-in works in
   production.

### 5. Create the Firestore database

1. Firebase console → **Build → Firestore Database → Create database**.
2. Pick **Start in production mode**.
3. Choose a region close to your users (e.g. `eur3` for Europe, `nam5`
   for North America). This is permanent.

### 6. Publish the security rules

1. Firebase console → **Firestore Database → Rules**.
2. Replace the contents with the file `firestore.rules` from this repo
   (or just paste it from there).
3. Click **Publish**.

> ⚠️ **`firestore.rules` is NOT deployed automatically by Vercel.**
> Vercel only deploys the Next.js app. The Firestore security rules
> live in your Firebase project and are completely separate. **Every
> time `firestore.rules` changes in the repo, you have to re-publish
> the new contents** via this same console page — otherwise new
> features (workspaces, activity-feed events, etc.) will silently fail
> with `permission-denied`. The most common symptom is "I added a new
> feature that touches Firestore and it works locally but fails in
> production" — the answer is almost always "re-publish the rules."
>
> If you'd rather automate this, install the Firebase CLI
> (`npm i -g firebase-tools`), run `firebase login` once, then
> `firebase deploy --only firestore:rules` whenever the file changes.
> A GitHub Action could call this on every merge to main.

### 7. Verify

Restart the dev server (`npm run dev`) and open the home screen. Then:

1. Go to `/profile` (top-right user icon). You should see a "Sign in"
   card. Sign in with Google or create an email/password account.
2. After sign-in, the profile shows your username (the part of your
   email before `@`) and a sign-out button.
3. Go back to home and complete any preset habit. Within ~2 seconds
   "🌱 1 doing this today" appears next to the habit. If multiple
   devices/users complete the same preset on the same day, the count
   increments live.

## Notes

- Counts are per **preset key** (`reading`, `exercise`, `fivePrayers`, …)
  so custom user-named habits don't get aggregated. This protects user
  privacy and avoids unbounded fan-out of the counts doc.
- Each user is counted once per (date, presetKey) — backed by a
  per-user `habitTicks/{uid}/days/{date}` document. Toggling a habit off
  and back on doesn't double-count.
- If a user does 20 pages instead of 10, the count still only goes up by
  one — over-completion doesn't multi-count.
- The feature is **best-effort**: when Firebase is offline or rules
  reject the write, the local UI keeps working and counts simply don't
  update.
- **Sign-in is required** for live counts. Users who never sign in still
  use the app fully (everything works locally) but their habit ticks
  don't contribute to the public counter, and they don't see the
  "🌱 N doing this today" badges.
