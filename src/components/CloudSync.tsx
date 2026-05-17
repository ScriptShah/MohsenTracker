'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { useAuth } from '@/lib/auth';
import { useAppStore } from '@/lib/store';
import { pullSnapshot, pushSnapshot } from '@/lib/sync';

const PUSH_DEBOUNCE_MS = 3000;
/** Per-session dismissal of the empty-cloud warning. Cleared on tab
 *  close; we want the warning to re-surface on each new sign-in if
 *  the underlying condition still holds. */
const EMPTY_WARNING_DISMISS_KEY = 'empty_cloud_warning_dismissed_at';

/** Mounts once in the locale layout. When the user signs in (non-anon),
 *  pulls their snapshot from Firestore. Then subscribes to store changes
 *  and pushes a debounced snapshot back. Anonymous guests stay local-only
 *  — their UID is throwaway, syncing it to the cloud is wasteful.
 *
 *  Also renders an "empty cloud" warning banner at the top of the
 *  viewport when a fresh sign-in finds no cloud data for the new uid
 *  — the smoking gun for "signed in with a different method on this
 *  device than on the device that has my real data." Same email,
 *  different sign-in method = different Firebase uid = different
 *  cloud snapshot. */
export function CloudSync() {
  const auth = useAuth();
  const t = useTranslations();
  const lastPulledUid = useRef<string | null>(null);
  const pulledRef = useRef(false);
  /** Set to the current uid when the most recent pull came back
   *  'empty' AND the local device shows the user just signed in
   *  fresh here. Used to render the warning banner. Cleared on
   *  sign-out or when the user dismisses. */
  const [emptyCloudForUid, setEmptyCloudForUid] = useState<string | null>(null);

  useEffect(() => {
    pulledRef.current = false;
    if (auth.status !== 'signed-in' || auth.isAnonymous) {
      lastPulledUid.current = null;
      setEmptyCloudForUid(null);
      return;
    }
    if (lastPulledUid.current === auth.uid) return;
    lastPulledUid.current = auth.uid;
    let cancelled = false;
    (async () => {
      const result = await pullSnapshot(auth.uid);
      if (cancelled) return;
      // Only allow pushes after we've definitively heard back from the
      // cloud (either 'found' or 'empty'). On 'error', leave pulledRef
      // false so the subscriber effect below won't push local mutations
      // up — we don't know what's in the cloud, and pushing blind would
      // overwrite the user's data on the other device with whatever
      // happens to be on this one.
      if (result === 'error') return;
      pulledRef.current = true;
      // Cloud doc exists and was applied — nothing else to do.
      if (result === 'found') {
        setEmptyCloudForUid(null);
        return;
      }
      // 'empty' — no cloud snapshot for this user yet. Two cases:
      //   1. The local data belongs to this same user (e.g. they used the
      //      app as a guest, or this is their first device): push it up
      //      so it becomes their cloud starting point.
      //   2. The local data is stamped with a DIFFERENT uid — a previous
      //      account on this shared device. Pushing it would contaminate
      //      the new user's cloud with someone else's habits. Wipe local
      //      first, then push an empty starting state.
      const localUid = useAppStore.getState().profile?.cloudSyncUid;
      if (localUid && localUid !== auth.uid) {
        useAppStore.getState().reset();
      }
      // Mark the empty-cloud condition for the banner. Only flag when
      // the user has actually used the app elsewhere — gated on
      // localUid presence — OR when local profile is empty (likely a
      // fresh sign-in on a new device where they EXPECT existing data
      // but didn't find any). If both local AND cloud are empty AND
      // the user has never signed in here before, this is a legitimate
      // first-run and the banner would be noise.
      const profile = useAppStore.getState().profile;
      const hasLocalData = Boolean(
        profile?.onboardingComplete || (profile && !!profile.name),
      );
      const dismissedAt = sessionStorage.getItem(EMPTY_WARNING_DISMISS_KEY);
      const dismissedForCurrentUid = dismissedAt === auth.uid;
      if ((localUid || hasLocalData) && !dismissedForCurrentUid) {
        setEmptyCloudForUid(auth.uid);
      }
      void pushSnapshot(auth.uid);
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

  const dismissBanner = () => {
    if (emptyCloudForUid) {
      sessionStorage.setItem(EMPTY_WARNING_DISMISS_KEY, emptyCloudForUid);
    }
    setEmptyCloudForUid(null);
  };

  if (!emptyCloudForUid) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-2 top-2 z-50 mx-auto max-w-screen-sm rounded-2xl border border-amber-300 bg-amber-50 p-3 shadow-[0_8px_24px_-8px_rgb(0_0_0/0.2)]"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-900"
        >
          !
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm font-semibold text-amber-900">
            {t('cloudSync.emptyWarning.title')}
          </p>
          <p className="text-xs leading-relaxed text-amber-900">
            {t('cloudSync.emptyWarning.body')}
          </p>
          <div className="flex items-center gap-3 pt-1">
            <Link
              href="/profile"
              className="text-xs font-medium text-amber-900 underline-offset-2 hover:underline"
              onClick={dismissBanner}
            >
              {t('cloudSync.emptyWarning.openDiagnostic')}
            </Link>
            <button
              type="button"
              onClick={dismissBanner}
              className="text-xs font-medium text-amber-700 underline-offset-2 hover:underline"
            >
              {t('cloudSync.emptyWarning.dismiss')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
