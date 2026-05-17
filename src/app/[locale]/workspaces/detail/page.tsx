'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ArrowBack } from '@/components/Chevron';
import { ClientGate } from '@/components/ClientGate';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/lib/auth';
import { useNumberFormatter } from '@/lib/format';
import {
  deleteWorkspace,
  leaveWorkspace,
  rotateInviteCode,
  subscribeWorkspace,
  subscribeWorkspaceMembers,
} from '@/lib/workspaces';
import type { Workspace, WorkspaceMember } from '@/domain/types';

export default function WorkspaceDetailPage() {
  return (
    <ClientGate>
      <Suspense>
        <WorkspaceDetail />
      </Suspense>
    </ClientGate>
  );
}

function WorkspaceDetail() {
  const t = useTranslations();
  const fmt = useNumberFormatter();
  const router = useRouter();
  const locale = useLocale();
  const auth = useAuth();
  const wsId = (useSearchParams().get('id') ?? '').trim();

  const [workspace, setWorkspace] = useState<Workspace | null | undefined>(
    undefined,
  );
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [busy, setBusy] = useState<'leave' | 'delete' | 'rotate' | null>(null);
  const [copied, setCopied] = useState(false);

  // Subscribe to the workspace doc.
  useEffect(() => {
    if (!wsId) return;
    const unsub = subscribeWorkspace(wsId, (ws) => setWorkspace(ws));
    return unsub;
  }, [wsId]);

  // Subscribe to the members subcollection.
  useEffect(() => {
    if (!wsId) return;
    const unsub = subscribeWorkspaceMembers(wsId, (list) => setMembers(list));
    return unsub;
  }, [wsId]);

  const currentUid = auth.status === 'signed-in' ? auth.uid : null;
  const isOwner = !!workspace && !!currentUid && workspace.ownerUid === currentUid;
  const isMember =
    !!workspace && !!currentUid && workspace.memberUids.includes(currentUid);

  // Build the invite link from current origin + locale + code.
  const inviteUrl = useMemo(() => {
    if (!workspace) return '';
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/${locale}/workspaces/join?code=${workspace.inviteCode}`;
  }, [workspace, locale]);

  const copyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — silent */
    }
  };

  const onRotate = async () => {
    if (!workspace) return;
    if (!confirm(t('workspaces.detail.invite.rotateConfirm'))) return;
    setBusy('rotate');
    await rotateInviteCode(workspace.id, workspace.inviteCode);
    setBusy(null);
  };

  const onLeave = async () => {
    if (!workspace) return;
    if (isOwner) {
      alert(t('workspaces.detail.leave.ownerCant'));
      return;
    }
    if (!confirm(t('workspaces.detail.leave.confirm'))) return;
    setBusy('leave');
    const ok = await leaveWorkspace(workspace.id);
    setBusy(null);
    if (ok) router.replace('/workspaces');
  };

  const onDelete = async () => {
    if (!workspace) return;
    if (!confirm(t('workspaces.detail.delete.confirm'))) return;
    setBusy('delete');
    const ok = await deleteWorkspace(workspace.id);
    setBusy(null);
    if (ok) router.replace('/workspaces');
  };

  // Initial undefined = still loading. Null = subscription returned nothing.
  if (workspace === undefined) {
    return (
      <div className="space-y-3">
        <BackLink />
        <p className="text-sm text-ink-500">{t('workspaces.detail.loading')}</p>
      </div>
    );
  }

  if (!workspace || !isMember) {
    return (
      <div className="space-y-3">
        <BackLink />
        <Card className="space-y-2 border-sand-200 bg-sand-50">
          <p className="text-sm font-semibold text-ink-800">
            {t('workspaces.detail.notFoundTitle')}
          </p>
          <p className="text-sm text-ink-700">
            {t('workspaces.detail.notFoundBody')}
          </p>
        </Card>
      </div>
    );
  }

  const memberCount = workspace.memberUids.length;
  const modeLabel =
    workspace.mode === 'pair'
      ? t('workspaces.detail.modePairLabel')
      : t('workspaces.detail.modeGroupLabel');

  return (
    <div className="space-y-5">
      <BackLink />

      <header className="flex items-start gap-3">
        <span className="text-4xl" aria-hidden>
          {workspace.icon || (workspace.mode === 'pair' ? '🤝' : '🌿')}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold leading-tight text-ink-900">
            {workspace.title}
          </h1>
          <p className="numeral text-xs text-ink-500">
            {modeLabel} ·{' '}
            {t('workspaces.detail.membersCount', {
              n: fmt(memberCount),
              max: fmt(workspace.maxMembers),
            })}
          </p>
        </div>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-800">
          {t('workspaces.detail.members')}
        </h2>
        <ul className="space-y-2">
          {members.map((m) => (
            <li
              key={m.uid}
              className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white px-3 py-2"
            >
              <Avatar name={m.displayName} photoURL={m.photoURL} size="md" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink-900">
                  {m.displayName}
                </div>
                <div className="flex items-center gap-1.5">
                  {m.role === 'owner' && (
                    <span className="rounded-full bg-leaf-100 px-2 py-0.5 text-[10px] font-medium text-leaf-700">
                      {t('workspaces.detail.ownerBadge')}
                    </span>
                  )}
                  {currentUid === m.uid && (
                    <span className="rounded-full bg-sand-100 px-2 py-0.5 text-[10px] font-medium text-sand-700">
                      {t('workspaces.detail.youBadge')}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
          {/* Members in memberUids but no subdoc yet (rare race during join). */}
          {workspace.memberUids
            .filter((uid) => !members.some((m) => m.uid === uid))
            .map((uid) => (
              <li
                key={uid}
                className="flex items-center gap-3 rounded-xl border border-dashed border-ink-200 bg-white px-3 py-2 opacity-60"
              >
                <Avatar name="·" size="md" />
                <span className="text-xs text-ink-500">{uid.slice(0, 8)}…</span>
              </li>
            ))}
        </ul>
      </section>

      <Card className="space-y-2 border-leaf-200 bg-leaf-50">
        <p className="text-xs uppercase tracking-wide text-leaf-700">
          {t('workspaces.detail.invite.title')}
        </p>
        <p className="text-xs text-ink-600">
          {t('workspaces.detail.invite.body', {
            max: fmt(workspace.maxMembers),
          })}
        </p>
        <div className="space-y-1.5">
          <label className="block text-xs text-ink-500">
            {t('workspaces.detail.invite.codeLabel')}
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-white px-3 py-2 text-base font-semibold tracking-[0.2em] text-ink-900">
              {workspace.inviteCode}
            </code>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="button" onClick={copyInvite}>
            {copied
              ? t('workspaces.detail.invite.copied')
              : t('workspaces.detail.invite.copyLink')}
          </Button>
          {isOwner && (
            <Button
              type="button"
              variant="ghost"
              onClick={onRotate}
              disabled={busy === 'rotate'}
            >
              {t('workspaces.detail.invite.rotate')}
            </Button>
          )}
        </div>
      </Card>

      {!isOwner && (
        <Card className="space-y-2">
          <p className="text-sm font-semibold text-ink-800">
            {t('workspaces.detail.leave.title')}
          </p>
          <p className="text-xs text-ink-600">
            {t('workspaces.detail.leave.body')}
          </p>
          <Button
            type="button"
            variant="ghost"
            onClick={onLeave}
            disabled={busy === 'leave'}
            className="text-red-600 hover:bg-red-50"
          >
            {t('workspaces.detail.leave.button')}
          </Button>
        </Card>
      )}

      {isOwner && (
        <Card className="space-y-2 border-red-200">
          <p className="text-sm font-semibold text-red-700">
            {t('workspaces.detail.delete.title')}
          </p>
          <p className="text-xs text-ink-600">
            {t('workspaces.detail.delete.body')}
          </p>
          <Button
            type="button"
            variant="ghost"
            onClick={onDelete}
            disabled={busy === 'delete'}
            className="text-red-600 hover:bg-red-50"
          >
            {t('workspaces.detail.delete.button')}
          </Button>
        </Card>
      )}
    </div>
  );
}

function BackLink() {
  const t = useTranslations();
  return (
    <Link
      href="/workspaces"
      className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"
    >
      <ArrowBack /> {t('workspaces.detail.back')}
    </Link>
  );
}
