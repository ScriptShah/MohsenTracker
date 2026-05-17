'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ClientGate } from '@/components/ClientGate';
import { useAuth, emailUsername } from '@/lib/auth';
import { createWorkspace } from '@/lib/workspaces';
import type { WorkspaceMode } from '@/domain/types';

/** Suggested icons. Owner can also paste any single emoji. */
const ICON_CHOICES = ['🤝', '🌿', '☪', '📖', '👨‍👩‍👧', '🕌', '💚', '🔥', '✨', '🌙'];

export default function NewWorkspacePage() {
  return (
    <ClientGate>
      <NewWorkspace />
    </ClientGate>
  );
}

function NewWorkspace() {
  const t = useTranslations();
  const router = useRouter();
  const auth = useAuth();

  const [mode, setMode] = useState<WorkspaceMode>('pair');
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState<string>(ICON_CHOICES[0]!);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signedIn = auth.status === 'signed-in' && !auth.isAnonymous;
  const displayName =
    auth.status === 'signed-in'
      ? auth.displayName ?? emailUsername(auth.email) ?? 'You'
      : 'You';
  const photoURL =
    auth.status === 'signed-in' && (auth as any).photoURL
      ? ((auth as any).photoURL as string)
      : undefined;

  const canSubmit = signedIn && title.trim().length > 0 && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const result = await createWorkspace({
      mode,
      title: title.trim(),
      icon: icon || '🤝',
      ownerDisplayName: displayName,
      ownerPhotoURL: photoURL,
    });
    setSubmitting(false);
    if (!result.ok) {
      // Surface the actual failure instead of a generic toast. The
      // stage tells us which write was rejected (workspace doc,
      // member subdoc, or invite-code lookup); the code is a Firebase
      // error code when present (e.g. 'permission-denied', 'unavailable').
      // For 'member-doc' and 'invite-doc', the parent workspace was
      // actually created — we still bail so the user knows something
      // partial happened, rather than silently navigating to a doc
      // that's missing its member/invite half.
      const reason =
        result.code === 'permission-denied'
          ? t('workspaces.new.errors.permissionDenied')
          : result.code === 'unavailable'
          ? t('workspaces.new.errors.unavailable')
          : t('workspaces.new.errors.detailed', {
              stage: result.stage,
              code: result.code,
            });
      setError(reason);
      return;
    }
    router.replace(`/workspaces/detail?id=${result.workspace.id}`);
  };

  if (!signedIn) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">{t('workspaces.new.title')}</h1>
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

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-xl font-semibold">{t('workspaces.new.title')}</h1>

      <Card className="space-y-4">
        <Field label={t('workspaces.new.modeLabel')}>
          <div className="grid grid-cols-1 gap-2">
            <ModeChip
              active={mode === 'pair'}
              onClick={() => setMode('pair')}
              title={t('workspaces.modePair')}
              body={t('workspaces.modePairBody')}
            />
            <ModeChip
              active={mode === 'group'}
              onClick={() => setMode('group')}
              title={t('workspaces.modeGroup')}
              body={t('workspaces.modeGroupBody')}
            />
          </div>
        </Field>

        <Field label={t('workspaces.new.titleLabel')}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('workspaces.new.titlePlaceholder')}
            maxLength={60}
            className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
            required
            autoFocus
          />
        </Field>

        <Field label={t('workspaces.new.iconLabel')} hint={t('workspaces.new.iconHint')}>
          <div className="flex flex-wrap gap-2">
            {ICON_CHOICES.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setIcon(emoji)}
                className={`tap-44 flex h-11 w-11 items-center justify-center rounded-xl border text-xl transition ${
                  icon === emoji
                    ? 'border-leaf-500 bg-leaf-50'
                    : 'border-ink-200 bg-white hover:border-ink-300'
                }`}
                aria-pressed={icon === emoji}
              >
                <span aria-hidden>{emoji}</span>
              </button>
            ))}
          </div>
        </Field>
      </Card>

      {error && (
        <p className="whitespace-pre-line rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm leading-relaxed text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          {t('workspaces.new.cancel')}
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {submitting ? t('workspaces.join.joining') : t('workspaces.new.create')}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-sm font-medium text-ink-700">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}

function ModeChip({
  active,
  onClick,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`tap-44 w-full rounded-xl border px-3 py-3 text-start transition ${
        active ? 'border-leaf-500 bg-leaf-50' : 'border-ink-200 bg-white hover:border-ink-300'
      }`}
    >
      <div className={`text-sm font-semibold ${active ? 'text-leaf-800' : 'text-ink-900'}`}>
        {title}
      </div>
      <div className="text-xs text-ink-600">{body}</div>
    </button>
  );
}
