'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';

/**
 * Returns a number formatter tied to the UI locale: English UI → Western
 * digits (1234), Persian UI → Persian digits (۱۲۳۴). There used to be a
 * separate numeralSystem preference, but it caused mismatched states (e.g.
 * Persian digits in an English UI). Locale is now the single source.
 */
export function useNumberFormatter() {
  const locale = useLocale();

  return useMemo(() => {
    const tag = locale === 'fa' ? 'fa-IR-u-nu-arabext' : 'en-US';
    const nf = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 });
    return (n: number) => nf.format(n);
  }, [locale]);
}
