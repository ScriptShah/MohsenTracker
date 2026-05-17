'use client';

import { useEffect, useState } from 'react';
import {
  subscribeMyWorkspaceLog,
  subscribeMyWorkspaces,
  subscribeWorkspaceHabits,
} from './workspaces';
import { todayKey } from './dates';
import type {
  Workspace,
  WorkspaceDayLog,
  WorkspaceHabit,
} from '@/domain/types';

/** Aggregate "today's habits" progress across every workspace the user
 *  is in. Used on the home page so the completion ring + caption
 *  reflect personal + shared habits together rather than personal-only.
 *
 *  Returns `{ total, done }` where total is the sum of shared habit
 *  definitions across all the user's workspaces, and done is the
 *  count of THE USER's own completions for those habits today. Other
 *  members' completions don't roll into this — fire/streak/ring stay
 *  individual per decision #3.
 *
 *  All three subscriptions live inside one hook (workspaces +
 *  per-workspace habits + per-workspace today log). That fans out to
 *  1 + N + N listeners where N = workspace count. For most users that's
 *  3-5 listeners; the Firestore SDK dedupes identical doc reads across
 *  hooks so this is cheap to call from multiple places (the home page
 *  + the WorkspacesHomeSection component, for example).
 *
 *  Returns `{ total: 0, done: 0 }` until the first subscription lands —
 *  the home page treats that as "still personal-only" and the ring
 *  doesn't flicker on initial mount.
 */
export function useWorkspacesTodayProgress(): {
  total: number;
  done: number;
} {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [habitsByWs, setHabitsByWs] = useState<
    Record<string, WorkspaceHabit[]>
  >({});
  const [logsByWs, setLogsByWs] = useState<
    Record<string, WorkspaceDayLog | null>
  >({});

  // Top-level list of workspaces the user belongs to.
  useEffect(() => {
    const unsub = subscribeMyWorkspaces((list) => setWorkspaces(list));
    return unsub;
  }, []);

  // For each workspace, subscribe to its habit definitions.
  const wsIdsKey = workspaces
    .map((w) => w.id)
    .sort()
    .join(',');
  useEffect(() => {
    const unsubs = workspaces.map((w) =>
      subscribeWorkspaceHabits(w.id, (list) =>
        setHabitsByWs((prev) => ({ ...prev, [w.id]: list })),
      ),
    );
    return () => {
      unsubs.forEach((u) => u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsIdsKey]);

  // For each workspace, subscribe to MY day log for today.
  const today = todayKey();
  useEffect(() => {
    const unsubs = workspaces.map((w) =>
      subscribeMyWorkspaceLog(w.id, today, (log) =>
        setLogsByWs((prev) => ({ ...prev, [w.id]: log })),
      ),
    );
    return () => {
      unsubs.forEach((u) => u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsIdsKey, today]);

  // Aggregate. Skip workspaces whose habit-list subscription hasn't
  // resolved yet to avoid undercounting the total mid-load.
  let total = 0;
  let done = 0;
  for (const ws of workspaces) {
    const habits = habitsByWs[ws.id];
    if (habits === undefined) continue;
    total += habits.length;
    const log = logsByWs[ws.id];
    if (!log) continue;
    for (const h of habits) {
      if (log.entries[h.id]?.completed === true) done += 1;
    }
  }
  return { total, done };
}
