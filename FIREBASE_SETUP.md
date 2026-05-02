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

### 4. Enable Anonymous Authentication

1. Firebase console → **Build → Authentication → Get started**.
2. Under **Sign-in method**, enable **Anonymous**. Save.

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

### 7. Verify

Restart the dev server (`npm run dev`) and open the home screen. After
you complete a habit, you should see "🌱 1 doing this today" appear next
to it within a couple of seconds. If multiple devices/users complete the
same preset on the same day, the count increments live.

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
