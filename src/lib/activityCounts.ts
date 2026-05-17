'use client';

import { onAuthStateChanged } from 'firebase/auth';
import {
  doc,
  onSnapshot,
  runTransaction,
  type Unsubscribe,
} from 'firebase/firestore';
import { firebaseEnabled, getFirebase } from './firebase';
import { currentUidPromise } from './livecounts';
import { todayKey } from './dates';

/** Public daily counters for non-habit activities — autophagy fasts and
 *  dopamine resets. Same pattern as `habitCounts`:
 *    - Per-user dedupe doc (`{activity}Ticks/{uid}/days/{date}`) prevents
 *      one user from inflating the count by tapping multiple times in a day.
 *    - Public count doc (`{activity}Counts/{date}`) holds an integer per
 *      bucket; any signed-in user can read + atomic-increment via a
 *      Firestore transaction.
 *    - Increment-only, daily key. No decrement-on-end pathway means a
 *      force-quit can't strand the counter in an inflated "active" state.
 *
 *  Display copy: "X people started a fast today alongside you" —
 *  inclusive, identity-framed, no comparison.
 */

type Activity = 'autophagy' | 'reset';

/** Bumps the named bucket on today's public counter for the given activity,
 *  at most once per signed-in user per day per bucket. */
async function tickActivity(activity: Activity, bucket: string): Promise<void> {
  if (!bucket) return;
  const uid = await currentUidPromise();
  if (!uid) return;
  const fb = getFirebase();
  if (!fb) return;
  const date = todayKey();
  const tickRef = doc(fb.db, `${activity}Ticks`, uid, 'days', date);
  const countRef = doc(fb.db, `${activity}Counts`, date);

  try {
    await runTransaction(fb.db, async (tx) => {
      const tickSnap = await tx.get(tickRef);
      const ticked =
        tickSnap.exists() && (tickSnap.data() as any)[bucket] === true;
      if (ticked) return;
      tx.set(tickRef, { [bucket]: true }, { merge: true });
      const countSnap = await tx.get(countRef);
      const cur = countSnap.exists()
        ? (countSnap.data() as any)[bucket] ?? 0
        : 0;
      tx.set(countRef, { [bucket]: cur + 1 }, { merge: true });
    });
  } catch {
    // Best-effort. Network / permission errors fall through silently.
  }
}

/** Counts the user as one of today's autophagy starters. Called from the
 *  store on `startAutophagyFast`. */
export function tickAutophagyStart(): Promise<void> {
  return tickActivity('autophagy', 'started');
}

/** Counts the user as one of today's autophagy completers. Called from the
 *  store on `endAutophagyFast`. */
export function tickAutophagyComplete(): Promise<void> {
  return tickActivity('autophagy', 'completed');
}

/** Counts the user as one of today's dopamine-reset starters. Called from
 *  the store on `startReset`. */
export function tickResetStart(): Promise<void> {
  return tickActivity('reset', 'started');
}

/* ── Subscriptions ───────────────────────────────────────────────────── */

function subscribeTodayActivityCounts(
  activity: Activity,
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
    const ref = doc(fb.db, `${activity}Counts`, todayKey());
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

export function subscribeAutophagyCounts(
  cb: (counts: { started?: number; completed?: number }) => void,
): Unsubscribe {
  return subscribeTodayActivityCounts('autophagy', cb);
}

export function subscribeResetCounts(
  cb: (counts: { started?: number }) => void,
): Unsubscribe {
  return subscribeTodayActivityCounts('reset', cb);
}
