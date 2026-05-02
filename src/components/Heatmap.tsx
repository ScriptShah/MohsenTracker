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
  const grid = heatmapGrid(); // grid[dow][week]

  // Build the cell list in COLUMN-major order so it lines up with the
  // CSS grid's `grid-flow-col` placement: items 0–6 fill column 1 top to
  // bottom (one week, Sun→Sat), items 7–13 fill column 2, etc.
  const cells: { key: string; dateKey: string | null }[] = [];
  const cols = grid[0]?.length ?? 0;
  const rows = grid.length;
  for (let week = 0; week < cols; week++) {
    for (let dow = 0; dow < rows; dow++) {
      const dateKey = grid[dow][week];
      cells.push({ key: `${week}-${dow}`, dateKey });
    }
  }

  return (
    <div className="space-y-2">
      <div
        className="overflow-x-auto"
        // The grid itself is naturally LTR (a calendar progresses by date) — keep it so even in RTL.
        dir="ltr"
      >
        <div className="inline-grid grid-flow-col grid-rows-7 gap-[2px] p-1">
          {cells.map(({ key, dateKey }) => {
            if (!dateKey) {
              return <div key={key} className="h-3 w-3" />;
            }
            const rate = summaries[dateKey]?.completionRate;
            return (
              <div
                key={key}
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
