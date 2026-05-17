'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from './Button';

/** Confirmation sheet that pops when the user taps "End fast" on an active
 *  autophagy fast. Explicit prompt for the feeling rather than a silent
 *  end — otherwise a quick tap on End loses the reflection the user might
 *  have intended to write.
 *
 *  Cancel returns to the active fast (no state change). Confirm calls
 *  onConfirm with the trimmed notes (undefined if empty) and the parent
 *  closes the fast. An explicit "End without notes" link lets the user
 *  bypass the textarea when they genuinely have nothing to add.
 */
export function EndAutophagySheet({
  onCancel,
  onConfirm,
  initialNotes,
}: {
  onCancel: () => void;
  onConfirm: (notes: string | undefined) => void;
  initialNotes?: string;
}) {
  const t = useTranslations();
  const [notes, setNotes] = useState(initialNotes ?? '');

  const submit = () => {
    const trimmed = notes.trim();
    onConfirm(trimmed.length > 0 ? trimmed : undefined);
  };

  const submitWithout = () => {
    onConfirm(undefined);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink-900/40 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="max-h-[90vh] w-full max-w-screen-sm overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-ink-900">
          {t('autophagy.endSheet.title')}
        </h2>
        <p className="pt-1 text-sm text-ink-600">
          {t('autophagy.endSheet.body')}
        </p>

        <label className="mt-4 block space-y-1.5">
          <span className="text-sm font-medium text-ink-700">
            {t('autophagy.endSheet.feelingLabel')}
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('autophagy.endSheet.feelingPlaceholder')}
            maxLength={300}
            rows={4}
            autoFocus
            className="w-full rounded-xl border border-ink-200 px-3 py-2 text-sm outline-none focus:border-leaf-500"
          />
        </label>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t('autophagy.endSheet.cancel')}
          </Button>
          <button
            type="button"
            onClick={submitWithout}
            className="text-sm text-ink-500 underline-offset-4 hover:underline"
          >
            {t('autophagy.endSheet.endWithout')}
          </button>
          <Button type="button" onClick={submit}>
            {t('autophagy.endSheet.confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
