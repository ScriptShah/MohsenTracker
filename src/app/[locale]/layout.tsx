import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Inter, Vazirmatn } from 'next/font/google';
import { locales, localeDirection, type Locale } from '@/i18n/config';
import { AppShell } from '@/components/AppShell';
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
  appleWebApp: {
    capable: true,
    title: 'MohsenTracker',
    statusBarStyle: 'default',
    startupImage: ['/icon.svg'],
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    // 180×180 PNG generated from public/icon.svg by scripts/generate-pwa-icons.mjs
    // (runs in prebuild). iOS uses this when the user adds the app to
    // their home screen — without a PNG, iOS falls back to a screenshot.
    apple: [{ url: '/apple-icon.png', type: 'image/png', sizes: '180x180' }],
  },
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
      <body className="min-h-screen pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <NextIntlClientProvider messages={messages} locale={locale}>
          <AppShell>{children}</AppShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
