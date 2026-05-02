'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';

const KNOWN = new Set([
  'glasses',
  'minutes',
  'pages',
  'reps',
  'hours',
  'steps',
  'amount',
  'prayers',
  'incidents',
  'servings',
]);

/** Look up the localized label for a preset habit unit (e.g.
 *  "glasses" → "لیوان"). Falls back to the literal unit string when the
 *  user typed a custom unit that isn't in the translation map. */
export function useUnitLabel(): (unit: string | undefined) => string {
  const t = useTranslations();
  return useCallback(
    (unit) => {
      if (!unit) return '';
      if (KNOWN.has(unit)) return t(`units.${unit}` as any);
      return unit;
    },
    [t],
  );
}

/** Non-hook variant for callsites that already have a translator function
 *  (e.g. projections builders). Same fallback behaviour. */
export function localizeUnit(
  unit: string | undefined,
  t: (key: string, vars?: Record<string, any>) => string,
): string {
  if (!unit) return '';
  if (KNOWN.has(unit)) return t(`units.${unit}`);
  return unit;
}
