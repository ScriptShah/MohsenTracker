'use client';

import {
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
  HabitType,
  Workspace,
  WorkspaceDayLog,
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

/** Creates the workspace, the owner's member doc, and the invite-code
 *  lookup doc. Returns the workspace on success. Best-effort cleanup on
 *  partial failure: if any of the three writes fails, the others linger
 *  and the user retries (acceptable for a low-frequency operation).
 *
 *  Returns `null` when Firebase is disabled or the user is signed out. */
export async function createWorkspace(
  input: CreateWorkspaceInput,
): Promise<Workspace | null> {
  if (!firebaseEnabled()) return null;
  const uid = await currentUidPromise();
  if (!uid) return null;
  const fb = getFirebase();
  if (!fb) return null;

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

  try {
    await setDoc(doc(fb.db, 'workspaces', wsId), {
      ...workspace,
      createdAtServer: serverTimestamp(),
    });
    const member: WorkspaceMember = {
      uid,
      displayName: input.ownerDisplayName,
      photoURL: input.ownerPhotoURL,
      joinedAt: nowIso,
      role: 'owner',
    };
    await setDoc(doc(fb.db, 'workspaces', wsId, 'members', uid), member);
    await setDoc(doc(fb.db, 'workspaceInvites', inviteCode), {
      inviteCode,
      wsId,
      createdAt: nowIso,
    });
    return workspace;
  } catch {
    return null;
  }
}

/* ── Join ────────────────────────────────────────────────────────────── */

export type JoinWorkspaceResult =
  | { ok: true; wsId: string; mode: WorkspaceMode; title: string }
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
    const result = await runTransaction(fb.db, async (tx) => {
      const wsSnap = await tx.get(wsRef);
      if (!wsSnap.exists()) {
        return { ok: false as const, error: 'workspace-missing' as JoinError };
      }
      const data = wsSnap.data() as Workspace;
      if (data.memberUids.includes(uid)) {
        return { ok: false as const, error: 'already-member' as JoinError };
      }
      if (data.memberUids.length >= data.maxMembers) {
        return { ok: false as const, error: 'workspace-full' as JoinError };
      }
      tx.update(wsRef, { memberUids: [...data.memberUids, uid] });
      return {
        ok: true as const,
        wsId,
        mode: data.mode,
        title: data.title,
      };
    });
    if (!result.ok) return result;

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
    return result;
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
    try {
      const membersSnap = await getDocs(
        collection(fb.db, 'workspaces', wsId, 'members'),
      );
      await Promise.all(membersSnap.docs.map((m) => deleteDoc(m.ref)));
    } catch {
      /* swallow */
    }
    if (ws.inviteCode) {
      try {
        await deleteDoc(doc(fb.db, 'workspaceInvites', ws.inviteCode));
      } catch {
        /* swallow */
      }
    }
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
  entry: { value: number; completed: boolean },
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
