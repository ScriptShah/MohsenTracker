'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import clsx from 'clsx';
import { LeafLogo } from './LeafLogo';

type Phase = 'logo' | 'chain' | 'fading' | 'gone';

const STEP_KEYS = [
  'thoughts',
  'words',
  'actions',
  'habits',
  'character',
  'destiny',
] as const;

const STEP_DELAY_MS = 600; // delay between each line revealing
const LOGO_LINGER_MS = 900;
const TAIL_LINGER_MS = 1400;
const SESSION_KEY = 'splash_seen_session';

export function SplashScreen() {
  const t = useTranslations();
  const [phase, setPhase] = useState<Phase>('logo');
  const [revealed, setRevealed] = useState(0);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Show once per browser session — cold start only. New tab, new
    // session → splash plays. In-session route navigation does not.
    if (sessionStorage.getItem(SESSION_KEY) === '1') return;
    sessionStorage.setItem(SESSION_KEY, '1');
    setHidden(false);

    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setPhase('chain'), LOGO_LINGER_MS));
    for (let i = 0; i < STEP_KEYS.length; i++) {
      timers.push(
        setTimeout(
          () => setRevealed(i + 1),
          LOGO_LINGER_MS + STEP_DELAY_MS * i,
        ),
      );
    }
    const fadeStart =
      LOGO_LINGER_MS + STEP_DELAY_MS * STEP_KEYS.length + TAIL_LINGER_MS;
    timers.push(setTimeout(() => setPhase('fading'), fadeStart));
    timers.push(setTimeout(() => setHidden(true), fadeStart + 700));
    return () => timers.forEach(clearTimeout);
  }, []);

  if (hidden) return null;

  return (
    <div
      onClick={() => setHidden(true)}
      role="dialog"
      aria-label="Welcome"
      className={clsx(
        'fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-leaf-50 via-white to-sand-50 px-6 py-8',
        phase === 'fading' && 'splash-fade-out',
      )}
    >
      <div className="splash-fade-up flex flex-col items-center gap-2" style={{ animationDelay: '0ms' }}>
        <span className="splash-logo-float inline-block">
          <LeafLogo size={88} />
        </span>
        <h1 className="text-2xl font-semibold text-ink-900">
          {t('app.name')}
        </h1>
        <p className="text-xs italic text-leaf-700">{t('app.tagline')}</p>
      </div>

      <ul className="w-full max-w-xs space-y-3">
        {STEP_KEYS.map((key, i) => {
          const visible = phase !== 'logo' && revealed > i;
          const Icon = ICONS[key];
          return (
            <li
              key={key}
              className={clsx(
                'flex items-center gap-3 rounded-xl border border-ink-200 bg-white px-3 py-2 shadow-sm',
                visible ? 'splash-fade-up' : 'opacity-0',
              )}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-leaf-50 text-leaf-700"
                aria-hidden
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm leading-snug text-ink-800">
                {t(`splash.${key}` as any)}
              </span>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setHidden(true);
        }}
        className="text-xs text-ink-500 underline-offset-4 hover:text-ink-700 hover:underline"
      >
        {t('splash.skip')}
      </button>
    </div>
  );
}

/* ── Icons ───────────────────────────────────────────────────────────── */

const ICONS = {
  thoughts: ThoughtsIcon,
  words: WordsIcon,
  actions: ActionsIcon,
  habits: HabitsIcon,
  character: CharacterIcon,
  destiny: DestinyIcon,
} as const;

function svg(props: React.SVGProps<SVGSVGElement>, children: React.ReactNode) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {children}
    </svg>
  );
}

function ThoughtsIcon(props: React.SVGProps<SVGSVGElement>) {
  return svg(
    props,
    <>
      <path d="M9 19c-3 0-5-2-5-5 0-2 1.5-4 4-4 0-3 2-5 5-5s5 2 5 5c2 0 4 2 4 4 0 3-2 5-5 5z" />
      <circle cx="8" cy="22" r="1.2" />
      <circle cx="6" cy="20" r="0.8" />
    </>,
  );
}

function WordsIcon(props: React.SVGProps<SVGSVGElement>) {
  return svg(
    props,
    <>
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" />
      <path d="M8 11h8M8 14h5" />
    </>,
  );
}

function ActionsIcon(props: React.SVGProps<SVGSVGElement>) {
  return svg(
    props,
    <>
      <path d="M5 11V6a2 2 0 0 1 4 0v5" />
      <path d="M9 11V4a2 2 0 0 1 4 0v7" />
      <path d="M13 11V5a2 2 0 0 1 4 0v8" />
      <path d="M17 9a2 2 0 0 1 4 0v6a7 7 0 0 1-7 7h-2a7 7 0 0 1-6-3.5L3 14" />
    </>,
  );
}

function HabitsIcon(props: React.SVGProps<SVGSVGElement>) {
  return svg(
    props,
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <polyline points="21 3 21 9 15 9" />
    </>,
  );
}

function CharacterIcon(props: React.SVGProps<SVGSVGElement>) {
  return svg(
    props,
    <>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>,
  );
}

function DestinyIcon(props: React.SVGProps<SVGSVGElement>) {
  return svg(
    props,
    <>
      <path d="M12 2l2.7 6.2L21 9l-5 4.5L17.5 21 12 17.5 6.5 21 8 13.5 3 9l6.3-0.8z" />
    </>,
  );
}
