'use client';

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseEnabled, getFirebase } from './firebase';
import { useAppStore } from './store';

const SNAPSHOT_VERSION = 1;

/** Fields of the Zustand state we replicate to the cloud. Action functions
 *  and ephemeral UI flags are excluded by listing only data shapes here. */
function snapshotState() {
  const s = useAppStore.getState();
  return {
    profile: s.profile,
    categories: s.categories,
    habits: s.habits,
    logs: s.logs,
    summaries: s.summaries,
    streaks: s.streaks,
    rewards: s.rewards,
    punishments: s.punishments,
    pendingRewards: s.pendingRewards,
    activePunishments: s.activePunishments,
    lastReconciledDate: s.lastReconciledDate,
    books: s.books,
    resets: s.resets,
    ramadan: s.ramadan,
  };
}

/** Replace the store with the given snapshot, preserving action methods. */
function applySnapshot(state: ReturnType<typeof snapshotState>) {
  useAppStore.setState(state, /* replace */ false);
}

/** Pulls the user's snapshot doc from Firestore and hydrates the store.
 *  Returns true when a snapshot was applied, false otherwise (no snapshot,
 *  Firebase disabled, or read failed). */
export async function pullSnapshot(uid: string): Promise<boolean> {
  if (!firebaseEnabled() || !uid) return false;
  const fb = getFirebase();
  if (!fb) return false;
  try {
    const ref = doc(fb.db, 'userSnapshots', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const data = snap.data();
    if (!data || !data.state) return false;
    applySnapshot(data.state as ReturnType<typeof snapshotState>);
    return true;
  } catch {
    return false;
  }
}

/** Writes the current store state to the user's snapshot doc.
 *  Best-effort; offline writes queue via the persistentLocalCache.
 *
 *  Stamps `profile.cloudSyncUid` with the writing uid before serializing
 *  so the next sign-in on a shared device can tell whose data the local
 *  snapshot belongs to.
 */
export async function pushSnapshot(uid: string): Promise<void> {
  if (!firebaseEnabled() || !uid) return;
  const fb = getFirebase();
  if (!fb) return;
  // Stamp the uid into the profile before we snapshot. If the profile
  // doesn't exist yet (pre-onboarding), there's nothing to stamp and the
  // first push will be effectively empty — that's fine; the stamp will
  // land on the next push after onboarding completes.
  const profile = useAppStore.getState().profile;
  if (profile && profile.cloudSyncUid !== uid) {
    useAppStore.setState({ profile: { ...profile, cloudSyncUid: uid } });
  }
  try {
    const ref = doc(fb.db, 'userSnapshots', uid);
    await setDoc(ref, {
      version: SNAPSHOT_VERSION,
      state: snapshotState(),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Swallow — write will retry when the network returns thanks to the
    // Firestore persistent cache.
  }
}
