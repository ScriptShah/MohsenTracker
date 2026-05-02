'use client';

import { initializeApp, type FirebaseApp, getApps, getApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

/** Reads NEXT_PUBLIC_FIREBASE_* env vars. Returns null when any required
 *  field is missing — callers gracefully disable Firebase-backed features. */
function readConfig() {
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  if (!cfg.apiKey || !cfg.projectId || !cfg.appId) return null;
  return cfg as Required<typeof cfg>;
}

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _auth: Auth | null = null;

export function getFirebase(): { app: FirebaseApp; db: Firestore; auth: Auth } | null {
  if (_app && _db && _auth) return { app: _app, db: _db, auth: _auth };
  const cfg = readConfig();
  if (!cfg) return null;
  _app = getApps().length ? getApp() : initializeApp(cfg);
  _db = getFirestore(_app);
  _auth = getAuth(_app);
  return { app: _app, db: _db, auth: _auth };
}

/** True when env vars are present and Firebase will work. */
export function firebaseEnabled(): boolean {
  return readConfig() !== null;
}
