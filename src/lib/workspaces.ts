'use client';

import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { firebaseEnabled, getFirebase } from './firebase';
import { currentUidPromise } from './livecounts';
import type {
  Frequency,
  HabitLogStatus,
  HabitType,
  Workspace,
  WorkspaceDayLog,
  WorkspaceEvent,
  WorkspaceEventType,
  WorkspaceHabit,
  WorkspaceMember,
  WorkspaceMode,
} from '@/domain/types';

/** Source-of-truth Firestore layout for shared "workspaces" (pair/group
 *  spaces where members co-track a shared habit set):
 *
 *    workspaces/{wsId}                          — Workspace
 *    workspaces/{wsId}/members/{uid}            — WorkspaceMember
 *    workspaceInvites/{inviteCode}              — { wsId } lookup doc
 *
 *  The parent `workspaces` doc carries the canonical `memberUids[]` so
 *  Firestore rules can verify membership cheaply ("is request.auth.uid in
 *  resource.data.memberUids"). The `members` subcollection holds the
 *  denormalized display info (name, photoURL) so a member list render
 *  doesn't need a parallel auth-server lookup.
 *
 *  Invite flow: a member shares `/workspaces/join?code=ABC12345`. The
 *  new device reads `workspaceInvites/{code}` (public read), resolves
 *  the wsId, then fetches `workspaces/{wsId}` and writes itself into
 *  `memberUids`. The Firestore rule allows the join only when the
 *  diff is exactly "add myself" and the new size is ≤ maxMembers.
 */

const PAIR_CAP = 2;
const GROUP_CAP = 10; // v1 ceiling per the workspaces spec.

/** Generate a short, copy-pasteable invite code. 8 alphanumeric chars,
 *  uppercase only, ambiguous characters (0/O, 1/I/L) removed for
 *  readability. ~10^13 combinations — collision risk negligible at
 *  reasonable scale. */
export function generateInviteCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  const buf = new Uint32Array(8);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 8; i++) {
    out += alphabet[buf[i] % alphabet.length];
  }
  return out;
}

/** Resolve "pair" → 2, "group" → 10. Centralised so future tweaks
 *  (e.g. raising the group cap) only touch one place. */
export function workspaceCap(mode: WorkspaceMode): number {
  return mode === 'pair' ? PAIR_CAP : GROUP_CAP;
}

/* ── Create ──────────────────────────────────────────────────────────── */

export interface CreateWorkspaceInput {
  mode: WorkspaceMode;
  title: string;
  icon: string;
  /** The display name + photo for the creator. Comes from Firebase Auth's
   *  user profile (`auth.currentUser.displayName`, `.photoURL`). Captured
   *  at creation time so other members see something immediately. */
  ownerDisplayName: string;
  ownerPhotoURL?: string;
}

/** Which step of the create flow failed. Surfacing this distinguishes
 *  "I couldn't even start because you're signed out" from "the workspace
 *  doc wrote fine but the member subdoc was rejected" — helpful both
 *  for support diagnosis and for the UI to give specific guidance
 *  (e.g. only the workspace-doc rejection requires retrying the whole
 *  flow; a failed invite-doc is recoverable by rotating the code). */
export type CreateWorkspaceStage =
  | 'preflight'
  | 'workspace-doc'
  | 'member-doc'
  | 'invite-doc';

export type CreateWorkspaceResult =
  | { ok: true; workspace: Workspace }
  | {
      ok: false;
      stage: CreateWorkspaceStage;
      /** Firebase error code if available (e.g. 'permission-denied',
       *  'unavailable'), else the JS error message, else 'unknown'. */
      code: string;
      /** Human-readable message from the underlying error, kept for
       *  console diagnosis. */
      message: string;
    };

/** Creates the workspace, the owner's member doc, and the invite-code
 *  lookup doc. Returns a structured result so the caller can surface
 *  the actual failure to the user instead of a generic "something went
 *  wrong" toast. Best-effort cleanup on partial failure: if any of the
 *  three writes fails, the others linger and the user retries
 *  (acceptable for a low-frequency operation). */
export async function createWorkspace(
  input: CreateWorkspaceInput,
): Promise<CreateWorkspaceResult> {
  if (!firebaseEnabled()) {
    return {
      ok: false,
      stage: 'preflight',
      code: 'firebase-disabled',
      message: 'Firebase is not configured on this build.',
    };
  }
  const uid = await currentUidPromise();
  if (!uid) {
    return {
      ok: false,
      stage: 'preflight',
      code: 'signed-out',
      message: 'No signed-in user.',
    };
  }
  const fb = getFirebase();
  if (!fb) {
    return {
      ok: false,
      stage: 'preflight',
      code: 'firebase-disabled',
      message: 'Firebase client unavailable.',
    };
  }

  const wsId = `ws_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const inviteCode = generateInviteCode();
  const maxMembers = workspaceCap(input.mode);
  const nowIso = new Date().toISOString();

  const workspace: Workspace = {
    id: wsId,
    mode: input.mode,
    title: input.title.trim(),
    icon: input.icon,
    ownerUid: uid,
    memberUids: [uid],
    maxMembers,
    inviteCode,
    createdAt: nowIso,
  };

  // Stage 1: the workspace doc itself. This is the only stage whose
  // failure means "nothing was created" — we have to give up here.
  try {
    await setDoc(doc(fb.db, 'workspaces', wsId), {
      ...workspace,
      createdAtServer: serverTimestamp(),
    });
  } catch (e: any) {
    console.error('[createWorkspace] workspace-doc write failed:', e);
    return {
      ok: false,
      stage: 'workspace-doc',
      code: e?.code ?? 'unknown',
      message: e?.message ?? String(e ?? 'unknown'),
    };
  }

  // Stage 2: member subdoc. Failure here means the workspace exists but
  // the owner isn't visible in the member list yet — degraded but not
  // unusable. Surface the error so the user can retry; the parent doc
  // can be re-used (idempotent setDoc on the same wsId).
  const member: WorkspaceMember = {
    uid,
    displayName: input.ownerDisplayName,
    photoURL: input.ownerPhotoURL,
    joinedAt: nowIso,
    role: 'owner',
  };
  try {
    await setDoc(doc(fb.db, 'workspaces', wsId, 'members', uid), member);
  } catch (e: any) {
    console.error('[createWorkspace] member-doc write failed:', e);
    return {
      ok: false,
      stage: 'member-doc',
      code: e?.code ?? 'unknown',
      message: e?.message ?? String(e ?? 'unknown'),
    };
  }

  // Stage 3: invite-code lookup doc. Failure here means the workspace
  // and owner-member doc both exist, but no one can join — the owner
  // can rotate the code later, so this is recoverable. Still surface
  // so the caller can decide whether to celebrate or retry.
  try {
    await setDoc(doc(fb.db, 'workspaceInvites', inviteCode), {
      inviteCode,
      wsId,
      createdAt: nowIso,
    });
  } catch (e: any) {
    console.error('[createWorkspace] invite-doc write failed:', e);
    return {
      ok: false,
      stage: 'invite-doc',
      code: e?.code ?? 'unknown',
      message: e?.message ?? String(e ?? 'unknown'),
    };
  }

  return { ok: true, workspace };
}

/* ── Join ────────────────────────────────────────────────────────────── */

export type JoinWorkspaceResult =
  | {
      ok: true;
      wsId: string;
      /** Mode + title are populated post-join only when we managed to read
       *  the workspace doc (i.e. previously, via the now-removed pre-join
       *  transaction). With the blind-arrayUnion approach the join can't
       *  read the doc as a non-member, so these are undefined on first
       *  join — the caller subscribes to the workspace immediately after
       *  routing to it and pulls the title/mode from the subscription. */
      mode?: WorkspaceMode;
      title?: string;
    }
  | { ok: false; error: JoinError };

export type JoinError =
  | 'firebase-disabled'
  | 'signed-out'
  | 'invalid-code'
  | 'workspace-missing'
  | 'already-member'
  | 'workspace-full'
  | 'unknown';

/** Resolves the code → wsId, fetches the workspace, and atomically adds
 *  the current user to `memberUids` (capped at maxMembers). Also creates
 *  the user's member subdoc with their display name + photo. */
export async function joinWorkspace(
  code: string,
  display: { displayName: string; photoURL?: string },
): Promise<JoinWorkspaceResult> {
  if (!firebaseEnabled()) return { ok: false, error: 'firebase-disabled' };
  const uid = await currentUidPromise();
  if (!uid) return { ok: false, error: 'signed-out' };
  const fb = getFirebase();
  if (!fb) return { ok: false, error: 'firebase-disabled' };

  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { ok: false, error: 'invalid-code' };

  try {
    const inviteSnap = await getDoc(
      doc(fb.db, 'workspaceInvites', trimmed),
    );
    if (!inviteSnap.exists()) return { ok: false, error: 'invalid-code' };
    const wsId = (inviteSnap.data() as { wsId?: string }).wsId;
    if (!wsId) return { ok: false, error: 'invalid-code' };

    const wsRef = doc(fb.db, 'workspaces', wsId);

    // BLIND ADD via arrayUnion — we deliberately do NOT read the workspace
    // doc first. The Firestore read rule on /workspaces/{wsId} requires
    // existing membership ("request.auth.uid in resource.data.memberUids"),
    // so a non-member's tx.get(wsRef) fails with permission-denied before
    // the join can even attempt the update. arrayUnion is a server-side
    // atomic op — the client doesn't need to know the current array — and
    // the update rule already permits "non-member adding exactly self with
    // size+1, ≤ maxMembers, only memberUids changed".
    //
    // Loss vs the previous transaction: we can no longer distinguish
    // workspace-missing / already-member / workspace-full from each other —
    // all three present as a generic permission-denied. The UI surfaces
    // them as the same "try again" error. A follow-up could denormalize
    // mode/title/memberCount into the public workspaceInvites doc so the
    // client can pre-check and give specific feedback before the write.
    // See #72 for the original report.
    try {
      await updateDoc(wsRef, { memberUids: arrayUnion(uid) });
    } catch (e: any) {
      if (e?.code === 'permission-denied') {
        return { ok: false, error: 'unknown' };
      }
      throw e;
    }

    // Best-effort: write the member subdoc. If it fails the user is in
    // memberUids but invisible until they retry — acceptable for v1.
    const member: WorkspaceMember = {
      uid,
      displayName: display.displayName,
      photoURL: display.photoURL,
      joinedAt: new Date().toISOString(),
      role: 'member',
    };
    try {
      await setDoc(doc(fb.db, 'workspaces', wsId, 'members', uid), member);
    } catch {
      /* swallow */
    }
    // Activity feed — best-effort, runs after the actual join succeeded
    // so a feed-write failure never blocks the join.
    await writeWorkspaceEvent(wsId, {
      type: 'member-joined',
      actorUid: uid,
      actorName: display.displayName,
    });
    return { ok: true, wsId };
  } catch {
    return { ok: false, error: 'unknown' };
  }
}

/* ── Read ────────────────────────────────────────────────────────────── */

/** Subscribe to every workspace the current user is a member of. Uses an
 *  `array-contains` query on `memberUids` so a single Firestore read
 *  covers all the user's pairs + groups. */
export function subscribeMyWorkspaces(
  cb: (workspaces: Workspace[]) => void,
): Unsubscribe {
  if (!firebaseEnabled()) return () => {};
  const fb = getFirebase();
  if (!fb) return () => {};

  let firestoreUnsub: Unsubscribe | null = null;
  const offAuth = fb.auth.onAuthStateChanged((user) => {
    if (firestoreUnsub) {
      firestoreUnsub();
      firestoreUnsub = null;
    }
    if (!user) {
      cb([]);
      return;
    }
    const q = query(
      collection(fb.db, 'workspaces'),
      where('memberUids', 'array-contains', user.uid),
    );
    firestoreUnsub = onSnapshot(
      q,
      (snap) => {
        const list: Workspace[] = [];
        snap.forEach((d) => list.push(d.data() as Workspace));
        cb(list);
      },
      () => cb([]),
    );
  });

  return () => {
    offAuth();
    if (firestoreUnsub) firestoreUnsub();
  };
}

/** Subscribe to a single workspace by id. */
export function subscribeWorkspace(
  wsId: string,
  cb: (ws: Workspace | null) => void,
): Unsubscribe {
  if (!firebaseEnabled() || !wsId) return () => {};
  const fb = getFirebase();
  if (!fb) return () => {};
  return onSnapshot(
    doc(fb.db, 'workspaces', wsId),
    (snap) => cb(snap.exists() ? (snap.data() as Workspace) : null),
    () => cb(null),
  );
}

/** Subscribe to a workspace's members subcollection. Each member writes
 *  their own doc; reads are gated on the caller being a member of the
 *  parent workspace (enforced in rules). */
export function subscribeWorkspaceMembers(
  wsId: string,
  cb: (members: WorkspaceMember[]) => void,
): Unsubscribe {
  if (!firebaseEnabled() || !wsId) return () => {};
  const fb = getFirebase();
  if (!fb) return () => {};
  return onSnapshot(
    collection(fb.db, 'workspaces', wsId, 'members'),
    (snap) => {
      const out: WorkspaceMember[] = [];
      snap.forEach((d) => out.push(d.data() as WorkspaceMember));
      out.sort((a, b) => (a.joinedAt < b.joinedAt ? -1 : 1));
      cb(out);
    },
    () => cb([]),
  );
}

/* ── Owner ops ───────────────────────────────────────────────────────── */

/** Rotates the invite code — old code stops working immediately. Owner only;
 *  rules will reject a non-owner attempt. */
export async function rotateInviteCode(
  wsId: string,
  oldCode: string,
): Promise<string | null> {
  if (!firebaseEnabled() || !wsId) return null;
  const fb = getFirebase();
  if (!fb) return null;
  const newCode = generateInviteCode();
  try {
    await setDoc(doc(fb.db, 'workspaceInvites', newCode), {
      inviteCode: newCode,
      wsId,
      createdAt: new Date().toISOString(),
    });
    await updateDoc(doc(fb.db, 'workspaces', wsId), { inviteCode: newCode });
    if (oldCode) {
      try {
        await deleteDoc(doc(fb.db, 'workspaceInvites', oldCode));
      } catch {
        /* swallow */
      }
    }
    return newCode;
  } catch {
    return null;
  }
}

/** Owner-only delete. Removes the parent workspace doc, every member
 *  subdoc, and the invite-lookup doc. Best-effort — a partial failure
 *  leaves orphans that the user can retry to clean. */
export async function deleteWorkspace(wsId: string): Promise<boolean> {
  if (!firebaseEnabled() || !wsId) return false;
  const fb = getFirebase();
  if (!fb) return false;
  try {
    const wsSnap = await getDoc(doc(fb.db, 'workspaces', wsId));
    if (!wsSnap.exists()) return true;
    const ws = wsSnap.data() as Workspace;

    // Cascade order matters. Rules on every subcollection (`members`,
    // `habits`, `logs/{uid}/days/*`) check the parent workspace doc to
    // confirm owner / membership. Once the parent doc is gone those
    // checks fail (`get()` returns null), so the subdocs become
    // orphaned forever. We MUST clean every subtree before deleting
    // the parent.

    // 1. Shared habit definitions.
    try {
      const habitsSnap = await getDocs(
        collection(fb.db, 'workspaces', wsId, 'habits'),
      );
      await Promise.all(habitsSnap.docs.map((d) => deleteDoc(d.ref)));
    } catch {
      /* swallow */
    }

    // 2. Per-member day-log subtrees. One day-doc per member per date,
    // nested under `logs/{uid}/days/{date}`. Owner-of-workspace can
    // delete other members' logs (rule expanded in this PR).
    try {
      for (const memberUid of ws.memberUids) {
        try {
          const daysSnap = await getDocs(
            collection(fb.db, 'workspaces', wsId, 'logs', memberUid, 'days'),
          );
          await Promise.all(daysSnap.docs.map((d) => deleteDoc(d.ref)));
        } catch {
          /* swallow — per-member cleanup is best-effort */
        }
      }
    } catch {
      /* swallow */
    }

    // 3. Member subdocs.
    try {
      const membersSnap = await getDocs(
        collection(fb.db, 'workspaces', wsId, 'members'),
      );
      await Promise.all(membersSnap.docs.map((m) => deleteDoc(m.ref)));
    } catch {
      /* swallow */
    }

    // 3b. Activity-feed events. Same cascade reasoning as the other
    // subcollections — orphaned events would be invisible (the read
    // rule needs the parent workspace's memberUids check) but they'd
    // sit in Firestore wasting storage. Owner can delete any event
    // doc per the rule.
    try {
      const eventsSnap = await getDocs(
        collection(fb.db, 'workspaces', wsId, 'events'),
      );
      await Promise.all(eventsSnap.docs.map((e) => deleteDoc(e.ref)));
    } catch {
      /* swallow */
    }

    // 4. Invite-code lookup doc.
    if (ws.inviteCode) {
      try {
        await deleteDoc(doc(fb.db, 'workspaceInvites', ws.inviteCode));
      } catch {
        /* swallow */
      }
    }

    // 5. Finally, the workspace doc itself.
    await deleteDoc(doc(fb.db, 'workspaces', wsId));
    return true;
  } catch {
    return false;
  }
}

/* ── Leave ───────────────────────────────────────────────────────────── */

/* ── Shared habits (phase 2a) ────────────────────────────────────────── */

export interface CreateWorkspaceHabitInput {
  name: string;
  type: HabitType;
  unit?: string;
  target?: number;
  limit?: number;
  frequency?: Frequency;
}

/** Owner-only: create a habit shared with every workspace member. The
 *  Firestore rule on `workspaces/{wsId}/habits/*` enforces the owner
 *  check server-side; this client function returns null when the rule
 *  rejects (so a member's optimistic UI doesn't appear to succeed). */
export async function createWorkspaceHabit(
  wsId: string,
  input: CreateWorkspaceHabitInput,
): Promise<WorkspaceHabit | null> {
  if (!firebaseEnabled() || !wsId) return null;
  const uid = await currentUidPromise();
  if (!uid) return null;
  const fb = getFirebase();
  if (!fb) return null;

  const habitId = `wsh_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const habit: WorkspaceHabit = {
    id: habitId,
    name: input.name.trim(),
    type: input.type,
    unit: input.unit?.trim() || undefined,
    target: input.target,
    limit: input.limit,
    frequency: input.frequency ?? 'daily',
    createdByUid: uid,
    createdAt: new Date().toISOString(),
  };
  try {
    await setDoc(
      doc(fb.db, 'workspaces', wsId, 'habits', habitId),
      habit,
    );
    // Activity feed entry — runs after the habit doc is committed so a
    // feed-write failure can't masquerade as a habit-create failure.
    const ownerName =
      fb.auth.currentUser?.displayName?.trim() ||
      fb.auth.currentUser?.email?.split('@')[0] ||
      'Owner';
    await writeWorkspaceEvent(wsId, {
      type: 'habit-added',
      actorUid: uid,
      actorName: ownerName,
      meta: { habitName: habit.name },
    });
    return habit;
  } catch {
    return null;
  }
}

/** Owner-only: patch a habit's editable fields. Pass undefined for a
 *  field to clear it (e.g. switching a good habit from target=10 to
 *  target=undefined for an open-ended one). */
export async function updateWorkspaceHabit(
  wsId: string,
  habitId: string,
  patch: Partial<Omit<WorkspaceHabit, 'id' | 'createdByUid' | 'createdAt'>>,
): Promise<boolean> {
  if (!firebaseEnabled() || !wsId || !habitId) return false;
  const fb = getFirebase();
  if (!fb) return false;
  try {
    await updateDoc(doc(fb.db, 'workspaces', wsId, 'habits', habitId), patch);
    return true;
  } catch {
    return false;
  }
}

/** Owner-only: remove a habit from the workspace. Per-member logs for
 *  that habit are NOT cleaned up here — they sit in each member's day
 *  doc as orphans and would be ignored by the UI (which only renders
 *  entries whose habit still exists). Cleanup-on-delete could land
 *  later if storage volume becomes a concern. */
export async function deleteWorkspaceHabit(
  wsId: string,
  habitId: string,
): Promise<boolean> {
  if (!firebaseEnabled() || !wsId || !habitId) return false;
  const fb = getFirebase();
  if (!fb) return false;
  try {
    await deleteDoc(doc(fb.db, 'workspaces', wsId, 'habits', habitId));
    return true;
  } catch {
    return false;
  }
}

/** Subscribe to the workspace's shared habit definitions. Sorted by
 *  creation time (oldest first) so the order stays stable across
 *  members. */
export function subscribeWorkspaceHabits(
  wsId: string,
  cb: (habits: WorkspaceHabit[]) => void,
): Unsubscribe {
  if (!firebaseEnabled() || !wsId) return () => {};
  const fb = getFirebase();
  if (!fb) return () => {};
  return onSnapshot(
    collection(fb.db, 'workspaces', wsId, 'habits'),
    (snap) => {
      const out: WorkspaceHabit[] = [];
      snap.forEach((d) => out.push(d.data() as WorkspaceHabit));
      out.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
      cb(out);
    },
    () => cb([]),
  );
}

/* ── Per-member daily logs (phase 2a scaffold) ───────────────────────── */

/** Write the current user's log for a given workspace habit on a given
 *  date. Used both for "tap to complete" (value defaults to target, or
 *  1 if no target) and "set numeric value" flows. Phase 2a only ships
 *  this helper for the upcoming UI; no rendering yet. */
export async function setMyWorkspaceLog(
  wsId: string,
  habitId: string,
  date: string,
  entry: { value: number; completed: boolean; status?: HabitLogStatus },
): Promise<boolean> {
  if (!firebaseEnabled() || !wsId || !habitId || !date) return false;
  const uid = await currentUidPromise();
  if (!uid) return false;
  const fb = getFirebase();
  if (!fb) return false;
  try {
    await setDoc(
      doc(fb.db, 'workspaces', wsId, 'logs', uid, 'days', date),
      { date, entries: { [habitId]: entry } },
      { merge: true },
    );
    return true;
  } catch {
    return false;
  }
}

/* ── Tri-state helpers for shared habits ─────────────────────────────── */

/** Derive the tri-state mark for a shared-habit entry. Absent `status`
 *  (older entries, binary toggles) falls back to completed-or-pending —
 *  an entry is never retroactively shown as 'failed'. */
export function workspaceEntryStatus(
  entry: { completed: boolean; status?: HabitLogStatus } | undefined,
): HabitLogStatus {
  return entry?.status ?? (entry?.completed ? 'completed' : 'pending');
}

/** Next entry in the shared-habit cycle: pending → completed → failed →
 *  pending. Returns a full {value, completed, status} so the Firestore
 *  merge-write always carries an explicit status (the deep-merge would
 *  otherwise let a stale status survive). Value follows the same
 *  good/bad/binary rules as the personal toggle. */
export function nextWorkspaceEntry(
  current: HabitLogStatus,
  habit: Pick<WorkspaceHabit, 'type' | 'target' | 'limit'>,
): { value: number; completed: boolean; status: HabitLogStatus } {
  if (current === 'pending') {
    // → completed
    let value: number;
    if (habit.type === 'good' && habit.target !== undefined) value = habit.target;
    else if (habit.type === 'bad') value = habit.limit ?? 0;
    else value = 1;
    return { value, completed: true, status: 'completed' };
  }
  if (current === 'completed') {
    // → failed (over-limit for bad habits, zero for good)
    const value = habit.type === 'bad' ? (habit.limit ?? 0) + 1 : 0;
    return { value, completed: false, status: 'failed' };
  }
  // failed → pending
  return { value: 0, completed: false, status: 'pending' };
}

/** Subscribe to the current user's own daily log for a workspace,
 *  for a specific date. Used by the Today checklist to render the
 *  user's own completion state for shared habits. */
export function subscribeMyWorkspaceLog(
  wsId: string,
  date: string,
  cb: (log: WorkspaceDayLog | null) => void,
): Unsubscribe {
  if (!firebaseEnabled() || !wsId || !date) return () => {};
  const fb = getFirebase();
  if (!fb) return () => {};
  let firestoreUnsub: Unsubscribe | null = null;
  const offAuth = fb.auth.onAuthStateChanged((user) => {
    if (firestoreUnsub) {
      firestoreUnsub();
      firestoreUnsub = null;
    }
    if (!user) {
      cb(null);
      return;
    }
    firestoreUnsub = onSnapshot(
      doc(fb.db, 'workspaces', wsId, 'logs', user.uid, 'days', date),
      (snap) =>
        cb(snap.exists() ? (snap.data() as WorkspaceDayLog) : null),
      () => cb(null),
    );
  });
  return () => {
    offAuth();
    if (firestoreUnsub) firestoreUnsub();
  };
}

/** Subscribe to any specific member's daily log for a workspace + date.
 *  Used by the cross-member visibility widget on the home checklist —
 *  one subscription per member per workspace. Firestore rules allow
 *  reads when the requesting user is in the workspace's memberUids;
 *  the same workspace `read` rule covers both `subscribeMyWorkspaceLog`
 *  and this generalised version. */
export function subscribeMemberWorkspaceLog(
  wsId: string,
  uid: string,
  date: string,
  cb: (log: WorkspaceDayLog | null) => void,
): Unsubscribe {
  if (!firebaseEnabled() || !wsId || !uid || !date) return () => {};
  const fb = getFirebase();
  if (!fb) return () => {};
  return onSnapshot(
    doc(fb.db, 'workspaces', wsId, 'logs', uid, 'days', date),
    (snap) =>
      cb(snap.exists() ? (snap.data() as WorkspaceDayLog) : null),
    () => cb(null),
  );
}

/* ── Membership ──────────────────────────────────────────────────────── */

/** Best-effort: delete every day-log doc the current user has written
 *  in this workspace. Firestore rules allow members to delete their own
 *  log docs (`workspaces/{wsId}/logs/{uid}/days/*`). Used by the leave
 *  flow's "wipe my history" path so a departing member can scrub their
 *  contributions from the shared record. Failures fall through silently
 *  — the leave operation itself doesn't depend on full cleanup
 *  succeeding. */
export async function wipeMyWorkspaceLogs(wsId: string): Promise<boolean> {
  if (!firebaseEnabled() || !wsId) return false;
  const uid = await currentUidPromise();
  if (!uid) return false;
  const fb = getFirebase();
  if (!fb) return false;
  try {
    const daysSnap = await getDocs(
      collection(fb.db, 'workspaces', wsId, 'logs', uid, 'days'),
    );
    await Promise.all(daysSnap.docs.map((d) => deleteDoc(d.ref)));
    return true;
  } catch {
    return false;
  }
}

/** Decision #8: when a member leaves, they pick whether their day-logs
 *  stay archived in the workspace for others to see ("archive") or get
 *  wiped from the shared record entirely ("wipe"). Owners can't use
 *  this path — they must delete the workspace or transfer ownership
 *  (transfer lands later). */
export async function leaveWorkspace(
  wsId: string,
  options: { wipeLogs?: boolean } = {},
): Promise<boolean> {
  if (!firebaseEnabled() || !wsId) return false;
  const uid = await currentUidPromise();
  if (!uid) return false;
  const fb = getFirebase();
  if (!fb) return false;

  // Capture display name BEFORE removing the member doc so the activity
  // event has something readable. Falls back to a generic label if Auth
  // hasn't populated displayName (anonymous accounts won't have one,
  // though those are blocked from workspaces upstream).
  const leaverName =
    fb.auth.currentUser?.displayName?.trim() ||
    fb.auth.currentUser?.email?.split('@')[0] ||
    'A member';

  // Wipe first if requested. Rules require workspace membership for the
  // delete, so this MUST happen before we remove ourselves from
  // memberUids — once we're no longer a member, the rule denies it.
  if (options.wipeLogs) {
    await wipeMyWorkspaceLogs(wsId);
  }

  const wsRef = doc(fb.db, 'workspaces', wsId);
  try {
    const result = await runTransaction(fb.db, async (tx) => {
      const snap = await tx.get(wsRef);
      if (!snap.exists()) return false;
      const data = snap.data() as Workspace;
      if (data.ownerUid === uid) {
        // Owner can't leave without first transferring ownership (out
        // of v1a scope) or deleting the workspace.
        return false;
      }
      if (!data.memberUids.includes(uid)) return true;
      tx.update(wsRef, {
        memberUids: data.memberUids.filter((m) => m !== uid),
      });
      return true;
    });
    if (!result) return false;
    // Activity feed — write the leave event BEFORE deleting the member
    // subdoc. The event-write rule allows actor === auth.uid; the user
    // is still authenticated, so this is permitted even though they're
    // no longer in memberUids.
    await writeWorkspaceEvent(wsId, {
      type: 'member-left',
      actorUid: uid,
      actorName: leaverName,
    });
    try {
      await deleteDoc(doc(fb.db, 'workspaces', wsId, 'members', uid));
    } catch {
      /* swallow */
    }
    return true;
  } catch {
    return false;
  }
}

/* ── Activity feed (events) ──────────────────────────────────────────── */

/** Append-only event log at `workspaces/{wsId}/events/{eventId}`. Used
 *  by the "Recent activity" panel on the workspace detail page so members
 *  see a small human-readable history (who joined, who left, what habits
 *  the owner added) without the heavy ceremony of a full audit trail.
 *
 *  Writes are best-effort. A failure shouldn't undo the underlying action
 *  (joining, leaving, adding a habit) — the activity feed is a nice-to-
 *  have, not a system of record. Each call swallows its own error. */
export async function writeWorkspaceEvent(
  wsId: string,
  input: {
    type: WorkspaceEventType;
    actorUid: string;
    actorName: string;
    meta?: WorkspaceEvent['meta'];
  },
): Promise<void> {
  if (!firebaseEnabled() || !wsId) return;
  const fb = getFirebase();
  if (!fb) return;
  const eventId = `evt_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const event: WorkspaceEvent = {
    id: eventId,
    type: input.type,
    actorUid: input.actorUid,
    actorName: input.actorName,
    at: new Date().toISOString(),
    ...(input.meta ? { meta: input.meta } : {}),
  };
  try {
    await setDoc(doc(fb.db, 'workspaces', wsId, 'events', eventId), event);
  } catch {
    /* swallow — feed is best-effort */
  }
}

/** Subscribe to the workspace's activity feed. Returns the newest-first
 *  list, capped to `limit` events (default 20). The cap is client-side
 *  for simplicity — the collection is small enough in practice that
 *  pulling everything and slicing is fine for v1. */
export function subscribeWorkspaceEvents(
  wsId: string,
  cb: (events: WorkspaceEvent[]) => void,
  limit = 20,
): Unsubscribe {
  if (!firebaseEnabled() || !wsId) return () => {};
  const fb = getFirebase();
  if (!fb) return () => {};
  return onSnapshot(
    collection(fb.db, 'workspaces', wsId, 'events'),
    (snap) => {
      const out: WorkspaceEvent[] = [];
      snap.forEach((d) => out.push(d.data() as WorkspaceEvent));
      // Newest first. ISO strings sort lexicographically in time order.
      out.sort((a, b) => (a.at < b.at ? 1 : -1));
      cb(out.slice(0, limit));
    },
    () => cb([]),
  );
}
