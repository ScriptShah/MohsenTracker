'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';

export function TopBar() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  if (pathname === '/profile' || pathname === '/onboarding') return null;

  return (
    <div className="mb-3 flex justify-end">
      <Link
        href="/profile"
        aria-label={t('profile')}
        className="tap-44 flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-600 hover:border-leaf-300 hover:text-leaf-600"
      >
        <UserIcon className="h-4 w-4" />
      </Link>
    </div>
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
