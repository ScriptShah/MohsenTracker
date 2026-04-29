'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/Card';
import { ClientGate } from '@/components/ClientGate';
import { Heatmap } from '@/components/Heatmap';
import { useAppStore } from '@/lib/store';

export default function ProgressPage() {
  return (
    <ClientGate>
      <Progress />
    </ClientGate>
  );
}

function Progress() {
  const t = useTranslations();
  const summaries = useAppStore((s) => s.summaries);
  const habits = useAppStore((s) => s.habits);
  const streaks = useAppStore((s) => s.streaks);

  const ranked = [...habits]
    .map((h) => ({ habit: h, current: streaks[h.id]?.current ?? 0 }))
    .sort((a, b) => b.current - a.current);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t('progress.title')}</h1>

      <Card className="space-y-3">
        <h2 className="text-sm font-medium text-ink-700">{t('progress.yearHeatmap')}</h2>
        <Heatmap summaries={summaries} />
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-medium text-ink-700">{t('progress.streaks')}</h2>
        {ranked.length === 0 || ranked.every((r) => r.current === 0) ? (
          <p className="text-sm text-ink-500">{t('progress.noStreaks')}</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {ranked.map(({ habit, current }) => (
              <li key={habit.id} className="flex items-center justify-between py-2">
                <span className="font-medium">{habit.name}</span>
                <span className="numeral rounded-full bg-sand-100 px-2 py-0.5 text-xs text-sand-600">
                  🔥 {current}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
