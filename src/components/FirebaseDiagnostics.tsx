'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from './Card';
import { Button } from './Button';
import {
  anyFailed,
  runFirebaseDiagnostics,
  type ProbeResult,
} from '@/lib/diagnostics';

/** Self-serve Firebase health check on the Profile page. Hidden until
 *  the user taps **Run check**; on run, executes a series of probes
 *  against the live Firestore project to confirm cloud features
 *  actually work for the currently-signed-in user. The killer probe is
 *  the workspace cycle — it exercises every rule we use for the
 *  workspaces feature, so a pass means everything works and a fail at
 *  step X tells the user (and us) exactly which rule isn't deployed.
 *
 *  Why this exists: three separate bug reports turned out to be
 *  "Firestore rules in your Firebase console are stale — the rules
 *  file in the repo was updated but never re-published." Without this
 *  diagnostic, each one needed a round of error-surfacing PRs before
 *  we even knew what to fix. The user runs this once, sees ✗ on
 *  workspaceEvent (or whichever rule is wrong), pastes the new rules
 *  into the Firebase console, runs the check again, and either it's
 *  all green or we know what's still broken. */
export function FirebaseDiagnostics() {
  const t = useTranslations();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ProbeResult[] | null>(null);

  const onRun = async () => {
    setRunning(true);
    setResults(null);
    const r = await runFirebaseDiagnostics();
    setResults(r);
    setRunning(false);
  };

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-ink-800">
          {t('settings.diagnostics.title')}
        </h2>
        <p className="pt-1 text-xs text-ink-500">
          {t('settings.diagnostics.body')}
        </p>
      </div>

      <Button type="button" variant="ghost" onClick={onRun} disabled={running}>
        {running
          ? t('settings.diagnostics.running')
          : results
          ? t('settings.diagnostics.runAgain')
          : t('settings.diagnostics.run')}
      </Button>

      {results && (
        <ul className="space-y-1.5">
          {results.map((r) => (
            <ProbeRow key={r.id} result={r} />
          ))}
        </ul>
      )}

      {results && anyFailed(results) && (
        <Card className="space-y-2 border-amber-200 bg-amber-50">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            {t('settings.diagnostics.guidanceTitle')}
          </p>
          <p className="text-xs leading-relaxed text-ink-700">
            {t('settings.diagnostics.guidanceBody')}
          </p>
        </Card>
      )}
    </Card>
  );
}

function ProbeRow({ result }: { result: ProbeResult }) {
  const t = useTranslations();
  const icon =
    result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '–';
  const colour =
    result.status === 'pass'
      ? 'text-leaf-700'
      : result.status === 'fail'
      ? 'text-red-700'
      : 'text-ink-400';
  // Per-probe label key. Falls back to the bare id if no translation
  // exists yet (shouldn't happen — defensive).
  const labelKey = `settings.diagnostics.probes.${result.id}` as const;
  return (
    <li
      className="flex items-start gap-3 rounded-xl border border-ink-200 bg-white px-3 py-2"
      data-probe-status={result.status}
    >
      <span
        className={`mt-0.5 w-4 shrink-0 text-center font-mono text-sm font-bold ${colour}`}
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-800">
          {t(labelKey as any)}
        </p>
        {result.status === 'fail' && (
          <p className="pt-0.5 break-all font-mono text-[11px] text-red-700">
            {result.code}
            {result.message ? ` — ${truncate(result.message, 200)}` : ''}
          </p>
        )}
        {result.status === 'skip' && (
          <p className="pt-0.5 text-[11px] text-ink-500">
            {t('settings.diagnostics.skippedHint')}
          </p>
        )}
      </div>
    </li>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
