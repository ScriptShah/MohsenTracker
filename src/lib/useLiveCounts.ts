'use client';

import { useEffect, useState } from 'react';
import { subscribeTodayCounts } from './livecounts';

let cache: Record<string, number> = {};
let listenerCount = 0;
let unsub: (() => void) | null = null;
const subs = new Set<(c: Record<string, number>) => void>();

function start() {
  if (unsub) return;
  unsub = subscribeTodayCounts((c) => {
    cache = c;
    subs.forEach((fn) => fn(c));
  });
}
function stop() {
  if (unsub) {
    unsub();
    unsub = null;
  }
}

/** Shared subscription to today's public habit-completion counts. Returns
 *  a `{[presetKey]: count}` map. Empty {} when Firebase is disabled. */
export function useLiveCounts(): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>(cache);

  useEffect(() => {
    listenerCount += 1;
    subs.add(setCounts);
    if (listenerCount === 1) start();
    setCounts(cache);
    return () => {
      subs.delete(setCounts);
      listenerCount -= 1;
      if (listenerCount === 0) stop();
    };
  }, []);

  return counts;
}
