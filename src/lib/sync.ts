'use client';

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
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

/* ── Cloud sync diagnostics + manual controls ─────────────────────── */

/** A read-only peek at the user's cloud snapshot metadata WITHOUT
 *  applying it to the local store. Used by the Profile diagnostics
 *  card to show the user "your cloud version was last written at X by
 *  uid Y" so cross-device mismatches become obvious. */
export interface CloudSnapshotInfo {
  exists: boolean;
  updatedAt: Date | null;
  /** Whether the cloud doc has a `state` payload. A doc without one
   *  is corrupted / half-written. */
  hasState: boolean;
  /** A rough sense of how much data is in the cloud snapshot — counts
   *  the user's habits, books, logs (days). Gives the user a way to
   *  see at a glance "the cloud has 7 habits, this device has 12 —
   *  so this device is the more recent one." */
  counts: {
    habits: number;
    books: number;
    logDays: number;
    workspaces: number;
  };
  /** Error code from Firebase if the read failed. */
  errorCode?: string;
}

export async function peekCloudSnapshot(
  uid: string,
): Promise<CloudSnapshotInfo> {
  const empty: CloudSnapshotInfo = {
    exists: false,
    updatedAt: null,
    hasState: false,
    counts: { habits: 0, books: 0, logDays: 0, workspaces: 0 },
  };
  if (!firebaseEnabled() || !uid) {
    return { ...empty, errorCode: 'firebase-disabled' };
  }
  const fb = getFirebase();
  if (!fb) return { ...empty, errorCode: 'firebase-init' };
  try {
    const ref = doc(fb.db, 'userSnapshots', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return empty;
    const data = snap.data() as
      | {
          updatedAt?: Timestamp;
          state?: {
            habits?: unknown[];
            books?: unknown[];
            logs?: Record<string, unknown>;
            workspaces?: unknown[];
          };
        }
      | undefined;
    const state = data?.state ?? null;
    return {
      exists: true,
      updatedAt: data?.updatedAt?.toDate() ?? null,
      hasState: Boolean(state),
      counts: {
        habits: state?.habits?.length ?? 0,
        books: state?.books?.length ?? 0,
        logDays: state?.logs ? Object.keys(state.logs).length : 0,
        // workspaces aren't part of the per-user snapshot — kept for
        // future shape parity; always 0 today.
        workspaces: 0,
      },
    };
  } catch (e: any) {
    return { ...empty, errorCode: e?.code ?? 'unknown' };
  }
}

/** Manual pull, surfacing the result so the UI can confirm to the
 *  user what happened. Wraps `pullSnapshot` (which is also called
 *  automatically by CloudSync on sign-in) with an outer Promise so the
 *  Profile button can show "✓ Pulled" / "✗ Error". */
export async function manualPull(uid: string): Promise<PullResult> {
  return pullSnapshot(uid);
}

/** Manual push that returns a discriminated success/failure result.
 *  The default `pushSnapshot` swallows errors silently because the
 *  Firestore persistent cache retries — but on a manual button click
 *  the user needs to know whether their tap worked, so this variant
 *  surfaces the error code. */
export async function manualPush(
  uid: string,
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  if (!firebaseEnabled() || !uid) {
    return {
      ok: false,
      code: 'firebase-disabled',
      message: 'Firebase is not configured.',
    };
  }
  const fb = getFirebase();
  if (!fb) {
    return {
      ok: false,
      code: 'firebase-init',
      message: 'Firebase client unavailable.',
    };
  }
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
    return { ok: true };
  } catch (e: any) {
    return {
      ok: false,
      code: e?.code ?? 'unknown',
      message: e?.message ?? String(e ?? 'unknown'),
    };
  }
}
