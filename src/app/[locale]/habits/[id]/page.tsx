'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, Link } from '@/i18n/routing';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ClientGate } from '@/components/ClientGate';
import { useAppStore } from '@/lib/store';
import { getNarrative } from '@/lib/projections';
import { useNumberFormatter } from '@/lib/format';

export default function HabitDetailPage() {
  return (
    <ClientGate>
      <HabitDetail />
    </ClientGate>
  );
}

function HabitDetail() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const habit = useAppStore((s) => s.habits.find((h) => h.id === id));
  const streak = useAppStore((s) => s.streaks[id]?.current ?? 0);
  const category = useAppStore((s) =>
    habit ? s.categories.find((c) => c.id === habit.categoryId) : undefined,
  );
  const deleteHabit = useAppStore((s) => s.deleteHabit);
  const setHabitCritical = useAppStore((s) => s.setHabitCritical);

  const fmt = useNumberFormatter();
  const [showStakes, setShowStakes] = useState(false);

  const narrative = useMemo(() => {
    if (!habit) return null;
    return getNarrative({ habit, t: (k, v) => t(k as any, v), fmt });
  }, [habit, t, fmt]);

  if (!habit) {
    return (
      <div className="space-y-3">
        <Link href="/categories" className="text-leaf-700 underline">
          {t('common.back')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href={category ? `/categories/${category.id}` : '/categories'}
        className="inline-flex items-center text-sm text-ink-500 hover:text-ink-800"
      >
        ← {category?.name ?? t('common.back')}
      </Link>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold leading-tight">{habit.name}</h1>
        <div className="flex items-center gap-3 text-sm text-ink-600">
          {streak > 0 ? (
            <span className="rounded-full bg-sand-100 px-2 py-1 text-sand-600">
              🔥{' '}
              <span className="numeral">{fmt(streak)}</span>{' '}
              {t('habitDetail.currentStreak').toLowerCase()}
            </span>
          ) : (
            <span className="text-ink-500">{t('habitDetail.noStreakYet')}</span>
          )}
          {habit.unit &&
            (habit.type === 'good' && habit.target !== undefined ? (
              <span className="text-ink-500">
                <span className="numeral">{fmt(habit.target)}</span> {habit.unit} / day
              </span>
            ) : habit.type === 'bad' && habit.limit !== undefined ? (
              <span className="text-ink-500">
                ≤ <span className="numeral">{fmt(habit.limit)}</span> {habit.unit} / day
              </span>
            ) : null)}
        </div>
      </header>

      {narrative && (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-ink-800">
            {showStakes ? t('habitDetail.atStake') : t('habitDetail.ifYouKeep')}
          </h2>
          <ul className="space-y-2 text-ink-700">
            {(showStakes ? narrative.consequenceLines : narrative.projectionLines).map(
              (line, i) => (
                <li key={i} className="flex gap-2">
                  <span
                    aria-hidden
                    className={`mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                      showStakes ? 'bg-red-500' : 'bg-leaf-500'
                    }`}
                  />
                  <span className="leading-relaxed">{line}</span>
                </li>
              ),
            )}
          </ul>
          <button
            type="button"
            onClick={() => setShowStakes((s) => !s)}
            className="text-sm font-medium text-leaf-700 underline-offset-4 hover:underline"
          >
            {showStakes ? t('habitDetail.showProjection') : t('habitDetail.showAtStake')}
          </button>
        </Card>
      )}

      {narrative?.hadith && (
        <Card className="border-sand-200 bg-sand-50">
          <p className="text-xs uppercase tracking-wide text-sand-600">
            {t('habitDetail.hadithLabel')}
          </p>
          <p className="pt-1 leading-relaxed text-ink-800">{narrative.hadith.text}</p>
          <p className="pt-2 text-xs text-ink-500">— {narrative.hadith.source}</p>
        </Card>
      )}

      <Card className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="text-sm font-medium text-ink-800">
            {t('habitDetail.criticalToggle')}
          </div>
          <p className="text-xs text-ink-500">{t('habitDetail.criticalHint')}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!!habit.isCritical}
          onClick={() => setHabitCritical(habit.id, !habit.isCritical)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${
            habit.isCritical ? 'bg-red-500' : 'bg-ink-200'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
              habit.isCritical ? 'start-[22px]' : 'start-0.5'
            }`}
            aria-hidden
          />
        </button>
      </Card>

      <div className="pt-2">
        <Button
          variant="ghost"
          onClick={() => {
            if (!confirm(t('habitDetail.deleteHabit') + '?')) return;
            deleteHabit(habit.id);
            router.replace(category ? `/categories/${category.id}` : '/');
          }}
          className="text-red-600 hover:bg-red-50"
        >
          {t('habitDetail.deleteHabit')}
        </Button>
      </div>
    </div>
  );
}
