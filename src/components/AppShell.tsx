'use client';

import { useAuthGated } from '@/lib/auth';
import { ThemeApplier } from './ThemeApplier';
import { CloudSync } from './CloudSync';
import { SoundUnlock } from './SoundUnlock';
import { SplashScreen } from './SplashScreen';
import { AuthLayout } from './AuthLayout';
import { PublicLayout } from './PublicLayout';

/** Top-level switcher: when the user is signed out (and Firebase is
 *  configured), the entire AuthLayout — top bar, bottom nav, RouteGuard,
 *  the page itself — is unmounted and PublicLayout takes its place.
 *  Local data is preserved; signing back in re-mounts the auth shell. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const gated = useAuthGated();
  return (
    <>
      <ThemeApplier />
      <CloudSync />
      <SoundUnlock />
      <SplashScreen />
      {gated ? <PublicLayout /> : <AuthLayout>{children}</AuthLayout>}
    </>
  );
}
