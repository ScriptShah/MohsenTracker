import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Inter, Vazirmatn } from 'next/font/google';
import { locales, localeDirection, type Locale } from '@/i18n/config';
import { BottomNav } from '@/components/BottomNav';
import '../globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const vazirmatn = Vazirmatn({
  subsets: ['arabic', 'latin'],
  variable: '--font-persian',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MohsenTracker',
  description: 'Become your next version. Build the habits. See the future.',
  manifest: '/manifest.webmanifest',
  applicationName: 'MohsenTracker',
  appleWebApp: { capable: true, title: 'MohsenTracker', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#059669',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!locales.includes(locale as Locale)) notFound();
  setRequestLocale(locale);

  const messages = await getMessages();
  const dir = localeDirection[locale as Locale];

  return (
    <html lang={locale} dir={dir} className={`${inter.variable} ${vazirmatn.variable}`}>
      <body className="min-h-screen pb-20">
        <NextIntlClientProvider messages={messages} locale={locale}>
          <main className="mx-auto w-full max-w-screen-sm px-4 pt-6">{children}</main>
          <BottomNav />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
