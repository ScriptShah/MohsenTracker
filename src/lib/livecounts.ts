'use client';

import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  doc,
  onSnapshot,
  runTransaction,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebase, firebaseEnabled } from './firebase';
import { todayKey } from './dates';

/** Best-effort anonymous sign-in. Idempotent. */
let signInPromise: Promise<string | null> | null = null;
export function ensureSignedIn(): Promise<string | null> {
  if (!firebaseEnabled()) return Promise.resolve(null);
  if (signInPromise) return signInPromise;
  signInPromise = new Promise((resolve) => {
    const fb = getFirebase();
    if (!fb) return resolve(null);
    const off = onAuthStateChanged(fb.auth, (user) => {
      if (user) {
        off();
        resolve(user.uid);
      }
    });
    signInAnonymously(fb.auth).catch(() => {
      off();
      resolve(null);
    });
  });
  return signInPromise;
}

/** Increment today's public counter for `presetKey` exactly once per user.
 *  Stores a per-user tick at habitTicks/{uid}/days/{date} with map of
 *  ticked preset keys; if the key is already true there, the transaction
 *  is a no-op. Public counters live at habitCounts/{date}.
 *
 *  Best-effort: silently no-ops when Firebase is disabled or offline.
 */
export async function tickHabit(presetKey: string): Promise<void> {
  if (!presetKey) return;
  const uid = await ensureSignedIn();
  if (!uid) return;
  const fb = getFirebase();
  if (!fb) return;
  const date = todayKey();
  const tickRef = doc(fb.db, 'habitTicks', uid, 'days', date);
  const countRef = doc(fb.db, 'habitCounts', date);

  try {
    await runTransaction(fb.db, async (tx) => {
      const tickSnap = await tx.get(tickRef);
      const ticked = tickSnap.exists() && (tickSnap.data() as any)[presetKey] === true;
      if (ticked) return;
      tx.set(tickRef, { [presetKey]: true }, { merge: true });
      // Server-side increment via FieldValue would be cleaner, but we read
      // the count first and write +1 within the transaction, which is also
      // atomic for this single-doc field.
      const countSnap = await tx.get(countRef);
      const cur = countSnap.exists() ? (countSnap.data() as any)[presetKey] ?? 0 : 0;
      tx.set(countRef, { [presetKey]: cur + 1 }, { merge: true });
    });
  } catch {
    // Network/permission errors are fine to swallow — counts are best-effort.
  }
}

/** Subscribe to today's counts. Returns the unsubscribe fn (or a no-op
 *  when Firebase is disabled). */
export function subscribeTodayCounts(
  cb: (counts: Record<string, number>) => void,
): Unsubscribe {
  if (!firebaseEnabled()) return () => {};
  const fb = getFirebase();
  if (!fb) return () => {};
  const date = todayKey();
  const ref = doc(fb.db, 'habitCounts', date);
  // Sign in lazily so reads work for anonymous users behind security rules.
  ensureSignedIn();
  return onSnapshot(
    ref,
    (snap) => {
      const data = (snap.exists() ? snap.data() : {}) as Record<string, number>;
      cb(data);
    },
    () => cb({}),
  );
}
