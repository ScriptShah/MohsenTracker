'use client';

import { useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { collection, deleteDoc, getDocs } from 'firebase/firestore';
import { firebaseEnabled, getFirebase } from './firebase';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | {
      status: 'signed-in';
      uid: string;
      email: string | null;
      displayName: string | null;
      isAnonymous: boolean;
    };

let cache: AuthState = { status: 'loading' };
const subs = new Set<(s: AuthState) => void>();
let started = false;

function start() {
  if (started || !firebaseEnabled()) {
    if (!firebaseEnabled() && cache.status === 'loading') {
      cache = { status: 'signed-out' };
    }
    return;
  }
  const fb = getFirebase();
  if (!fb) return;
  started = true;
  onAuthStateChanged(fb.auth, (user) => {
    cache = user
      ? {
          status: 'signed-in',
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          isAnonymous: user.isAnonymous,
        }
      : { status: 'signed-out' };
    subs.forEach((cb) => cb(cache));
  });
}

/** Subscribes to auth state. Re-renders when sign-in / sign-out happens. */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(cache);
  useEffect(() => {
    start();
    subs.add(setState);
    setState(cache);
    return () => {
      subs.delete(setState);
    };
  }, []);
  return state;
}

/** Synchronous read of the current user's uid, or null. */
export function currentUid(): string | null {
  return cache.status === 'signed-in' ? cache.uid : null;
}

/** Local-part of an email (before the `@`). Falls back to '' for null/empty. */
export function emailUsername(email: string | null | undefined): string {
  if (!email) return '';
  const at = email.indexOf('@');
  return at < 0 ? email : email.slice(0, at);
}

export type AuthResult = { ok: true } | { ok: false; error: string };

export async function signInWithGoogle(): Promise<AuthResult> {
  const fb = getFirebase();
  if (!fb) return { ok: false, error: 'firebase-disabled' };
  try {
    await signInWithPopup(fb.auth, new GoogleAuthProvider());
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.code ?? e?.message ?? 'unknown' };
  }
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  const fb = getFirebase();
  if (!fb) return { ok: false, error: 'firebase-disabled' };
  try {
    await signInWithEmailAndPassword(fb.auth, email, password);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.code ?? e?.message ?? 'unknown' };
  }
}

export async function createAccountWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  const fb = getFirebase();
  if (!fb) return { ok: false, error: 'firebase-disabled' };
  try {
    await createUserWithEmailAndPassword(fb.auth, email, password);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.code ?? e?.message ?? 'unknown' };
  }
}

export async function signInAsGuest(): Promise<AuthResult> {
  const fb = getFirebase();
  if (!fb) return { ok: false, error: 'firebase-disabled' };
  try {
    await signInAnonymously(fb.auth);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.code ?? e?.message ?? 'unknown' };
  }
}

export async function signOutUser(): Promise<void> {
  const fb = getFirebase();
  if (!fb) return;
  await fbSignOut(fb.auth);
}

/** Hard-delete the current user. Removes their Firestore tick history
 *  (best-effort) and then deletes the auth record. Firebase requires a
 *  recent sign-in for non-anonymous deletes — if too much time has
 *  passed, returns `requires-recent-login` and the caller should ask the
 *  user to sign in again, then retry. */
export async function deleteAccount(): Promise<AuthResult> {
  const fb = getFirebase();
  if (!fb) return { ok: false, error: 'firebase-disabled' };
  const user = fb.auth.currentUser;
  if (!user) return { ok: false, error: 'no-user' };
  try {
    // Best-effort wipe of the user's tick docs. Permission-denied or
    // missing collection both fall through silently.
    try {
      const ticksRef = collection(fb.db, 'habitTicks', user.uid, 'days');
      const ticks = await getDocs(ticksRef);
      await Promise.all(ticks.docs.map((d) => deleteDoc(d.ref)));
    } catch {
      /* swallow */
    }
    await deleteUser(user);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.code ?? e?.message ?? 'unknown' };
  }
}
