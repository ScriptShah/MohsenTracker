'use client';

import { onAuthStateChanged } from 'firebase/auth';
import {
  doc,
  onSnapshot,
  runTransaction,
  type Unsubscribe,
} from 'firebase/firestore';
import { firebaseEnabled, getFirebase } from './firebase';
import { todayKey } from './dates';

/** Resolve to the current signed-in user's uid, or null when no one is
 *  signed in. Live counts are gated on a real user — anonymous auth is
 *  no longer used. */
export function currentUidPromise(): Promise<string | null> {
  if (!firebaseEnabled()) return Promise.resolve(null);
  const fb = getFirebase();
  if (!fb) return Promise.resolve(null);
  // Resolve immediately if we already know the state.
  if (fb.auth.currentUser) return Promise.resolve(fb.auth.currentUser.uid);
  return new Promise((resolve) => {
    const off = onAuthStateChanged(fb.auth, (user) => {
      off();
      resolve(user?.uid ?? null);
    });
  });
}

/** Increment today's public counter for `presetKey` exactly once per
 *  signed-in user. No-op when Firebase is disabled or the user is signed
 *  out (anonymous auth has been removed in favour of email / Google). */
export async function tickHabit(presetKey: string): Promise<void> {
  if (!presetKey) return;
  const uid = await currentUidPromise();
  if (!uid) return;
  const fb = getFirebase();
  if (!fb) return;
  const date = todayKey();
  const tickRef = doc(fb.db, 'habitTicks', uid, 'days', date);
  const countRef = doc(fb.db, 'habitCounts', date);

  try {
    await runTransaction(fb.db, async (tx) => {
      const tickSnap = await tx.get(tickRef);
      const ticked =
        tickSnap.exists() && (tickSnap.data() as any)[presetKey] === true;
      if (ticked) return;
      tx.set(tickRef, { [presetKey]: true }, { merge: true });
      const countSnap = await tx.get(countRef);
      const cur = countSnap.exists()
        ? (countSnap.data() as any)[presetKey] ?? 0
        : 0;
      tx.set(countRef, { [presetKey]: cur + 1 }, { merge: true });
    });
  } catch {
    // Network / permission errors are best-effort.
  }
}

/** Subscribe to today's counts. Returns an unsubscribe fn. The Firestore
 *  read is gated on auth — when the user signs in, the listener attaches;
 *  when they sign out, it detaches and we clear the count map. */
export function subscribeTodayCounts(
  cb: (counts: Record<string, number>) => void,
): Unsubscribe {
  if (!firebaseEnabled()) return () => {};
  const fb = getFirebase();
  if (!fb) return () => {};

  let firestoreUnsub: Unsubscribe | null = null;
  const offAuth = onAuthStateChanged(fb.auth, (user) => {
    if (firestoreUnsub) {
      firestoreUnsub();
      firestoreUnsub = null;
    }
    if (!user) {
      cb({});
      return;
    }
    const ref = doc(fb.db, 'habitCounts', todayKey());
    firestoreUnsub = onSnapshot(
      ref,
      (snap) => {
        cb((snap.exists() ? snap.data() : {}) as Record<string, number>);
      },
      () => cb({}),
    );
  });

  return () => {
    offAuth();
    if (firestoreUnsub) firestoreUnsub();
  };
}
