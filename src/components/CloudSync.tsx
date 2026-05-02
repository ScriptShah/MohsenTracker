'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useAppStore } from '@/lib/store';
import { pullSnapshot, pushSnapshot } from '@/lib/sync';

const PUSH_DEBOUNCE_MS = 3000;

/** Mounts once in the locale layout. When the user signs in (non-anon),
 *  pulls their snapshot from Firestore. Then subscribes to store changes
 *  and pushes a debounced snapshot back. Anonymous guests stay local-only
 *  — their UID is throwaway, syncing it to the cloud is wasteful. */
export function CloudSync() {
  const auth = useAuth();
  const lastPulledUid = useRef<string | null>(null);
  const pulledRef = useRef(false);

  useEffect(() => {
    pulledRef.current = false;
    if (auth.status !== 'signed-in' || auth.isAnonymous) {
      lastPulledUid.current = null;
      return;
    }
    if (lastPulledUid.current === auth.uid) return;
    lastPulledUid.current = auth.uid;
    let cancelled = false;
    (async () => {
      const restored = await pullSnapshot(auth.uid);
      if (cancelled) return;
      pulledRef.current = true;
      // First sign-in for this user — no cloud snapshot yet — so push the
      // current local state up so the next sign-in / device finds it.
      if (!restored) {
        void pushSnapshot(auth.uid);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth]);

  useEffect(() => {
    if (auth.status !== 'signed-in' || auth.isAnonymous) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = useAppStore.subscribe(() => {
      // Don't push until we've finished the initial pull, so a fast
      // mutation right after sign-in doesn't clobber the just-fetched
      // cloud snapshot before it lands.
      if (!pulledRef.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void pushSnapshot(auth.uid);
      }, PUSH_DEBOUNCE_MS);
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [auth]);

  return null;
}
