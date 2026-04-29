'use client';

import { useTranslations } from 'next-intl';
import clsx from 'clsx';
import { heatmapGrid } from '@/lib/dates';
import type { DailySummary } from '@/domain/types';

interface Props {
  summaries: Record<string, DailySummary>;
}

const SCALE = [
  'bg-ink-100',
  'bg-leaf-200',
  'bg-leaf-400',
  'bg-leaf-600',
  'bg-leaf-800',
];

function bucket(rate: number | undefined): number {
  if (rate === undefined || rate <= 0) return 0;
  if (rate < 0.26) return 1;
  if (rate < 0.51) return 2;
  if (rate < 0.76) return 3;
  return 4;
}

export function Heatmap({ summaries }: Props) {
  const t = useTranslations('progress');
  const grid = heatmapGrid();

  return (
    <div className="space-y-2">
      <div
        className="overflow-x-auto"
        // The grid itself is naturally LTR (a calendar progresses by date) — keep it so even in RTL.
        dir="ltr"
      >
        <div className="inline-grid grid-flow-col grid-rows-7 gap-[2px] p-1">
          {grid.flat().map((dateKey, idx) => {
            if (!dateKey) {
              return <div key={idx} className="h-3 w-3" />;
            }
            const rate = summaries[dateKey]?.completionRate;
            return (
              <div
                key={dateKey}
                title={`${dateKey}: ${
                  rate === undefined ? '—' : Math.round(rate * 100) + '%'
                }`}
                className={clsx('h-3 w-3 rounded-[3px]', SCALE[bucket(rate)])}
              />
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 text-[10px] text-ink-500">
        <span>{t('less')}</span>
        {SCALE.map((c, i) => (
          <span key={i} className={clsx('h-3 w-3 rounded-[3px]', c)} />
        ))}
        <span>{t('more')}</span>
      </div>
    </div>
  );
}
