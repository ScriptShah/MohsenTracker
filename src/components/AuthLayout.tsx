'use client';

import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { RouteGuard } from './RouteGuard';
import { InstallPrompt } from './InstallPrompt';
import { StreakTierCelebration } from './StreakTierCelebration';

/** Everything a signed-in (or pre-onboarding) user sees: top bar,
 *  routed content, bottom nav, install prompt, and the redirect logic
 *  for users who land on a protected page without finishing onboarding. */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RouteGuard />
      <main className="mx-auto w-full max-w-screen-sm px-4 pt-4">
        <TopBar />
        {children}
      </main>
      <BottomNav />
      <InstallPrompt />
      <StreakTierCelebration />
    </>
  );
}
