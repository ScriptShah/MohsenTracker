'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import gsap from 'gsap';
import { LeafLogo } from './LeafLogo';

const STEP_KEYS = [
  'words',
  'actions',
  'habits',
  'character',
  'destiny',
] as const;

// Two localStorage flags so the splash never re-shows after first run,
// even if the user reloads mid-flow before reaching the final page.
//   LANG_KEY  — set the moment a language is picked. Persists across the
//               cross-locale hard-navigation and across reloads. Once set,
//               the picker page is skipped.
//   SEEN_KEY  — set on full dismiss (tap-through or skip). Once set, the
//               splash doesn't show at all.
const SEEN_KEY = 'splash_seen';
const LANG_KEY = 'splash_lang_picked';

// Page 0 = language picker (skipped after first pick).
// Page 1 = logo + tagline.
// Pages 2..N = one quote each.
const PICKER_PAGE = 0;
const LOGO_PAGE = 1;
const FIRST_QUOTE_PAGE = 2;
const TOTAL_PAGES = FIRST_QUOTE_PAGE + STEP_KEYS.length; // 8

export function SplashScreen() {
  const t = useTranslations();
  const locale = useLocale();
  const [hidden, setHidden] = useState(true);
  const [pageIndex, setPageIndex] = useState(PICKER_PAGE);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(SEEN_KEY) === '1') return;
    setHidden(false);
    // If the user has already picked a language (same session or earlier),
    // skip the picker and start at the logo page.
    if (localStorage.getItem(LANG_KEY) === '1') {
      setPageIndex(LOGO_PAGE);
    }
  }, []);

  const pickLanguage = useCallback(
    (lang: 'en' | 'fa') => {
      localStorage.setItem(LANG_KEY, '1');
      if (lang !== locale) {
        // Locale lives in the URL path (/en or /fa). Hard-navigate so
        // next-intl's middleware re-runs and the layout re-renders with
        // the new messages. The splash will re-mount and pick up at the
        // logo page since LANG_KEY is set.
        const newPath = window.location.pathname.replace(
          /^\/(en|fa)/,
          `/${lang}`,
        );
        window.location.href = newPath || `/${lang}`;
        return;
      }
      setPageIndex(LOGO_PAGE);
    },
    [locale],
  );

  // Run an entrance animation each time the page changes.
  useEffect(() => {
    if (hidden || !pageRef.current) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.splash-icon', {
        scale: 0.4,
        opacity: 0,
        duration: 0.7,
        ease: 'back.out(1.6)',
      })
        .from(
          '.splash-text',
          { y: 24, opacity: 0, duration: 0.6 },
          '-=0.35',
        )
        .from(
          '.splash-hint',
          { opacity: 0, duration: 0.4 },
          '-=0.2',
        );
    }, pageRef);
    return () => ctx.revert();
  }, [pageIndex, hidden]);

  // Ambient float on the logo while it's the active page.
  useEffect(() => {
    if (hidden || pageIndex !== LOGO_PAGE) return;
    const ctx = gsap.context(() => {
      gsap.to('.splash-icon', {
        y: -8,
        duration: 2,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });
    }, pageRef);
    return () => ctx.revert();
  }, [pageIndex, hidden]);

  const dismiss = useCallback(() => {
    localStorage.setItem(SEEN_KEY, '1');
    if (!rootRef.current) {
      setHidden(true);
      return;
    }
    gsap.to(rootRef.current, {
      opacity: 0,
      duration: 0.5,
      ease: 'power2.inOut',
      onComplete: () => setHidden(true),
    });
  }, []);

  const onTap = useCallback(() => {
    // Picker page waits for an explicit button tap; tapping elsewhere
    // shouldn't accidentally advance past the language choice.
    if (pageIndex === PICKER_PAGE) return;
    if (pageIndex < TOTAL_PAGES - 1) {
      setPageIndex((p) => p + 1);
    } else {
      dismiss();
    }
  }, [pageIndex, dismiss]);

  if (hidden) return null;

  const isPicker = pageIndex === PICKER_PAGE;
  const isLogo = pageIndex === LOGO_PAGE;
  const stepKey = !isPicker && !isLogo ? STEP_KEYS[pageIndex - FIRST_QUOTE_PAGE] : null;

  return (
    <div
      ref={rootRef}
      onClick={onTap}
      role="dialog"
      aria-label="Welcome"
      className="splash-bg fixed inset-0 z-[100] flex flex-col items-center justify-between px-6 py-10"
    >
      {/* spacer so content centers between safe areas */}
      <div />

      <div
        ref={pageRef}
        key={pageIndex}
        className="flex w-full max-w-md flex-col items-center gap-6 text-center"
      >
        {isPicker ? (
          <>
            <span className="splash-icon inline-block">
              <LeafLogo size={88} />
            </span>
            <div className="splash-text space-y-1">
              <h1 className="text-2xl font-semibold text-ink-900">
                Choose your language
              </h1>
              <p className="text-2xl font-semibold text-ink-900" dir="rtl">
                زبانت را انتخاب کن
              </p>
            </div>
            <div className="splash-hint flex w-full flex-col gap-3 pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  pickLanguage('en');
                }}
                className="tap-44 w-full rounded-2xl border border-ink-200 bg-white px-4 py-3 text-base font-semibold text-ink-800 shadow-sm hover:border-leaf-400 hover:text-leaf-700"
              >
                English
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  pickLanguage('fa');
                }}
                className="tap-44 w-full rounded-2xl border border-ink-200 bg-white px-4 py-3 text-base font-semibold text-ink-800 shadow-sm hover:border-leaf-400 hover:text-leaf-700"
              >
                فارسی
              </button>
            </div>
          </>
        ) : isLogo ? (
          <>
            <span className="splash-icon inline-block drop-shadow-[0_8px_24px_rgb(16_185_129_/_0.35)]">
              <LeafLogo size={160} />
            </span>
            <div className="splash-text space-y-2">
              <h1 className="text-4xl font-semibold text-ink-900">
                {t('app.name')}
              </h1>
              <p className="text-base italic text-leaf-700">{t('app.tagline')}</p>
            </div>
          </>
        ) : (
          <>
            <BigIcon3D variant={stepKey!} />
            <p className="splash-text px-2 text-2xl font-medium leading-relaxed text-ink-900">
              {t(`splash.${stepKey}` as any)}
            </p>
            <span className="numeral text-xs text-ink-500">
              {pageIndex - LOGO_PAGE} / {STEP_KEYS.length}
            </span>
          </>
        )}
      </div>

      <div className="splash-hint flex flex-col items-center gap-3 pb-4">
        {!isPicker && (
          <p className="text-sm text-ink-500">
            {pageIndex < TOTAL_PAGES - 1
              ? t('splash.tapToContinue')
              : t('splash.tapToBegin')}
          </p>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            dismiss();
          }}
          className="text-xs text-ink-400 underline-offset-4 hover:text-ink-600 hover:underline"
        >
          {t('splash.skip')}
        </button>
      </div>
    </div>
  );
}

/* ── Big 3D-styled icon for the per-quote pages ─────────────────────── */

function BigIcon3D({ variant }: { variant: keyof typeof ICONS }) {
  const colors = COLORS[variant];
  const Icon = ICONS[variant];
  return (
    <span
      className="splash-icon relative flex h-32 w-32 items-center justify-center rounded-[2rem] text-white shadow-[0_18px_40px_-12px_rgb(0_0_0/0.35)]"
      style={{
        background: `linear-gradient(145deg, ${colors.light}, ${colors.dark})`,
      }}
      aria-hidden
    >
      <span
        className="pointer-events-none absolute inset-0 rounded-[2rem]"
        style={{
          background:
            'linear-gradient(180deg, rgb(255 255 255 / 0.4) 0%, rgb(255 255 255 / 0) 55%)',
        }}
      />
      <Icon className="relative h-16 w-16" />
    </span>
  );
}

const COLORS = {
  words:     { light: '#60a5fa', dark: '#2563eb' },
  actions:   { light: '#fb923c', dark: '#ea580c' },
  habits:    { light: '#34d399', dark: '#059669' },
  character: { light: '#facc15', dark: '#ca8a04' },
  destiny:   { light: '#f472b6', dark: '#db2777' },
} as const;

const ICONS = {
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
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
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
