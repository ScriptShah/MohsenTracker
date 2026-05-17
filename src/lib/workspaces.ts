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
  Workspace,
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

/** Removes the current user from a workspace they're a member of. The
 *  archive-vs-wipe choice for log history (decision #8) lands in a
 *  later phase — for v1a this is a straight membership removal. */
export async function leaveWorkspace(wsId: string): Promise<boolean> {
  if (!firebaseEnabled() || !wsId) return false;
  const uid = await currentUidPromise();
  if (!uid) return false;
  const fb = getFirebase();
  if (!fb) return false;
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
