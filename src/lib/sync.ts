'use client';

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseEnabled, getFirebase } from './firebase';
import { useAppStore } from './store';

const SNAPSHOT_VERSION = 1;

/** Fields of the Zustand state we replicate to the cloud. Action functions
 *  and ephemeral UI flags are excluded by listing only data shapes here.
 *
 *  IMPORTANT: when adding a new top-level data slice to AppState, add it
 *  here too. The list is intentionally hand-written rather than derived
 *  from AppState so action methods don't leak through; the trade-off is
 *  that new slices have to be added in two places. Modules whose data was
 *  silently dropped in the past because of this gap: debts, savings,
 *  spiritualFasting, autophagyFasts — added in v14/v15 and missed for
 *  multiple releases until #45. If you add another slice, also update
 *  applySnapshot's typing and the §6 list in PROJECT_STATE.md.
 */
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
    debts: s.debts,
    savings: s.savings,
    spiritualFasting: s.spiritualFasting,
    autophagyFasts: s.autophagyFasts,
  };
}

/** Replace the store with the given snapshot, preserving action methods. */
function applySnapshot(state: ReturnType<typeof snapshotState>) {
  useAppStore.setState(state, /* replace */ false);
}

/** Result of a pull attempt. Callers MUST distinguish 'empty' (legit
 *  first sign-in — push local up to seed the cloud) from 'error'
 *  (transient failure — do NOT push, or we silently clobber the cloud
 *  with whatever was on this device). The old boolean return collapsed
 *  these two cases together, which caused cross-device data loss when
 *  the network blipped during sign-in: the pull failed, the caller
 *  pushed local data up, and the cloud version was lost. */
export type PullResult = 'found' | 'empty' | 'error';

/** Pulls the user's snapshot doc from Firestore and hydrates the store. */
export async function pullSnapshot(uid: string): Promise<PullResult> {
  if (!firebaseEnabled() || !uid) return 'error';
  const fb = getFirebase();
  if (!fb) return 'error';
  try {
    const ref = doc(fb.db, 'userSnapshots', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return 'empty';
    const data = snap.data();
    // A doc exists but has no state payload — could be a corrupted
    // write, an old schema, or a half-written doc. Treat as 'error'
    // (don't overwrite) rather than 'empty' (would push our local up).
    if (!data || !data.state) return 'error';
    applySnapshot(data.state as ReturnType<typeof snapshotState>);
    return 'found';
  } catch {
    return 'error';
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

/* The manual Pull / Push / peekCloudSnapshot helpers that previously
 * lived here were removed when the Profile diagnostic and Cloud Sync
 * Controls cards were unmounted — the destructive Pull (which
 * replaces local data with whatever's in the cloud) caused a user
 * data-loss incident. The automatic pull/push on sign-in above is
 * still the canonical sync path. If a manual control surface is ever
 * re-introduced, gate the destructive operations behind a typed
 * confirmation (user has to type the workspace/account name to
 * proceed), not just a single one-tap confirm dialog. */
