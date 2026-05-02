import createNextIntlPlugin from 'next-intl/plugin';
import withPWAInit from '@ducanh2912/next-pwa';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const withPWA = withPWAInit({
  dest: 'public',
  // Silence SW logs in production builds.
  disable: process.env.NODE_ENV === 'development',
  // Network-first for everything by default — habit data is dynamic.
  // Static assets get fingerprinted URLs so they cache automatically.
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  workboxOptions: {
    // Skip waiting + clientsClaim so a new build takes over immediately.
    skipWaiting: true,
    clientsClaim: true,
    // Don't try to precache server-rendered API/middleware paths.
    exclude: [/middleware-manifest\.json$/, /\.map$/, /^.*\/_next\/data\/.*$/],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default withPWA(withNextIntl(nextConfig));
