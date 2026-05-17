'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/routing';
import { Link } from '@/i18n/routing';
import { useAppStore } from '@/lib/store';
import clsx from 'clsx';

const items = [
  { href: '/', key: 'home', icon: HomeIcon },
  { href: '/categories', key: 'categories', icon: GridIcon },
  { href: '/progress', key: 'progress', icon: ChartIcon },
  { href: '/future-self', key: 'futureSelf', icon: StarIcon },
  { href: '/books', key: 'books', icon: BookIcon },
] as const;

export function BottomNav() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const onboardingComplete = useAppStore(
    (s) => s.profile?.onboardingComplete ?? false,
  );

  // Don't render the nav until the user has completed onboarding (which
  // includes the sign-in step). Visitors who haven't logged in shouldn't
  // see any of these destinations — even via direct URL — and the
  // RouteGuard already handles the redirect. (Signed-out users never
  // reach here at all — AppShell unmounts AuthLayout for them.)
  if (!onboardingComplete) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-ink-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_16px_-4px_rgb(0_0_0/0.12)]"
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-screen-sm items-stretch justify-between px-2">
        {items.map(({ href, key, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                data-tutorial={`nav-${key}`}
                className={clsx(
                  'tap-44 flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium',
                  active ? 'text-leaf-600' : 'text-ink-500',
                )}
              >
                <Icon className="h-6 w-6" />
                <span>{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function HomeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M3 11l9-8 9 8v10a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z" strokeLinejoin="round" />
    </svg>
  );
}
function GridIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function ChartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M4 20V10M10 20V4M16 20v-6M22 20H2" strokeLinecap="round" />
    </svg>
  );
}
function StarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path
        d="M12 3l2.7 6 6.3.6-4.8 4.4 1.5 6.4L12 17l-5.7 3.4 1.5-6.4L3 9.6 9.3 9z"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function BookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path
        d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"
        strokeLinejoin="round"
      />
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeLinejoin="round" />
    </svg>
  );
}
