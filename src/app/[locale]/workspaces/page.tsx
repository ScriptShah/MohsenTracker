'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ChevronEnd } from '@/components/Chevron';
import { ClientGate } from '@/components/ClientGate';
import { useAuth } from '@/lib/auth';
import { useNumberFormatter } from '@/lib/format';
import { subscribeMyWorkspaces } from '@/lib/workspaces';
import type { Workspace } from '@/domain/types';

export default function WorkspacesListPage() {
  return (
    <ClientGate>
      <WorkspacesList />
    </ClientGate>
  );
}

function WorkspacesList() {
  const t = useTranslations();
  const auth = useAuth();
  const signedIn = auth.status === 'signed-in' && !auth.isAnonymous;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold">{t('workspaces.title')}</h1>
        <p className="text-sm text-ink-500">{t('workspaces.intro')}</p>
      </header>

      {signedIn ? (
        <SignedInView />
      ) : (
        <Card className="space-y-2 border-sand-200 bg-sand-50">
          <p className="text-sm font-semibold text-ink-800">
            {t('workspaces.signInRequiredTitle')}
          </p>
          <p className="text-sm leading-relaxed text-ink-700">
            {t('workspaces.signInRequiredBody')}
          </p>
        </Card>
      )}
    </div>
  );
}

function SignedInView() {
  const t = useTranslations();
  const fmt = useNumberFormatter();
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);

  useEffect(() => {
    const unsub = subscribeMyWorkspaces((list) => setWorkspaces(list));
    return unsub;
  }, []);

  if (workspaces === null) {
    return <p className="text-sm text-ink-500">{t('workspaces.detail.loading')}</p>;
  }

  if (workspaces.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {workspaces.map((ws) => (
          <li key={ws.id}>
            <WorkspaceRow ws={ws} fmt={fmt} />
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/workspaces/new"
          className="tap-44 inline-flex items-center gap-1 rounded-xl border-2 border-dashed border-ink-300 px-4 py-2 text-sm text-ink-600 hover:border-leaf-400 hover:text-leaf-700"
        >
          {t('workspaces.list.createCta')}
        </Link>
        <JoinShortForm />
      </div>
    </div>
  );
}

function WorkspaceRow({
  ws,
  fmt,
}: {
  ws: Workspace;
  fmt: (n: number) => string;
}) {
  const t = useTranslations();
  const memberCount = ws.memberUids.length;
  const memberLine =
    ws.mode === 'pair' && memberCount === 2
      ? t('workspaces.list.memberCountTwo')
      : memberCount === 1
      ? t('workspaces.list.memberCountOne')
      : t('workspaces.list.memberCount', { n: fmt(memberCount) });

  return (
    <Link
      href={`/workspaces/detail?id=${ws.id}`}
      className="tap-44 flex w-full items-center gap-3 rounded-xl border border-ink-200 bg-white px-3 py-3 text-start transition hover:border-leaf-400"
    >
      <span className="text-2xl" aria-hidden>
        {ws.icon || (ws.mode === 'pair' ? '🤝' : '🌿')}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-medium text-ink-900">
          {ws.title}
        </span>
        <span className="numeral block text-xs text-ink-500">
          {ws.mode === 'pair'
            ? t('workspaces.modePair')
            : t('workspaces.modeGroup')}{' '}
          · {memberLine}
        </span>
      </span>
      <ChevronEnd className="h-4 w-4 text-ink-300" />
    </Link>
  );
}

function EmptyState() {
  const t = useTranslations();
  return (
    <div className="space-y-4">
      <Card className="space-y-3 border-sand-200 bg-sand-50">
        <p className="text-sm font-semibold text-ink-800">
          {t('workspaces.empty.title')}
        </p>
        <p className="text-sm leading-relaxed text-ink-700">
          {t('workspaces.empty.body')}
        </p>
        <Link
          href="/workspaces/new"
          className="tap-44 inline-flex items-center gap-1 rounded-xl bg-leaf-600 px-4 py-2 text-sm font-medium text-white hover:bg-leaf-700"
        >
          {t('workspaces.empty.create')}
        </Link>
      </Card>

      <Card className="space-y-2">
        <p className="text-sm font-semibold text-ink-800">
          {t('workspaces.empty.joinTitle')}
        </p>
        <JoinShortForm placeholder={t('workspaces.empty.joinPlaceholder')} />
      </Card>
    </div>
  );
}

/** Inline "paste an invite code" mini-form. Submits → routes to
 *  /workspaces/join?code=… where the actual join transaction happens. */
function JoinShortForm({ placeholder }: { placeholder?: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [code, setCode] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    router.push(`/workspaces/join?code=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder={placeholder ?? t('workspaces.empty.joinPlaceholder')}
        maxLength={20}
        className="flex-1 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm uppercase tracking-wider outline-none focus:border-leaf-500"
      />
      <Button type="submit" disabled={!code.trim()}>
        {t('workspaces.empty.joinButton')}
      </Button>
    </form>
  );
}
