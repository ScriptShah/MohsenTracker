'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from '@/i18n/routing';
import { useAppStore } from '@/lib/store';
import { useAuthGated } from '@/lib/auth';

/** Pathnames anyone can reach, signed in or not. Everything else is
 *  gated behind a complete onboarding (which itself includes a sign-in
 *  step). Direct URL access to a protected page redirects to /onboarding. */
const PUBLIC_PREFIXES = ['/onboarding', '/profile'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function RouteGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const profile = useAppStore((s) => s.profile);
  const gated = useAuthGated();
  const [mounted, setMounted] = useState(false);

  // Wait for client hydration so we don't redirect before persist
  // middleware has filled in the profile from localStorage.
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    // After a sign-out, push the user to /profile (where the SignInForm
    // is the only visible content). Local data is preserved — they pick
    // back up when they sign in again.
    if (gated) {
      if (pathname !== '/profile') router.replace('/profile');
      return;
    }
    if (profile?.onboardingComplete) return;
    if (isPublic(pathname)) return;
    router.replace('/onboarding');
  }, [mounted, pathname, profile?.onboardingComplete, gated, router]);

  return null;
}
