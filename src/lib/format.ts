'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import { useAppStore } from './store';

/**
 * Returns a number formatter that respects the user's preferred numeral system.
 * Persian users get ۰۱۲۳ when their profile.numeralSystem is 'persian'; the rest
 * get Western digits regardless of UI language.
 */
export function useNumberFormatter() {
  const locale = useLocale();
  const numeralSystem = useAppStore((s) => s.profile?.numeralSystem);

  return useMemo(() => {
    const tag =
      numeralSystem === 'persian'
        ? 'fa-IR-u-nu-arabext'
        : numeralSystem === 'western'
        ? 'en-US'
        : locale === 'fa'
        ? 'fa-IR-u-nu-arabext'
        : 'en-US';
    const nf = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 });
    return (n: number) => nf.format(n);
  }, [locale, numeralSystem]);
}
