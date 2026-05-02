'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from './Button';
import { Card } from './Card';
import {
  createAccountWithEmail,
  signInAsGuest,
  signInWithEmail,
  signInWithGoogle,
} from '@/lib/auth';

type Mode = 'signin' | 'signup';

export function SignInForm({ onDone }: { onDone?: () => void }) {
  const t = useTranslations();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onGoogle = async () => {
    setError(null);
    setLoading(true);
    const res = await signInWithGoogle();
    setLoading(false);
    if (res.ok) onDone?.();
    else setError(translateError(res.error, t));
  };

  const onGuest = async () => {
    setError(null);
    setLoading(true);
    const res = await signInAsGuest();
    setLoading(false);
    if (res.ok) onDone?.();
    else setError(translateError(res.error, t));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fn = mode === 'signin' ? signInWithEmail : createAccountWithEmail;
    const res = await fn(email.trim(), password);
    setLoading(false);
    if (res.ok) onDone?.();
    else setError(translateError(res.error, t));
  };

  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-semibold">
        {t(mode === 'signin' ? 'auth.signinTitle' : 'auth.signupTitle')}
      </h2>

      <Button
        type="button"
        variant="secondary"
        onClick={onGoogle}
        disabled={loading}
        className="w-full"
      >
        <GoogleGlyph className="me-2 h-4 w-4" />
        {t('auth.continueWithGoogle')}
      </Button>

      <div className="flex items-center gap-2 text-xs text-ink-500">
        <span className="h-px flex-1 bg-ink-200" />
        <span>{t('auth.or')}</span>
        <span className="h-px flex-1 bg-ink-200" />
      </div>

      <form onSubmit={onSubmit} className="space-y-2">
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth.email')}
          required
          className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
        />
        <input
          type="password"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('auth.password')}
          required
          minLength={6}
          className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {t(mode === 'signin' ? 'auth.signinSubmit' : 'auth.signupSubmit')}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === 'signin' ? 'signup' : 'signin');
          setError(null);
        }}
        className="block w-full text-center text-xs text-leaf-700 underline"
      >
        {t(mode === 'signin' ? 'auth.toggleToSignUp' : 'auth.toggleToSignIn')}
      </button>

      <div className="border-t border-ink-100 pt-3">
        <button
          type="button"
          onClick={onGuest}
          disabled={loading}
          className="block w-full text-center text-xs text-ink-500 underline-offset-4 hover:text-ink-700 hover:underline disabled:opacity-50"
        >
          {t('auth.continueAsGuest')}
        </button>
        <p className="pt-1 text-center text-[10px] text-ink-400">
          {t('auth.guestNote')}
        </p>
      </div>
    </Card>
  );
}

function translateError(
  code: string,
  t: (k: string, vars?: Record<string, any>) => string,
): string {
  if (code.includes('user-not-found')) return t('auth.errors.userNotFound');
  if (code.includes('wrong-password') || code.includes('invalid-credential'))
    return t('auth.errors.wrongPassword');
  if (code.includes('email-already-in-use'))
    return t('auth.errors.emailInUse');
  if (code.includes('weak-password')) return t('auth.errors.weakPassword');
  if (code.includes('invalid-email')) return t('auth.errors.invalidEmail');
  if (code.includes('popup-closed') || code.includes('cancelled'))
    return t('auth.errors.popupClosed');
  if (code === 'firebase-disabled') return t('auth.errors.disabled');
  return t('auth.errors.generic');
}

function GoogleGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.56-2.77c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
