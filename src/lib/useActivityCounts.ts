'use client';

import { useEffect, useState } from 'react';
import {
  subscribeAutophagyCounts,
  subscribeResetCounts,
} from './activityCounts';

/** Shared-singleton subscription pattern, mirroring `useLiveCounts` for
 *  habits. One Firestore listener per activity type per page-load no matter
 *  how many components call the hook. */

/* ── Autophagy ───────────────────────────────────────────────────────── */

type AutophagyCounts = { started?: number; completed?: number };
let autophagyCache: AutophagyCounts = {};
let autophagyListenerCount = 0;
let autophagyUnsub: (() => void) | null = null;
const autophagySubs = new Set<(c: AutophagyCounts) => void>();

function startAutophagy() {
  if (autophagyUnsub) return;
  autophagyUnsub = subscribeAutophagyCounts((c) => {
    autophagyCache = c;
    autophagySubs.forEach((fn) => fn(c));
  });
}
function stopAutophagy() {
  if (autophagyUnsub) {
    autophagyUnsub();
    autophagyUnsub = null;
  }
}

/** Today's public autophagy counters: how many people started a fast and
 *  how many completed one, today. Empty {} when Firebase is disabled or
 *  the user is signed out. */
export function useAutophagyLiveCounts(): AutophagyCounts {
  const [counts, setCounts] = useState<AutophagyCounts>(autophagyCache);
  useEffect(() => {
    autophagyListenerCount += 1;
    autophagySubs.add(setCounts);
    if (autophagyListenerCount === 1) startAutophagy();
    setCounts(autophagyCache);
    return () => {
      autophagySubs.delete(setCounts);
      autophagyListenerCount -= 1;
      if (autophagyListenerCount === 0) stopAutophagy();
    };
  }, []);
  return counts;
}

/* ── Reset ───────────────────────────────────────────────────────────── */

type ResetCounts = { started?: number };
let resetCache: ResetCounts = {};
let resetListenerCount = 0;
let resetUnsub: (() => void) | null = null;
const resetSubs = new Set<(c: ResetCounts) => void>();

function startReset() {
  if (resetUnsub) return;
  resetUnsub = subscribeResetCounts((c) => {
    resetCache = c;
    resetSubs.forEach((fn) => fn(c));
  });
}
function stopReset() {
  if (resetUnsub) {
    resetUnsub();
    resetUnsub = null;
  }
}

/** Today's public reset counters: how many people started a new dopamine
 *  reset today. */
export function useResetLiveCounts(): ResetCounts {
  const [counts, setCounts] = useState<ResetCounts>(resetCache);
  useEffect(() => {
    resetListenerCount += 1;
    resetSubs.add(setCounts);
    if (resetListenerCount === 1) startReset();
    setCounts(resetCache);
    return () => {
      resetSubs.delete(setCounts);
      resetListenerCount -= 1;
      if (resetListenerCount === 0) stopReset();
    };
  }, []);
  return counts;
}
