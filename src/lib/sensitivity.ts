import { differenceInHours, parseISO } from 'date-fns';
import type { DopamineReset } from '@/domain/types';

export type MuteReason =
  | 'activeReset'
  | 'recentRelapse'
  | 'lowMood';

export interface MuteVerdict {
  muted: boolean;
  reason?: MuteReason;
}

const RELAPSE_HOURS = 24;
const MOOD_LOOKBACK_HOURS = 72;
const LOW_MOOD_THRESHOLD = 2;

/**
 * Spec §21.9: never trigger consequence messaging when the user is in a
 * vulnerable state. We mute when:
 *   - any dopamine reset is active (the user is already mid-effort),
 *   - they relapsed in the last 24 hours, or
 *   - their most recent reset check-in within the last 72 hours scored
 *     mood ≤ 2 (struggling).
 *
 * The user's profile-level sensitivity setting still composes on top —
 * 'off' always wins, and these mutes override 'mild' / 'honest' / 'full'.
 */
export function shouldMuteConsequences(resets: DopamineReset[], now: Date = new Date()): MuteVerdict {
  for (const r of resets) {
    if (r.status === 'active') return { muted: true, reason: 'activeReset' };
  }

  for (const r of resets) {
    const last = r.relapses[r.relapses.length - 1];
    if (last && differenceInHours(now, parseISO(last.at)) <= RELAPSE_HOURS) {
      return { muted: true, reason: 'recentRelapse' };
    }
  }

  for (const r of resets) {
    for (const date of Object.keys(r.checkIns)) {
      const ci = r.checkIns[date];
      if (!ci) continue;
      const hours = differenceInHours(now, parseISO(ci.loggedAt));
      if (hours >= 0 && hours <= MOOD_LOOKBACK_HOURS && ci.mood <= LOW_MOOD_THRESHOLD) {
        return { muted: true, reason: 'lowMood' };
      }
    }
  }

  return { muted: false };
}
