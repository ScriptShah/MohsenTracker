import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, locales, type Locale } from './config';
import { loadMessages } from './messages';

export default getRequestConfig(async ({ requestLocale }) => {
  // next-intl 3.22+ deprecated the `locale` arg in favour of
  // `requestLocale` (a Promise). Resolve it and validate against our
  // supported set, falling back to the default if the URL had something
  // unexpected. Returning `locale` from this config is required and
  // suppresses the "no locale was returned" warning at build time.
  let locale = await requestLocale;
  if (!locale || !locales.includes(locale as Locale)) {
    locale = defaultLocale;
  }
  return {
    locale,
    messages: await loadMessages(locale as Locale),
  };
});
