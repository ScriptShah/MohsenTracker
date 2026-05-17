'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAppStore } from '@/lib/store';
import { Button } from './Button';

/** First-run feature tour. Coach-mark style — each step points at an
 *  actual UI element on the home page (or in the bottom nav) so the
 *  user learns by seeing, not by reading a generic popup. The
 *  highlighted element gets a glowing leaf-coloured ring; everything
 *  else dims behind a semi-transparent backdrop; a tooltip near the
 *  target explains what it does.
 *
 *  Each step references a DOM element via its `data-tutorial="key"`
 *  attribute. If the element isn't on the page (e.g. a Workspaces
 *  section when the user is in no workspaces), the step is skipped
 *  silently so we don't dim the screen with nothing to point at.
 *
 *  Re-measures on scroll + resize so the spotlight follows the
 *  element as the layout shifts. Plays once per profile — the
 *  `tutorialCompletedAt` ISO stamp on the user's profile gates it.
 */

interface TutorialStep {
  /** Matches a `data-tutorial="…"` attribute somewhere in the DOM. */
  key: string;
  /** Where to place the tooltip relative to the target. Falls back to
   *  the opposite side if the chosen side has no room on screen. */
  preferred: 'above' | 'below';
  /** Translation key suffix → `tutorial.steps.{slug}.{title|body}`. */
  slug: string;
}

const STEPS: TutorialStep[] = [
  { key: 'lives', preferred: 'below', slug: 'hearts' },
  { key: 'ring', preferred: 'below', slug: 'ring' },
  { key: 'checklist', preferred: 'above', slug: 'checklist' },
  { key: 'workspaces', preferred: 'above', slug: 'workspaces' },
  { key: 'nav-futureSelf', preferred: 'above', slug: 'futureSelf' },
];

const PAD = 8; // Padding around the target rect for the spotlight ring.
const TOOLTIP_MARGIN = 12; // Gap between target and tooltip.
const TOOLTIP_MAX_WIDTH = 320;

export function Tutorial() {
  const t = useTranslations();
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);

  // SSR / hydration gate. The overlay measures DOM elements, so it
  // must wait until after first client paint.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [rawStepIdx, setRawStepIdx] = useState(0);

  /** The next step whose target is currently present in the DOM. Skips
   *  steps whose target is missing (e.g. workspaces when the user has
   *  joined none) without burning the user's "I tapped Next" intent.
   *
   *  Re-runs on every state tick so newly-mounted elements (e.g. a
   *  workspace section that just resolved its Firestore listener)
   *  become valid spotlight targets immediately. */
  const [target, setTarget] = useState<{
    step: TutorialStep;
    bounds: DOMRect;
  } | null>(null);

  useLayoutEffect(() => {
    if (!mounted) return;
    if (!profile || !profile.onboardingComplete) return;
    if (profile.tutorialCompletedAt) return;

    /** Find the first present step from rawStepIdx onward. If the target
     *  is off-screen, scroll it into view BEFORE measuring (otherwise the
     *  spotlight gets drawn at viewport-relative coords that point at
     *  empty space). If no steps are present, mark the tutorial complete
     *  — there's nothing to point at. */
    function measure() {
      for (let i = rawStepIdx; i < STEPS.length; i++) {
        const step = STEPS[i]!;
        const el = document.querySelector<HTMLElement>(
          `[data-tutorial="${step.key}"]`,
        );
        if (!el) continue;
        let bounds = el.getBoundingClientRect();
        if (bounds.width === 0 && bounds.height === 0) continue;

        // Scroll into view if the target is off-screen or only partly in
        // view. `block: 'center'` puts it mid-viewport so the tooltip has
        // room on both sides regardless of preferred placement. Sync
        // (default behavior), so the very next measurement reflects the
        // scrolled position.
        const vh = window.innerHeight;
        const margin = 80;
        const offTop = bounds.top < margin;
        const offBottom = bounds.bottom > vh - margin;
        if (offTop || offBottom) {
          el.scrollIntoView({ block: 'center', inline: 'nearest' });
          bounds = el.getBoundingClientRect();
        }

        setTarget({ step, bounds });
        return;
      }
      // Past the last present step → finish silently.
      setTarget(null);
      setProfile({ tutorialCompletedAt: new Date().toISOString() });
    }

    measure();

    // Re-measure on layout shifts. ResizeObserver covers content
    // changes; window scroll / resize covers user scroll + orientation.
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);

    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [mounted, rawStepIdx, profile, setProfile]);

  if (!mounted) return null;
  if (!profile || !profile.onboardingComplete) return null;
  if (profile.tutorialCompletedAt) return null;
  if (!target) return null;

  const { step, bounds } = target;
  const isLast = STEPS.indexOf(step) === STEPS.length - 1;
  const stepNumber = STEPS.indexOf(step) + 1;

  const finish = () => {
    setProfile({ tutorialCompletedAt: new Date().toISOString() });
  };

  const next = () => {
    if (isLast) {
      finish();
      return;
    }
    // Bump past current; the measure loop walks forward to find the
    // next live target.
    setRawStepIdx(STEPS.indexOf(step) + 1);
  };

  // Cutout pattern: an absolutely-positioned rectangle at the target's
  // bounds with a giant `box-shadow` extending outward. The shadow
  // covers the rest of the viewport in a dim colour while the cutout
  // itself stays transparent, so the highlighted element shows through
  // at full opacity. Adding `ring-4 ring-leaf-400` on the same div
  // gives the spotlight its glowing border.
  const cutoutStyle: React.CSSProperties = {
    top: bounds.top - PAD,
    left: bounds.left - PAD,
    width: bounds.width + PAD * 2,
    height: bounds.height + PAD * 2,
    boxShadow: '0 0 0 100vmax rgba(15, 23, 42, 0.7)',
  };

  // Tooltip placement: try preferred side, fall back to the other if
  // there isn't enough room. Clamp horizontally so it doesn't run off
  // the viewport on mobile.
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
  const tooltipHeightGuess = 180;
  const roomBelow = vh - (bounds.bottom + TOOLTIP_MARGIN);
  const roomAbove = bounds.top - TOOLTIP_MARGIN;
  let side: 'above' | 'below' = step.preferred;
  if (
    side === 'below' &&
    roomBelow < tooltipHeightGuess &&
    roomAbove > roomBelow
  ) {
    side = 'above';
  } else if (
    side === 'above' &&
    roomAbove < tooltipHeightGuess &&
    roomBelow > roomAbove
  ) {
    side = 'below';
  }
  const tooltipTop =
    side === 'below'
      ? Math.min(
          bounds.bottom + TOOLTIP_MARGIN,
          vh - tooltipHeightGuess - 16,
        )
      : Math.max(16, bounds.top - tooltipHeightGuess - TOOLTIP_MARGIN);
  const tooltipLeft = Math.max(
    16,
    Math.min(
      vw - TOOLTIP_MAX_WIDTH - 16,
      bounds.left + bounds.width / 2 - TOOLTIP_MAX_WIDTH / 2,
    ),
  );

  return (
    <div
      className="fixed inset-0 z-[80]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
      onClick={(e) => {
        // Tap outside the tooltip = Skip. Avoid swallowing taps inside
        // the tooltip itself.
        if ((e.target as HTMLElement).closest('[data-tutorial-tooltip]'))
          return;
        finish();
      }}
    >
      {/* Spotlight cutout: dim everything except the target via a giant
          box-shadow extending outward from this transparent rectangle.
          The highlighted element shows through at full opacity. */}
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-2xl ring-4 ring-leaf-400 transition-all"
        style={cutoutStyle}
      />

      {/* Tooltip */}
      <div
        data-tutorial-tooltip
        className="absolute rounded-2xl bg-white p-4 shadow-2xl"
        style={{
          top: tooltipTop,
          left: tooltipLeft,
          maxWidth: TOOLTIP_MAX_WIDTH,
          width: 'calc(100vw - 32px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="numeral text-[11px] uppercase tracking-wide text-leaf-700">
            {t('tutorial.step', {
              n: String(stepNumber),
              total: String(STEPS.length),
            })}
          </span>
          <button
            type="button"
            onClick={finish}
            className="text-xs font-medium text-ink-500 underline-offset-4 hover:text-ink-700 hover:underline"
          >
            {t('tutorial.skip')}
          </button>
        </div>
        <h2
          id="tutorial-title"
          className="mt-2 text-lg font-semibold leading-snug text-ink-900"
        >
          {t(`tutorial.steps.${step.slug}.title` as any)}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-600">
          {t(`tutorial.steps.${step.slug}.body` as any)}
        </p>
        <div className="mt-4 flex items-center justify-end">
          <Button type="button" onClick={next}>
            {isLast ? t('tutorial.start') : t('tutorial.next')}
          </Button>
        </div>
      </div>
    </div>
  );
}
