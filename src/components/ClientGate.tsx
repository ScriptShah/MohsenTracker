'use client';

import { useEffect, useState } from 'react';

/**
 * Render children only after client-side hydration. Avoids reading from
 * persisted-state stores during SSR/SSG, which would either flash the wrong
 * UI or crash the prerender if the persist middleware isn't initialized yet.
 */
export function ClientGate({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <>{fallback ?? <div className="h-32 animate-pulse rounded-2xl bg-ink-100" />}</>;
  return <>{children}</>;
}
