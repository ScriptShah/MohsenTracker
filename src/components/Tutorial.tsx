'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
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
  /** Matches a `data-tutorial="…"` attribute somewhere in the DOM, or
   *  `null` for a no-target step that renders as a centered modal-style
   *  tooltip (no spotlight). Use the targetless form for catch-all
   *  steps like "more features" that don't point at a single DOM node. */
  key: string | null;
  /** Where to place the tooltip relative to the target. Falls back to
   *  the opposite side if the chosen side has no room on screen. Ignored
   *  for `key: null` steps (always centered). */
  preferred: 'above' | 'below';
  /** Translation key suffix → `tutorial.steps.{slug}.{title|body}`. */
  slug: string;
  /** Optional in-app destination. When set, the tooltip gains an
   *  **Open** button that navigates there and finishes the tutorial —
   *  so the tour can actually take the user to the workspaces hub,
   *  settings page, etc. instead of just describing them. */
  href?: string;
}

/** Order matters: home elements first (so the user learns the daily
 *  loop), then the bottom nav (so they learn navigation), then the
 *  top-bar profile (so they know where settings + sign-out live).
 *  Each step is independently optional — a missing target is skipped
 *  silently, so e.g. the workspaces step is a no-op for users with no
 *  workspaces section rendered yet. */
const STEPS: TutorialStep[] = [
  { key: 'lives', preferred: 'below', slug: 'hearts' },
  { key: 'ring', preferred: 'below', slug: 'ring' },
  { key: 'checklist', preferred: 'above', slug: 'checklist' },
  { key: 'add-habit', preferred: 'above', slug: 'addHabit', href: '/habits/new' },
  // The 'rewards' card on Home only renders for users who haven't
  // configured rewards/punishments yet — for returning users this step
  // skips silently, and the dedicated 'moreFeatures' no-target step at
  // the end picks up the slack (mentions rewards + punishments + reset
  // in one shot).
  { key: 'rewards', preferred: 'above', slug: 'rewards', href: '/rewards' },
  { key: 'reset', preferred: 'above', slug: 'reset', href: '/reset' },
  { key: 'workspaces', preferred: 'above', slug: 'workspaces', href: '/workspaces' },
  { key: 'nav-categories', preferred: 'above', slug: 'categories', href: '/categories' },
  { key: 'nav-progress', preferred: 'above', slug: 'progress', href: '/progress' },
  { key: 'nav-futureSelf', preferred: 'above', slug: 'futureSelf', href: '/future-self' },
  { key: 'nav-books', preferred: 'above', slug: 'books', href: '/books' },
  { key: 'profile', preferred: 'below', slug: 'profile', href: '/profile' },
  // No-target safety net: covers rewards / punishments / reset for
  // returning users whose targeted steps skipped above. Rendered as a
  // centered modal-style tooltip with no spotlight.
  { key: null, preferred: 'below', slug: 'moreFeatures' },
];

const PAD = 8; // Padding around the target rect for the spotlight ring.
const TOOLTIP_MARGIN = 12; // Gap between target and tooltip.
const TOOLTIP_MAX_WIDTH = 320;

export function Tutorial() {
  const t = useTranslations();
  const router = useRouter();
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
    /** Cutout bounds. `null` for no-target steps that render the
     *  tooltip as a centered modal with no spotlight. */
    bounds: DOMRect | null;
  } | null>(null);

  /** After the tooltip first paints we measure its actual height and
   *  nudge it upward if it overlaps the spotlight cutout (the
   *  pre-render math uses a fixed height guess, which routinely
   *  underestimates and caused tooltips to cover nav items on the
   *  user-reported bug). Stores an absolute Y to override the
   *  computed `tooltipTop` after first render. */
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [tooltipTopOverride, setTooltipTopOverride] = useState<number | null>(
    null,
  );
  // Reset the override whenever the target changes — the old override
  // was for the previous step and would be wrong for the new one.
  useEffect(() => {
    setTooltipTopOverride(null);
  }, [target?.step.key]);

  /** After the tooltip mounts (or its content changes), check whether
   *  its actual rendered rect overlaps the spotlight cutout. If it does,
   *  push it up enough that the bottom edge sits TOOLTIP_MARGIN above
   *  the cutout's top — that's the right answer for nav-item targets
   *  at the bottom of the screen, which was the reported failure mode.
   *  Only adjusts when the target is below the tooltip; for targets
   *  above the tooltip (e.g. the lives/ring at the top of Home), no
   *  correction is needed because the tooltip starts below them. */
  useLayoutEffect(() => {
    if (!target?.bounds) return;
    const el = tooltipRef.current;
    if (!el) return;
    const tooltipRect = el.getBoundingClientRect();
    const cutoutTop = target.bounds.top - PAD;
    const cutoutBottom = target.bounds.bottom + PAD;
    // Tooltip is supposed to be ABOVE the cutout (target is below
    // tooltip) — check the cutout-top boundary.
    if (
      tooltipRect.top < cutoutTop &&
      tooltipRect.bottom > cutoutTop - TOOLTIP_MARGIN
    ) {
      const newTop = Math.max(16, cutoutTop - TOOLTIP_MARGIN - tooltipRect.height);
      if (newTop !== tooltipTopOverride) setTooltipTopOverride(newTop);
      return;
    }
    // Tooltip is supposed to be BELOW the cutout — check the
    // cutout-bottom boundary.
    if (
      tooltipRect.bottom > cutoutBottom &&
      tooltipRect.top < cutoutBottom + TOOLTIP_MARGIN
    ) {
      const newTop = cutoutBottom + TOOLTIP_MARGIN;
      if (newTop !== tooltipTopOverride) setTooltipTopOverride(newTop);
    }
  }, [target, tooltipTopOverride]);

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
        // No-target step: render immediately with no bounds. The
        // tooltip renders as a centered modal in the no-bounds branch
        // below. Used as a catch-all for features that don't have a
        // single DOM target on Home.
        if (step.key === null) {
          setTarget({ step, bounds: null });
          return;
        }
        const el = document.querySelector<HTMLElement>(
          `[data-tutorial="${step.key}"]`,
        );
        if (!el) continue;
        let bounds = el.getBoundingClientRect();
        if (bounds.width === 0 && bounds.height === 0) continue;

        // Scroll into view if the target is off-screen or only partly in
        // view. For TALL targets (checklist, workspace section) `block:
        // 'start'` puts the top of the target near the top of the
        // viewport so the spotlight visibly starts from a real edge —
        // `block: 'center'` would put the middle of a tall list under
        // the tooltip, with no visible top boundary on the cutout. For
        // SHORT targets, 'center' is still best (tooltip has room on
        // both sides). The 60vh threshold separates the two cases.
        const vh = window.innerHeight;
        const margin = 80;
        const offTop = bounds.top < margin;
        const offBottom = bounds.bottom > vh - margin;
        const isTall = bounds.height > vh * 0.6;
        if (offTop || offBottom) {
          el.scrollIntoView({
            block: isTall ? 'start' : 'center',
            inline: 'nearest',
          });
          bounds = el.getBoundingClientRect();
        }

        // Clamp the cutout to a reasonable height when the target is
        // longer than the visible viewport. Without this, a 1500-px-tall
        // checklist becomes a 1500-px-tall cutout, which fills the
        // screen and leaves no visible dim area — the spotlight
        // disappears. Cap at ~viewport height minus a tooltip-sized
        // reserve, so the bottom of the cutout still falls inside the
        // visible area and the dim shoulder is obvious. Note: this is
        // a presentation-only clamp on `bounds` for the cutout; the
        // tooltip math below uses the same clamped value, so tooltip
        // placement stays consistent.
        const maxHeight = vh - 240; // leave room for the tooltip below
        if (bounds.height > maxHeight) {
          bounds = new DOMRect(
            bounds.left,
            bounds.top,
            bounds.width,
            maxHeight,
          );
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

  /** Navigate to the step's destination and finish the tour. Used by the
   *  per-step Open button. We finish (rather than pause-and-resume) on
   *  purpose: once the user has gone where the tour pointed them, the
   *  best UX is to let them explore — re-popping a coach-mark inside an
   *  unfamiliar screen would be jarring. They can always re-trigger the
   *  tutorial from Profile if they want a refresh. */
  const openHref = () => {
    if (!step.href) return;
    finish();
    router.push(step.href as any);
  };

  // Cutout pattern: an absolutely-positioned rectangle at the target's
  // bounds with a giant `box-shadow` extending outward. The shadow
  // covers the rest of the viewport in a dim colour while the cutout
  // itself stays transparent, so the highlighted element shows through
  // at full opacity. Adding `ring-4 ring-leaf-400` on the same div
  // gives the spotlight its glowing border. Skipped entirely for
  // no-target steps where `bounds === null` (full backdrop dim).
  const cutoutStyle: React.CSSProperties | null = bounds
    ? {
        top: bounds.top - PAD,
        left: bounds.left - PAD,
        width: bounds.width + PAD * 2,
        height: bounds.height + PAD * 2,
        boxShadow: '0 0 0 100vmax rgba(15, 23, 42, 0.7)',
      }
    : null;

  // Tooltip placement. For targeted steps: try preferred side, fall
  // back to the other if there isn't enough room. After the first
  // paint, the post-render measurement below corrects for the actual
  // tooltip height (the initial guess was overlapping nav items when
  // the body text was long). For no-target steps: centered modal.
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
  const tooltipHeightGuess = 240; // bumped from 180; long body + 3
  // buttons routinely exceeds 200px on mobile
  let tooltipTop: number;
  let tooltipLeft: number;
  if (bounds) {
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
    tooltipTop =
      side === 'below'
        ? Math.min(
            bounds.bottom + TOOLTIP_MARGIN,
            vh - tooltipHeightGuess - 16,
          )
        : Math.max(16, bounds.top - tooltipHeightGuess - TOOLTIP_MARGIN);
    tooltipLeft = Math.max(
      16,
      Math.min(
        vw - TOOLTIP_MAX_WIDTH - 16,
        bounds.left + bounds.width / 2 - TOOLTIP_MAX_WIDTH / 2,
      ),
    );
  } else {
    // Center the no-target modal.
    tooltipTop = Math.max(16, vh / 2 - tooltipHeightGuess / 2);
    tooltipLeft = Math.max(16, vw / 2 - TOOLTIP_MAX_WIDTH / 2);
  }
  // Apply the post-render correction if we've measured a real overlap.
  const effectiveTop = tooltipTopOverride ?? tooltipTop;

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
          The highlighted element shows through at full opacity. For
          no-target steps, render a plain backdrop instead so the
          centered modal still sits over a dimmed page. */}
      {cutoutStyle ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-2xl ring-4 ring-leaf-400 transition-all"
          style={cutoutStyle}
        />
      ) : (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-slate-900/70"
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        data-tutorial-tooltip
        className="absolute rounded-2xl bg-white p-4 shadow-2xl"
        style={{
          top: effectiveTop,
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
          {/* Tiny corner skip kept as a quick-out for power users, but
              the bottom row now carries the primary Skip / Next / Open
              actions in equal-weight buttons so the choice is obvious. */}
          <button
            type="button"
            onClick={finish}
            className="text-xs font-medium text-ink-400 underline-offset-4 hover:text-ink-700 hover:underline"
            aria-hidden
            tabIndex={-1}
          >
            ✕
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
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={finish}
            className="tap-44 rounded-xl px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100"
          >
            {t('tutorial.skip')}
          </button>
          {step.href && !isLast && (
            <Button type="button" variant="ghost" onClick={openHref}>
              {t('tutorial.open')}
            </Button>
          )}
          <Button type="button" onClick={next}>
            {isLast ? t('tutorial.start') : t('tutorial.next')}
          </Button>
        </div>
      </div>
    </div>
  );
}
