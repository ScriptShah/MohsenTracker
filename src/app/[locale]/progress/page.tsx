'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/Card';
import { ClientGate } from '@/components/ClientGate';
import { Heatmap } from '@/components/Heatmap';
import { useAppStore } from '@/lib/store';
import { dateKey } from '@/lib/dates';
import { isLogSuccessful } from '@/lib/streaks';
import { useNumberFormatter } from '@/lib/format';
import type { Category, Habit, HabitLog } from '@/domain/types';
import clsx from 'clsx';

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
  const categories = useAppStore((s) => s.categories);
  const logs = useAppStore((s) => s.logs);
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

      <CategoryStrengths
        habits={habits}
        categories={categories}
        logs={logs}
      />

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

interface StrengthRow {
  category: Category;
  rate: number;
  habitCount: number;
}

const STRENGTH_WINDOW_DAYS = 30;

/** Per-category strength: average daily completion rate over the last
 *  STRENGTH_WINDOW_DAYS for habits that exist in this category. The
 *  GitHub-language-stats vibe — lets the user instantly see where they're
 *  strong vs where they're slipping. */
function CategoryStrengths({
  habits,
  categories,
  logs,
}: {
  habits: Habit[];
  categories: Category[];
  logs: Record<string, Record<string, HabitLog>>;
}) {
  const t = useTranslations();
  const fmt = useNumberFormatter();

  const rows: StrengthRow[] = useMemo(() => {
    const today = new Date();
    const dates: string[] = [];
    for (let i = 0; i < STRENGTH_WINDOW_DAYS; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(dateKey(d));
    }
    return categories
      .filter((c) => c.isActive)
      .map((c) => {
        const inCat = habits.filter((h) => h.categoryId === c.id);
        if (inCat.length === 0) return { category: c, rate: 0, habitCount: 0 };
        let perHabitSum = 0;
        for (const h of inCat) {
          const created = new Date(h.createdAt);
          let completed = 0;
          let valid = 0;
          for (const k of dates) {
            const day = new Date(k);
            if (day < created) continue;
            valid += 1;
            if (isLogSuccessful(h, logs[k]?.[h.id])) completed += 1;
          }
          perHabitSum += valid === 0 ? 0 : completed / valid;
        }
        return {
          category: c,
          rate: perHabitSum / inCat.length,
          habitCount: inCat.length,
        };
      })
      .filter((r) => r.habitCount > 0)
      .sort((a, b) => b.rate - a.rate);
  }, [habits, categories, logs]);

  if (rows.length === 0) return null;

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-sm font-medium text-ink-700">
          {t('progress.strengths.title')}
        </h2>
        <p className="text-xs text-ink-500">{t('progress.strengths.body')}</p>
      </div>
      {rows.length >= 3 ? (
        <CategoryRadar rows={rows} />
      ) : (
        <CategoryBars rows={rows} />
      )}
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 text-xs">
        {rows.map(({ category, rate }) => {
          const pct = Math.round(rate * 100);
          const tier = strengthTier(rate);
          return (
            <li key={category.id} className="flex items-center justify-between">
              <span className="flex items-center gap-1 truncate">
                <span aria-hidden>{category.icon}</span>
                <span className="truncate">{category.name}</span>
              </span>
              <span className={clsx('numeral font-semibold', tierTextClass(tier))}>
                {fmt(pct)}%
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** GitHub-style activity-overview radar — one axis per active category,
 *  polygon plots the user's last-30-days completion rate per axis. */
function CategoryRadar({ rows }: { rows: StrengthRow[] }) {
  const fmt = useNumberFormatter();
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 96;
  const labelRadius = radius + 22;

  const points = rows.map((row, i) => {
    const angle = (Math.PI * 2 * i) / rows.length - Math.PI / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      row,
      angle,
      x: cx + cos * radius * row.rate,
      y: cy + sin * radius * row.rate,
      axisX: cx + cos * radius,
      axisY: cy + sin * radius,
      labelX: cx + cos * labelRadius,
      labelY: cy + sin * labelRadius,
    };
  });

  const polygon = points.map((p) => `${p.x},${p.y}`).join(' ');
  const grid = [0.25, 0.5, 0.75, 1].map((level) =>
    rows
      .map((_, i) => {
        const a = (Math.PI * 2 * i) / rows.length - Math.PI / 2;
        return `${cx + Math.cos(a) * radius * level},${cy + Math.sin(a) * radius * level}`;
      })
      .join(' '),
  );

  return (
    <div className="flex justify-center">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-auto w-full max-w-[320px]"
        role="img"
      >
        {grid.map((g, i) => (
          <polygon
            key={i}
            points={g}
            fill="none"
            stroke="currentColor"
            className="text-ink-200"
            strokeWidth={1}
          />
        ))}
        {points.map((p, i) => (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.axisX}
            y2={p.axisY}
            stroke="currentColor"
            className="text-ink-200"
            strokeWidth={1}
          />
        ))}
        <polygon
          points={polygon}
          fill="rgb(16 185 129 / 0.22)"
          stroke="rgb(16 185 129)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3.5}
            fill="rgb(16 185 129)"
          />
        ))}
        {points.map((p, i) => {
          const anchor =
            p.labelX < cx - 4 ? 'end' : p.labelX > cx + 4 ? 'start' : 'middle';
          const pct = Math.round(p.row.rate * 100);
          return (
            <g key={i}>
              <text
                x={p.labelX}
                y={p.labelY - 4}
                textAnchor={anchor}
                className="fill-leaf-700 text-[12px] font-semibold"
                style={{ direction: 'ltr', unicodeBidi: 'isolate' }}
              >
                {fmt(pct)}%
              </text>
              <text
                x={p.labelX}
                y={p.labelY + 10}
                textAnchor={anchor}
                className="fill-current text-[11px]"
              >
                {p.row.category.icon} {shortLabel(p.row.category.name)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Compact bar fallback for users with fewer than 3 active categories. */
function CategoryBars({ rows }: { rows: StrengthRow[] }) {
  const t = useTranslations();
  const fmt = useNumberFormatter();
  return (
    <ul className="space-y-2">
      {rows.map(({ category, rate }) => {
        const pct = Math.round(rate * 100);
        const tier = strengthTier(rate);
        return (
          <li key={category.id} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5">
                <span aria-hidden>{category.icon}</span>
                <span className="font-medium">{category.name}</span>
              </span>
              <span className={clsx('numeral text-xs font-semibold', tierTextClass(tier))}>
                {fmt(pct)}%
                <span className="ms-1 text-[10px] font-normal text-ink-500">
                  {t(`progress.strengths.tier.${tier}` as any)}
                </span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
              <div
                className={clsx('h-full transition-all', tierBarClass(tier))}
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** First word of the category name, capped — keeps radar labels uncrowded. */
function shortLabel(name: string): string {
  const head = name.split(/\s+/)[0] ?? name;
  return head.length > 10 ? head.slice(0, 10) + '…' : head;
}

type Tier = 'strong' | 'medium' | 'weak' | 'empty';

function strengthTier(rate: number): Tier {
  if (rate <= 0) return 'empty';
  if (rate >= 0.7) return 'strong';
  if (rate >= 0.4) return 'medium';
  return 'weak';
}

function tierBarClass(tier: Tier): string {
  return tier === 'strong'
    ? 'bg-leaf-500'
    : tier === 'medium'
    ? 'bg-sand-400'
    : tier === 'weak'
    ? 'bg-red-500'
    : 'bg-ink-300';
}

function tierTextClass(tier: Tier): string {
  return tier === 'strong'
    ? 'text-leaf-700'
    : tier === 'medium'
    ? 'text-sand-700'
    : tier === 'weak'
    ? 'text-red-600'
    : 'text-ink-500';
}
