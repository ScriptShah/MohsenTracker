'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { useAppStore } from '@/lib/store';
import type { ThemeMode } from '@/domain/types';

export function TopBar() {
  const t = useTranslations();
  const pathname = usePathname();

  if (pathname === '/profile' || pathname === '/onboarding') return null;

  return (
    <div className="mb-3 flex items-center justify-end gap-1.5">
      <ThemeToggle />
      <Link
        href="/profile"
        aria-label={t('nav.profile')}
        className="tap-44 flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-600 hover:border-leaf-300 hover:text-leaf-600"
      >
        <UserIcon className="h-4 w-4" />
      </Link>
    </div>
  );
}

/** Sun/moon button. Cycles light → dark → auto. The icon shows the
 *  *currently effective* mode (sun for light, moon for dark, monitor for
 *  auto) so users can read state at a glance. */
function ThemeToggle() {
  const t = useTranslations();
  const theme = useAppStore((s) => s.profile?.theme ?? 'auto');
  const setProfile = useAppStore((s) => s.setProfile);

  // Track the current effective mode for the icon when in 'auto'.
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const cycle = () => {
    const next: ThemeMode =
      theme === 'light' ? 'dark' : theme === 'dark' ? 'auto' : 'light';
    setProfile({ theme: next });
  };

  const effective: 'light' | 'dark' = theme === 'auto' ? (systemDark ? 'dark' : 'light') : theme;
  const Icon = theme === 'auto' ? AutoIcon : effective === 'dark' ? MoonIcon : SunIcon;
  const label = t(`settings.theme${theme.charAt(0).toUpperCase() + theme.slice(1)}` as any);

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={label}
      title={label}
      className="tap-44 flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-600 hover:border-leaf-300 hover:text-leaf-600"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function UserIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 22a8 8 0 0 1 16 0" strokeLinecap="round" />
    </svg>
  );
}

function SunIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path
        d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AutoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" strokeLinecap="round" />
    </svg>
  );
}
