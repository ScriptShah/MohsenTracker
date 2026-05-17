'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAppStore } from '@/lib/store';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'install_prompt_dismissed';

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // iOS Safari sets navigator.standalone in non-standard places.
  return Boolean((window.navigator as any).standalone);
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
}

/** Bottom-floating install banner. Hidden when:
 *  - the app is already running in standalone (PWA installed)
 *  - the user has dismissed it before (localStorage flag)
 *  - the user hasn't completed onboarding yet
 *  - on desktop: until the browser fires beforeinstallprompt
 *  - on iOS Safari: shows a manual "Share → Add to Home Screen" hint
 *    (iOS doesn't expose a programmatic install API).
 */
export function InstallPrompt() {
  const t = useTranslations();
  const onboardingComplete = useAppStore(
    (s) => s.profile?.onboardingComplete ?? false,
  );
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [variant, setVariant] = useState<'none' | 'android' | 'ios'>('none');
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISSED_KEY) === '1') return;

    if (isIOS()) {
      setVariant('ios');
      setHidden(false);
      return;
    }

    // Android / Chromium: listen for the native install prompt event.
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setVariant('android');
      setHidden(false);
    };
    window.addEventListener('beforeinstallprompt', handler);
    // Once installed (e.g. user accepted), tear down.
    const installed = () => setHidden(true);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setHidden(true);
  }, []);

  const triggerInstall = useCallback(async () => {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setHidden(true);
      }
    } catch {
      /* user closed the prompt — nothing to do */
    } finally {
      setInstallEvent(null);
    }
  }, [installEvent]);

  if (hidden || variant === 'none' || !onboardingComplete) return null;

  return (
    <div
      role="dialog"
      aria-label={t('install.title')}
      className="fixed inset-x-2 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-sm rounded-2xl border border-leaf-200 bg-white p-3 shadow-[0_8px_24px_-8px_rgb(0_0_0/0.2)]"
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
          style={{
            background: 'linear-gradient(145deg, #34d399, #059669)',
          }}
          aria-hidden
        >
          <DownloadIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold text-ink-800">
            {t('install.title')}
          </p>
          {variant === 'android' ? (
            <p className="text-xs text-ink-500">{t('install.androidBody')}</p>
          ) : (
            <ol className="space-y-1 text-xs text-ink-600">
              <li className="flex items-center gap-1.5">
                <span className="rounded-full bg-leaf-50 px-1.5 text-leaf-700">1</span>
                <span>{t('install.iosStep1')}</span>
                <ShareIcon className="h-3.5 w-3.5 text-leaf-700" />
              </li>
              <li className="flex items-center gap-1.5">
                <span className="rounded-full bg-leaf-50 px-1.5 text-leaf-700">2</span>
                <span>{t('install.iosStep2')}</span>
                <PlusIcon className="h-3.5 w-3.5 text-leaf-700" />
              </li>
            </ol>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('install.dismiss')}
          className="tap-44 -me-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-700"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
      {variant === 'android' && (
        <button
          type="button"
          onClick={triggerInstall}
          className="tap-44 mt-3 w-full rounded-xl bg-leaf-600 py-2 text-sm font-semibold text-white hover:bg-leaf-700 active:bg-leaf-800"
        >
          {t('install.installButton')}
        </button>
      )}
    </div>
  );
}

function DownloadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3v12" />
      <path d="m6 11 6 6 6-6" />
      <path d="M5 21h14" />
    </svg>
  );
}
function ShareIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3v12" />
      <path d="m8 7 4-4 4 4" />
      <path d="M5 21V12a2 2 0 0 1 2-2h2" />
      <path d="M19 21V12a2 2 0 0 0-2-2h-2" />
      <path d="M5 21h14" />
    </svg>
  );
}
function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}
function CloseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
