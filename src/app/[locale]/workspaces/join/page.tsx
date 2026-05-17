'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ClientGate } from '@/components/ClientGate';
import { useAuth, emailUsername } from '@/lib/auth';
import {
  joinWorkspace,
  workspaceCap,
  type JoinError,
} from '@/lib/workspaces';
import type { JoinWorkspaceResult } from '@/lib/workspaces';

/** /workspaces/join?code=ABCD1234
 *
 *  Two flows:
 *  1. Code in URL → auto-attempt join the moment auth is ready. Shows
 *     success/error inline. The most common path (tapping a shared link).
 *  2. No code in URL → manual code-entry form. Used when someone gets a
 *     code verbally or copy-pastes from another channel.
 */
export default function JoinWorkspacePage() {
  return (
    <ClientGate>
      <Suspense>
        <JoinWorkspace />
      </Suspense>
    </ClientGate>
  );
}

function JoinWorkspace() {
  const t = useTranslations();
  const router = useRouter();
  const auth = useAuth();
  const urlCode = (useSearchParams().get('code') ?? '').trim().toUpperCase();

  const signedIn = auth.status === 'signed-in' && !auth.isAnonymous;
  const displayName =
    auth.status === 'signed-in'
      ? auth.displayName ?? emailUsername(auth.email) ?? 'You'
      : 'You';
  const photoURL =
    auth.status === 'signed-in' && (auth as any).photoURL
      ? ((auth as any).photoURL as string)
      : undefined;

  // Hand-entered code when the URL didn't include one.
  const [manualCode, setManualCode] = useState('');
  const [attempting, setAttempting] = useState(false);
  const [result, setResult] = useState<JoinWorkspaceResult | null>(null);
  const [autoTried, setAutoTried] = useState(false);

  const codeToTry = (urlCode || manualCode.trim().toUpperCase()).slice(0, 32);

  // Auto-attempt when the URL provided a code and we're signed in.
  useEffect(() => {
    if (!urlCode || !signedIn || autoTried || attempting) return;
    setAutoTried(true);
    void runJoin(urlCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCode, signedIn]);

  const runJoin = async (code: string) => {
    if (!code) return;
    setAttempting(true);
    const r = await joinWorkspace(code, { displayName, photoURL });
    setAttempting(false);
    setResult(r);
    if (r.ok) {
      // Brief pause so the user sees the success state, then route.
      window.setTimeout(() => {
        router.replace(`/workspaces/detail?id=${r.wsId}`);
      }, 700);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeToTry || attempting || !signedIn) return;
    void runJoin(codeToTry);
  };

  if (!signedIn) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">{t('workspaces.join.title')}</h1>
        <Card className="space-y-2 border-sand-200 bg-sand-50">
          <p className="text-sm font-semibold text-ink-800">
            {t('workspaces.signInRequiredTitle')}
          </p>
          <p className="text-sm leading-relaxed text-ink-700">
            {t('workspaces.signInRequiredBody')}
          </p>
        </Card>
      </div>
    );
  }

  if (result?.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">{t('workspaces.join.title')}</h1>
        <Card className="space-y-2 border-leaf-300 bg-leaf-50">
          <p className="text-sm font-semibold text-leaf-800">
            {t('workspaces.join.successTitle')}
          </p>
          <p className="text-sm text-ink-700">
            {t('workspaces.join.successBody')}
          </p>
          <Link
            href={`/workspaces/detail?id=${result.wsId}`}
            className="inline-flex items-center justify-center rounded-xl bg-leaf-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-leaf-700"
          >
            {t('workspaces.join.openWorkspace')}
          </Link>
        </Card>
      </div>
    );
  }

  const errorKey: JoinError | null = result?.ok === false ? result.error : null;

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-xl font-semibold">{t('workspaces.join.title')}</h1>
      <p className="text-sm text-ink-500">{t('workspaces.join.subtitle')}</p>

      <Card className="space-y-3">
        <label className="block space-y-1">
          <span className="block text-sm font-medium text-ink-700">
            {t('workspaces.join.codeLabel')}
          </span>
          <input
            value={urlCode || manualCode}
            onChange={(e) => {
              if (!urlCode) setManualCode(e.target.value.toUpperCase());
            }}
            placeholder={t('workspaces.join.codePlaceholder')}
            maxLength={20}
            readOnly={!!urlCode}
            autoFocus={!urlCode}
            className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-base uppercase tracking-[0.2em] outline-none focus:border-leaf-500"
          />
        </label>
        <Button type="submit" disabled={!codeToTry || attempting}>
          {attempting
            ? t('workspaces.join.joining')
            : t('workspaces.join.submit')}
        </Button>
      </Card>

      {errorKey && <JoinErrorBanner errorKey={errorKey} />}
    </form>
  );
}

function JoinErrorBanner({ errorKey }: { errorKey: JoinError }) {
  const t = useTranslations();
  // For workspace-full, the cap depends on mode but we don't know the mode
  // here (the error fires before we have the workspace doc). Use the group
  // ceiling in the message so it's never a lie for the larger case; for
  // pairs the actual cap is 2.
  const msg =
    errorKey === 'workspace-full'
      ? t('workspaces.join.errors.workspace-full', {
          max: String(workspaceCap('group')),
        })
      : t(`workspaces.join.errors.${errorKey}` as any);
  return (
    <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {msg}
    </p>
  );
}
