'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from './Card';
import { Button } from './Button';
import { useAuth } from '@/lib/auth';
import { useAppStore } from '@/lib/store';
import {
  manualPull,
  manualPush,
  peekCloudSnapshot,
  type CloudSnapshotInfo,
  type PullResult,
} from '@/lib/sync';

/** Manual cloud-sync controls for the "same email, different data on
 *  two devices" recovery case. Surfaces the data the user needs to
 *  diagnose the mismatch themselves:
 *
 *  - Their current uid (so they can compare across devices — same
 *    Google account = same uid; different sign-in methods = different
 *    uids even with the same email).
 *  - Their local `cloudSyncUid` stamp (the uid that last wrote to the
 *    cloud from this device).
 *  - A peek at the cloud snapshot: when it was last written, how many
 *    habits / books / log-days it contains. If the cloud has more
 *    data than the device, the user knows to Pull; if the device has
 *    more, they know to Push.
 *
 *  Plus two manual action buttons:
 *  - **Pull from cloud** — replaces this device's data with the cloud
 *    version (confirmation first; this is destructive to local-only
 *    changes).
 *  - **Push to cloud** — overwrites the cloud version with this
 *    device's data (confirmation first; this is destructive to data
 *    on the other device that wasn't synced here).
 *
 *  Gated to firebase-enabled + signed in non-anonymously by the
 *  parent wrapper. */
export function CloudSyncControls() {
  const t = useTranslations();
  const auth = useAuth();
  const localCloudSyncUid = useAppStore(
    (s) => s.profile?.cloudSyncUid,
  );
  const localHabitsCount = useAppStore((s) => s.habits.length);
  const localBooksCount = useAppStore((s) => s.books.length);
  const localLogDaysCount = useAppStore(
    (s) => Object.keys(s.logs).length,
  );

  const [info, setInfo] = useState<CloudSnapshotInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState<{
    kind: 'pull' | 'push';
    state: 'ok' | 'error';
    code?: string;
    pullResult?: PullResult;
  } | null>(null);

  const uid = auth.status === 'signed-in' ? auth.uid : null;

  const refresh = async () => {
    if (!uid) return;
    setLoading(true);
    setInfo(await peekCloudSnapshot(uid));
    setLoading(false);
  };

  // Auto-load on mount + when uid changes. No live subscription — we
  // want a point-in-time peek, not a stream that updates as the user
  // mutates (which would be noisy during typing in the Profile editor).
  useEffect(() => {
    if (uid) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  if (!uid) return null;

  const onPull = async () => {
    if (!confirm(t('settings.cloudSync.pullConfirm'))) return;
    setActionStatus(null);
    setLoading(true);
    const result = await manualPull(uid);
    setLoading(false);
    setActionStatus({
      kind: 'pull',
      state: result === 'found' ? 'ok' : 'error',
      pullResult: result,
    });
    // After a successful pull, the local state was overwritten — also
    // refresh the cloud peek so the counts displayed match what was
    // just applied.
    if (result === 'found') void refresh();
  };

  const onPush = async () => {
    if (!confirm(t('settings.cloudSync.pushConfirm'))) return;
    setActionStatus(null);
    setLoading(true);
    const result = await manualPush(uid);
    setLoading(false);
    if (result.ok) {
      setActionStatus({ kind: 'push', state: 'ok' });
      void refresh();
    } else {
      setActionStatus({
        kind: 'push',
        state: 'error',
        code: result.code,
      });
    }
  };

  const uidMismatch =
    localCloudSyncUid && localCloudSyncUid !== uid;

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-ink-800">
          {t('settings.cloudSync.title')}
        </h2>
        <p className="pt-1 text-xs text-ink-500">
          {t('settings.cloudSync.body')}
        </p>
      </div>

      <DiagBlock
        label={t('settings.cloudSync.signedInAs')}
        value={uid}
        mono
      />

      {localCloudSyncUid && (
        <DiagBlock
          label={t('settings.cloudSync.localStamp')}
          value={localCloudSyncUid}
          mono
          warn={Boolean(uidMismatch)}
        />
      )}

      {uidMismatch && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-xs leading-relaxed text-amber-900">
            {t('settings.cloudSync.uidMismatchHint')}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-ink-200 bg-white p-3">
        <DeviceVsCloud
          label={t('settings.cloudSync.onThisDevice')}
          habits={localHabitsCount}
          books={localBooksCount}
          logDays={localLogDaysCount}
        />
        <DeviceVsCloud
          label={t('settings.cloudSync.onTheCloud')}
          habits={info?.counts.habits ?? 0}
          books={info?.counts.books ?? 0}
          logDays={info?.counts.logDays ?? 0}
          loading={loading || info === null}
          missing={info ? !info.exists : false}
          updatedAt={info?.updatedAt ?? null}
        />
      </div>

      {info?.errorCode && (
        <p className="break-all rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {t('settings.cloudSync.peekError', { code: info.errorCode })}
        </p>
      )}

      {actionStatus && (
        <p
          className={`rounded-xl px-3 py-2 text-xs ${
            actionStatus.state === 'ok'
              ? 'border border-leaf-200 bg-leaf-50 text-leaf-700'
              : 'border border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {actionStatus.kind === 'pull' && actionStatus.state === 'ok'
            ? t('settings.cloudSync.pullOk')
            : actionStatus.kind === 'pull'
            ? t('settings.cloudSync.pullFail', {
                result: actionStatus.pullResult ?? 'error',
              })
            : actionStatus.state === 'ok'
            ? t('settings.cloudSync.pushOk')
            : t('settings.cloudSync.pushFail', {
                code: actionStatus.code ?? 'unknown',
              })}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={refresh}
          disabled={loading}
        >
          {t('settings.cloudSync.refresh')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onPull}
          disabled={loading || !info?.exists}
        >
          {t('settings.cloudSync.pull')}
        </Button>
        <Button type="button" onClick={onPush} disabled={loading}>
          {t('settings.cloudSync.push')}
        </Button>
      </div>
    </Card>
  );
}

function DiagBlock({
  label,
  value,
  mono,
  warn,
}: {
  label: string;
  value: string;
  mono?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-ink-500">
        {label}
      </p>
      <p
        className={`pt-0.5 break-all text-xs ${
          mono ? 'font-mono' : ''
        } ${warn ? 'text-amber-800' : 'text-ink-800'}`}
      >
        {value}
      </p>
    </div>
  );
}

function DeviceVsCloud({
  label,
  habits,
  books,
  logDays,
  loading,
  missing,
  updatedAt,
}: {
  label: string;
  habits: number;
  books: number;
  logDays: number;
  loading?: boolean;
  missing?: boolean;
  updatedAt?: Date | null;
}) {
  const t = useTranslations();
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-ink-500">
        {label}
      </p>
      {loading ? (
        <p className="pt-1 text-xs text-ink-400">…</p>
      ) : missing ? (
        <p className="pt-1 text-xs text-ink-400">
          {t('settings.cloudSync.cloudEmpty')}
        </p>
      ) : (
        <ul className="numeral space-y-0.5 pt-1 text-xs text-ink-700">
          <li>{t('settings.cloudSync.countHabits', { n: habits })}</li>
          <li>{t('settings.cloudSync.countBooks', { n: books })}</li>
          <li>{t('settings.cloudSync.countLogDays', { n: logDays })}</li>
          {updatedAt && (
            <li className="pt-0.5 text-[11px] text-ink-500">
              {t('settings.cloudSync.cloudUpdatedAt', {
                when: updatedAt.toLocaleString(),
              })}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
