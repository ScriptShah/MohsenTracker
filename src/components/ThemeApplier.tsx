'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';

/** Applies/removes the `.dark` class on `<html>` based on profile.theme.
 *  - 'auto' follows the OS prefers-color-scheme media query (live).
 *  - 'light' / 'dark' force the choice.
 *  Mounts inside the layout once; renders nothing.
 */
export function ThemeApplier() {
  const theme = useAppStore((s) => s.profile?.theme ?? 'auto');

  useEffect(() => {
    const root = document.documentElement;

    function apply(effective: 'light' | 'dark') {
      root.classList.toggle('dark', effective === 'dark');
    }

    if (theme === 'light' || theme === 'dark') {
      apply(theme);
      return;
    }

    // 'auto' — follow OS pref and react to changes.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    apply(mq.matches ? 'dark' : 'light');
    const handler = (e: MediaQueryListEvent) => apply(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return null;
}
