'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from './Button';

/** Sheet that pops the moment a dopamine reset reaches its target days.
 *  The reset itself completes either way (the user reached the goal); the
 *  prompt's only job is to capture the optional reflection — what changed,
 *  what they learned, what's different now — so the user can look back on
 *  the result of each reset later.
 *
 *  Cancel still completes the reset, just without a reflection.
 */
export function ResetCompletionSheet({
  target,
  initialReflection,
  onConfirm,
  onSkip,
}: {
  /** The free-text label the user gave the reset ("Instagram", "Sugar", …). */
  target: string;
  /** Pre-fill when the user is editing an already-saved reflection. */
  initialReflection?: string;
  onConfirm: (reflection: string | undefined) => void;
  onSkip: () => void;
}) {
  const t = useTranslations();
  const [reflection, setReflection] = useState(initialReflection ?? '');

  const submit = () => {
    const trimmed = reflection.trim();
    onConfirm(trimmed.length > 0 ? trimmed : undefined);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink-900/40 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={onSkip}
    >
      <div
        className="max-h-[90vh] w-full max-w-screen-sm overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs uppercase tracking-wide text-leaf-700">
          {t('reset.completionSheet.eyebrow')}
        </p>
        <h2 className="pt-1 text-lg font-semibold text-ink-900">
          {t('reset.completionSheet.title', { target })}
        </h2>
        <p className="pt-1 text-sm leading-relaxed text-ink-600">
          {t('reset.completionSheet.body')}
        </p>

        <label className="mt-4 block space-y-1.5">
          <span className="text-sm font-medium text-ink-700">
            {t('reset.completionSheet.reflectionLabel')}
          </span>
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder={t('reset.completionSheet.reflectionPlaceholder')}
            maxLength={500}
            rows={5}
            autoFocus
            className="w-full rounded-xl border border-ink-200 px-3 py-2 text-sm outline-none focus:border-leaf-500"
          />
        </label>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-ink-500 underline-offset-4 hover:underline"
          >
            {t('reset.completionSheet.skip')}
          </button>
          <Button type="button" onClick={submit}>
            {t('reset.completionSheet.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
