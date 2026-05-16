'use client';

import { useTranslations } from 'next-intl';
import { Button } from './Button';

/** Spec §24.2: prompt that appears the moment a bad habit is logged as a
 *  slip. The user's pre-set positive cargo is paired with the Quranic anchor
 *  (11:114) so the slip is closed out with a good deed instead of left to
 *  spiral.
 */
export function CargoSlipSheet({
  cargo,
  onClose,
}: {
  cargo: string;
  onClose: () => void;
}) {
  const t = useTranslations();

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink-900/40 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-screen-sm overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-ink-900">
          {t('cargoSlip.title')}
        </h2>
        <p className="pt-1 text-sm text-ink-600">{t('cargoSlip.body')}</p>

        <div className="mt-4 rounded-xl border border-leaf-200 bg-leaf-50 p-4">
          <p className="text-xs uppercase tracking-wide text-leaf-700">
            {t('habitDetail.cargo.editLabel')}
          </p>
          <p className="pt-1 text-base font-medium leading-relaxed text-ink-800">
            {cargo}
          </p>
        </div>

        <div className="mt-4 rounded-xl border-s-2 border-sand-400 bg-sand-50 px-4 py-3">
          <p dir="rtl" lang="ar" className="text-base leading-relaxed text-ink-800">
            {t('cargoSlip.verseArabic')}
          </p>
          <p className="pt-1 text-sm text-ink-700">
            {t('cargoSlip.verseTranslation')}
          </p>
          <p className="pt-1 text-[11px] uppercase tracking-wide text-ink-500">
            {t('cargoSlip.verseSource')}
          </p>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('cargoSlip.dismiss')}
          </Button>
          <Button type="button" onClick={onClose}>
            {t('cargoSlip.done')}
          </Button>
        </div>
      </div>
    </div>
  );
}
