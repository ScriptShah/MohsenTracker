'use client';

import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { firebaseEnabled, getFirebase } from './firebase';

/** A single diagnostic check. Each probe exercises one specific
 *  Firebase / Firestore surface and reports back whether it works
 *  *for the currently-signed-in user* against the deployed rules. The
 *  whole suite is designed to catch the three classes of bug that have
 *  burned us repeatedly:
 *    1. Env vars missing or wrong → 'config' / 'auth' probes flag it
 *       before any write is attempted.
 *    2. Firestore rules in the Firebase console are stale (the repo's
 *       `firestore.rules` was updated but never re-published) → the
 *       write probes return `permission-denied`.
 *    3. The Firestore SDK rejects an undefined field, or the doc shape
 *       drifts from what rules expect → the workspace probe surfaces
 *       the exact Firebase error code, not a generic toast.
 */
export type ProbeStatus = 'pass' | 'fail' | 'skip';

export interface ProbeResult {
  /** Stable id used for translation lookup `settings.diagnostics.probes.<id>.label`. */
  id: string;
  status: ProbeStatus;
  /** Firebase error code on fail (e.g. 'permission-denied', 'unavailable'),
   *  or a free-form reason string on skip. Empty on pass. */
  code?: string;
  /** Underlying message from the Firebase error, kept for paste-into-bug
   *  diagnosis. Trimmed at render time. */
  message?: string;
}

/** Run every probe in order. Returns the full list of results — never
 *  throws. Probes that depend on earlier probes (e.g. workspace event
 *  needs workspace doc) get a 'skip' status when their precondition
 *  failed, with `code: 'prereq-failed'`. */
export async function runFirebaseDiagnostics(): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];

  // ── 1. Config ──────────────────────────────────────────────────────
  if (!firebaseEnabled()) {
    results.push({
      id: 'config',
      status: 'fail',
      code: 'env-missing',
      message:
        'NEXT_PUBLIC_FIREBASE_* env vars are missing from this build. The cloud features will not work until they are added.',
    });
    // Without config there's nothing more to probe.
    return appendSkips(results, ['auth', 'userSnapshots', 'workspaceCycle']);
  }
  results.push({ id: 'config', status: 'pass' });

  // ── 2. Auth ────────────────────────────────────────────────────────
  const fb = getFirebase();
  if (!fb) {
    results.push({
      id: 'auth',
      status: 'fail',
      code: 'firebase-init',
      message: 'Firebase client failed to initialize.',
    });
    return appendSkips(results, ['userSnapshots', 'workspaceCycle']);
  }
  const user = fb.auth.currentUser;
  if (!user) {
    results.push({
      id: 'auth',
      status: 'fail',
      code: 'signed-out',
      message: 'No user is currently signed in.',
    });
    return appendSkips(results, ['userSnapshots', 'workspaceCycle']);
  }
  if (user.isAnonymous) {
    results.push({
      id: 'auth',
      status: 'fail',
      code: 'anonymous',
      message:
        'You are signed in as a guest. Cloud features need a real Google or email account.',
    });
    return appendSkips(results, ['userSnapshots', 'workspaceCycle']);
  }
  results.push({ id: 'auth', status: 'pass' });

  // ── 3. userSnapshots write (cloud-sync surface) ────────────────────
  // Touch the user's own snapshot doc with a single tiny field. Uses
  // `merge: true` so we never overwrite existing state. If this fails
  // the cloud-sync side of the app is broken — exactly the symptom
  // behind the cross-device "same email, different data" report.
  try {
    const ref = doc(fb.db, 'userSnapshots', user.uid);
    await setDoc(
      ref,
      { _diagnosticCheckedAt: serverTimestamp() },
      { merge: true },
    );
    results.push({ id: 'userSnapshots', status: 'pass' });
  } catch (e: any) {
    results.push({
      id: 'userSnapshots',
      status: 'fail',
      code: e?.code ?? 'unknown',
      message: e?.message ?? String(e ?? 'unknown'),
    });
  }

  // ── 4. Workspace cycle (the killer probe) ──────────────────────────
  // Create a test workspace + member doc + invite doc + event doc,
  // then delete every one in reverse order. This single probe
  // exercises every rule we use for the workspaces feature, so a
  // pass means the user can create workspaces, join them, leave them,
  // and the activity feed works. A fail at any step shows exactly
  // which rule is the problem.
  await probeWorkspaceCycle(fb, user.uid, user.displayName, results);

  return results;
}

/** Append 'skip' results for the remaining probe ids. Used when an
 *  earlier probe failed and we want to short-circuit but still render
 *  every row in the UI. */
function appendSkips(results: ProbeResult[], remaining: string[]): ProbeResult[] {
  for (const id of remaining) {
    results.push({
      id,
      status: 'skip',
      code: 'prereq-failed',
    });
  }
  return results;
}

async function probeWorkspaceCycle(
  fb: NonNullable<ReturnType<typeof getFirebase>>,
  uid: string,
  displayName: string | null,
  results: ProbeResult[],
): Promise<void> {
  const wsId = `ws_diag_${Date.now().toString(36)}`;
  const inviteCode = `DIAG${Date.now().toString(36).toUpperCase().slice(-6)}`;
  const eventId = `evt_diag_${Date.now().toString(36)}`;
  const name = displayName?.trim() || 'Diagnostic';

  // Step A: workspace parent doc.
  try {
    await setDoc(doc(fb.db, 'workspaces', wsId), {
      id: wsId,
      mode: 'pair',
      title: '🔧 Diagnostic test (auto-deleted)',
      icon: '🔧',
      ownerUid: uid,
      memberUids: [uid],
      maxMembers: 2,
      inviteCode,
      createdAt: new Date().toISOString(),
    });
    results.push({ id: 'workspaceCycle', status: 'pass' });
  } catch (e: any) {
    results.push({
      id: 'workspaceCycle',
      status: 'fail',
      code: e?.code ?? 'unknown',
      message: e?.message ?? String(e ?? 'unknown'),
    });
    // Without the parent doc, none of the subcollection probes can
    // succeed — but we still want to surface their probable failures
    // so the user gets the full diagnostic surface. Skip them quietly.
    return;
  }

  // Step B: member subdoc.
  try {
    await setDoc(doc(fb.db, 'workspaces', wsId, 'members', uid), {
      uid,
      displayName: name,
      joinedAt: new Date().toISOString(),
      role: 'owner',
    });
    results.push({ id: 'workspaceMember', status: 'pass' });
  } catch (e: any) {
    results.push({
      id: 'workspaceMember',
      status: 'fail',
      code: e?.code ?? 'unknown',
      message: e?.message ?? String(e ?? 'unknown'),
    });
  }

  // Step C: invite-code doc.
  try {
    await setDoc(doc(fb.db, 'workspaceInvites', inviteCode), {
      inviteCode,
      wsId,
      createdAt: new Date().toISOString(),
    });
    results.push({ id: 'workspaceInvite', status: 'pass' });
  } catch (e: any) {
    results.push({
      id: 'workspaceInvite',
      status: 'fail',
      code: e?.code ?? 'unknown',
      message: e?.message ?? String(e ?? 'unknown'),
    });
  }

  // Step D: activity-feed event. THIS is the rule most likely to be
  // missing — it was added in the recent activity-feed PR and is the
  // canonical "did the user re-publish their Firestore rules?" check.
  try {
    await setDoc(doc(fb.db, 'workspaces', wsId, 'events', eventId), {
      id: eventId,
      type: 'member-joined',
      actorUid: uid,
      actorName: name,
      at: new Date().toISOString(),
    });
    results.push({ id: 'workspaceEvent', status: 'pass' });
  } catch (e: any) {
    results.push({
      id: 'workspaceEvent',
      status: 'fail',
      code: e?.code ?? 'unknown',
      message: e?.message ?? String(e ?? 'unknown'),
    });
  }

  // Cleanup, reverse-order, best-effort. We don't surface cleanup
  // failures as probes — if the user's rules block delete but allowed
  // create, they have bigger problems anyway and the orphan is named
  // with the 🔧 marker so they can spot it manually.
  await safeDelete(() =>
    deleteDoc(doc(fb.db, 'workspaces', wsId, 'events', eventId)),
  );
  await safeDelete(() =>
    deleteDoc(doc(fb.db, 'workspaceInvites', inviteCode)),
  );
  await safeDelete(() =>
    deleteDoc(doc(fb.db, 'workspaces', wsId, 'members', uid)),
  );
  await safeDelete(() => deleteDoc(doc(fb.db, 'workspaces', wsId)));
}

async function safeDelete(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch {
    /* swallow */
  }
}

/** True when at least one probe failed. Used by the UI to decide
 *  whether to render the "next steps" guidance card. */
export function anyFailed(results: ProbeResult[]): boolean {
  return results.some((r) => r.status === 'fail');
}

/** Re-runs `getDoc` on the user's snapshot to confirm read access too.
 *  Kept out of `runFirebaseDiagnostics` because the write probe above
 *  already exercises the rule, but exported for tests / debugging. */
export async function pingUserSnapshotRead(uid: string): Promise<boolean> {
  if (!firebaseEnabled()) return false;
  const fb = getFirebase();
  if (!fb) return false;
  try {
    await getDoc(doc(fb.db, 'userSnapshots', uid));
    return true;
  } catch {
    return false;
  }
}
