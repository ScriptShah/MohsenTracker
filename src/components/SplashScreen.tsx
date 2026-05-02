'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import gsap from 'gsap';
import clsx from 'clsx';
import { LeafLogo } from './LeafLogo';

const STEP_KEYS = [
  'thoughts',
  'words',
  'actions',
  'habits',
  'character',
  'destiny',
] as const;

const SESSION_KEY = 'splash_seen_session';

export function SplashScreen() {
  const t = useTranslations();
  const [hidden, setHidden] = useState(true);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stepRefs = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(SESSION_KEY) === '1') return;
    sessionStorage.setItem(SESSION_KEY, '1');
    setHidden(false);
  }, []);

  useEffect(() => {
    if (hidden || !rootRef.current) return;

    const ctx = gsap.context(() => {
      // Main reveal timeline.
      const tl = gsap.timeline({
        defaults: { duration: 0.7, ease: 'power3.out' },
      });

      tl.from('.splash-logo', {
        scale: 0.5,
        opacity: 0,
        duration: 0.9,
        ease: 'back.out(1.6)',
      })
        .from(
          '.splash-title',
          { y: 14, opacity: 0, duration: 0.5 },
          '-=0.35',
        )
        .from(
          '.splash-tagline',
          { y: 12, opacity: 0, duration: 0.45 },
          '-=0.3',
        );

      // Cascade the chain — each row pops in with a tiny scale bounce.
      tl.from(
        stepRefs.current,
        {
          y: 24,
          opacity: 0,
          scale: 0.92,
          duration: 0.55,
          ease: 'back.out(1.4)',
          stagger: 0.18,
        },
        '+=0.1',
      );

      // Settle, then fade the whole thing out.
      tl.to({}, { duration: 1.6 }).to(rootRef.current, {
        opacity: 0,
        duration: 0.7,
        ease: 'power2.inOut',
        onComplete: () => setHidden(true),
      });

      // Ambient float on the leaf.
      gsap.to('.splash-logo', {
        y: -5,
        duration: 2,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });
    }, rootRef);

    return () => ctx.revert();
  }, [hidden]);

  if (hidden) return null;

  return (
    <div
      ref={rootRef}
      onClick={() => setHidden(true)}
      role="dialog"
      aria-label="Welcome"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-leaf-50 via-white to-sand-50 px-6 py-8"
    >
      <div className="flex flex-col items-center gap-2">
        <span className="splash-logo inline-block drop-shadow-[0_8px_24px_rgb(16_185_129_/_0.35)]">
          <LeafLogo size={104} />
        </span>
        <h1 className="splash-title text-2xl font-semibold text-ink-900">
          {t('app.name')}
        </h1>
        <p className="splash-tagline text-xs italic text-leaf-700">
          {t('app.tagline')}
        </p>
      </div>

      <ul className="w-full max-w-xs space-y-2.5">
        {STEP_KEYS.map((key, i) => {
          const Icon = ICONS[key];
          return (
            <li
              key={key}
              ref={(el) => {
                stepRefs.current[i] = el;
              }}
              className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white px-3 py-2 shadow-sm"
            >
              <Icon3D variant={key} />
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

/* ── 3D-styled icons ─────────────────────────────────────────────────── */

/** Each icon sits on a round chip with a soft gradient + inner highlight
 *  and an outer drop shadow to give it a subtle 3D / pill feel. The icon
 *  glyph itself is a white outline so it pops against the chip. */
function Icon3D({ variant }: { variant: keyof typeof ICONS }) {
  const colors = COLORS[variant];
  const Icon = ICONS[variant];
  return (
    <span
      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-[0_4px_10px_-2px_rgb(0_0_0/0.18)]"
      style={{
        background: `linear-gradient(145deg, ${colors.light}, ${colors.dark})`,
      }}
      aria-hidden
    >
      <span
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            'linear-gradient(180deg, rgb(255 255 255 / 0.35) 0%, rgb(255 255 255 / 0) 55%)',
        }}
      />
      <Icon className="relative h-5 w-5" />
    </span>
  );
}

const COLORS = {
  thoughts:  { light: '#a78bfa', dark: '#7c3aed' }, // violet
  words:     { light: '#60a5fa', dark: '#2563eb' }, // blue
  actions:   { light: '#fb923c', dark: '#ea580c' }, // orange
  habits:    { light: '#34d399', dark: '#059669' }, // leaf
  character: { light: '#facc15', dark: '#ca8a04' }, // amber
  destiny:   { light: '#f472b6', dark: '#db2777' }, // pink
} as const;

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
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
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
