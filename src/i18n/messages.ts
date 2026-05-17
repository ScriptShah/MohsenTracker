import type { AbstractIntlMessages } from 'next-intl';
import type { Locale } from './config';

/** Translation namespaces. Order is irrelevant at runtime — the keys are
 *  flattened into one object before next-intl sees them — but keeping this
 *  list sorted keeps PR diffs minimal. When adding a new namespace, drop a
 *  `messages/<locale>/<name>.json` file for every locale in `locales` and
 *  add the name here. The static imports in `loadMessages` will then fail
 *  at build time if any locale is missing the file, so accidental drift
 *  between locales gets caught immediately. */
export const namespaces = [
  'angerProtocol',
  'app',
  'auth',
  'autophagy',
  'books',
  'cargoSlip',
  'categories',
  'common',
  'compound',
  'debts',
  'fasting',
  'futureSelf',
  'habit',
  'habitDetail',
  'home',
  'install',
  'levelUp',
  'narratives',
  'nav',
  'onboarding',
  'presets',
  'progress',
  'ramadan',
  'reset',
  'restart',
  'rewards',
  'savings',
  'settings',
  'splash',
  'streakFire',
  'units',
] as const;

export type Namespace = (typeof namespaces)[number];

/** Assemble the per-locale messages object from the per-namespace JSON
 *  files. Each entry is `import()`ed dynamically so Next.js can code-split
 *  per locale, but the namespace list above is static so adding a new
 *  feature can't accidentally ship one locale's translations without the
 *  other. */
export async function loadMessages(
  locale: Locale,
): Promise<AbstractIntlMessages> {
  const entries = await Promise.all(
    namespaces.map(async (ns) => {
      const mod = await import(`../../messages/${locale}/${ns}.json`);
      return [ns, mod.default] as const;
    }),
  );
  return Object.fromEntries(entries) as AbstractIntlMessages;
}
