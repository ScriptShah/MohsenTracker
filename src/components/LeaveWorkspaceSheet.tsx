'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from './Button';

/** Decision #8: leaving a workspace is a two-question flow, not a
 *  single-confirm dialog.
 *
 *  Q1: are you sure?
 *  Q2: what happens to your day-log history?
 *      - Archive: leave it in place. Other members can still see what
 *        you logged while you were a member. The default — least
 *        destructive.
 *      - Wipe: delete every log doc you wrote in this workspace. The
 *        record of your participation goes away. Useful when you
 *        regret joining or want a clean exit.
 *
 *  Both options also remove you from `memberUids` and delete your
 *  member subdoc. The library handles the wipe-then-leave ordering
 *  (rules require membership for log deletes, so wipe must run first).
 */
export type LeaveChoice = 'archive' | 'wipe';

export function LeaveWorkspaceSheet({
  workspaceTitle,
  onCancel,
  onConfirm,
}: {
  workspaceTitle: string;
  onCancel: () => void;
  onConfirm: (choice: LeaveChoice) => void | Promise<void>;
}) {
  const t = useTranslations();
  const [choice, setChoice] = useState<LeaveChoice>('archive');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    await onConfirm(choice);
    setBusy(false);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink-900/40 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-workspace-title"
      onClick={onCancel}
    >
      <div
        className="max-h-[90vh] w-full max-w-screen-sm overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="leave-workspace-title"
          className="text-lg font-semibold text-ink-900"
        >
          {t('workspaces.leaveSheet.title', { title: workspaceTitle })}
        </h2>
        <p className="pt-1 text-sm leading-relaxed text-ink-600">
          {t('workspaces.leaveSheet.body')}
        </p>

        <fieldset className="mt-4 space-y-2">
          <legend className="text-xs font-medium uppercase tracking-wide text-ink-500">
            {t('workspaces.leaveSheet.choiceLabel')}
          </legend>

          <Option
            value="archive"
            current={choice}
            onChange={setChoice}
            title={t('workspaces.leaveSheet.archiveTitle')}
            body={t('workspaces.leaveSheet.archiveBody')}
          />
          <Option
            value="wipe"
            current={choice}
            onChange={setChoice}
            title={t('workspaces.leaveSheet.wipeTitle')}
            body={t('workspaces.leaveSheet.wipeBody')}
          />
        </fieldset>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t('workspaces.leaveSheet.cancel')}
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={busy}
            className={
              choice === 'wipe'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : undefined
            }
          >
            {busy
              ? t('workspaces.leaveSheet.leaving')
              : choice === 'wipe'
              ? t('workspaces.leaveSheet.confirmWipe')
              : t('workspaces.leaveSheet.confirmArchive')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Option({
  value,
  current,
  onChange,
  title,
  body,
}: {
  value: LeaveChoice;
  current: LeaveChoice;
  onChange: (v: LeaveChoice) => void;
  title: string;
  body: string;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      aria-pressed={active}
      className={
        'tap-44 w-full rounded-xl border px-3 py-2 text-start transition ' +
        (active
          ? value === 'wipe'
            ? 'border-red-500 bg-red-50'
            : 'border-leaf-500 bg-leaf-50'
          : 'border-ink-200 bg-white hover:border-ink-300')
      }
    >
      <div
        className={
          'text-sm font-semibold ' +
          (active
            ? value === 'wipe'
              ? 'text-red-700'
              : 'text-leaf-800'
            : 'text-ink-900')
        }
      >
        {title}
      </div>
      <div className="text-xs text-ink-600">{body}</div>
    </button>
  );
}
