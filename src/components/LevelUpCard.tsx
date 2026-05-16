'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { useAppStore } from '@/lib/store';
import { useNumberFormatter } from '@/lib/format';
import { useUnitLabel } from '@/lib/units';
import { presetFor } from '@/lib/twoMinute';
import type { Habit } from '@/domain/types';

/** Spec §23: surfaces once a 2-minute habit clears 30 days. Shows the full
 *  preset target the user is being invited to scale up to, plus a "stay at
 *  this size" escape hatch. The caller decides where to show this — Home
 *  surfaces the longest-streak eligible habit; the detail page shows it on
 *  its own habit. */
export function LevelUpCard({ habit, streak }: { habit: Habit; streak: number }) {
  const t = useTranslations();
  const fmt = useNumberFormatter();
  const unitLabel = useUnitLabel();
  const levelUpHabit = useAppStore((s) => s.levelUpHabit);
  const dismissLevelUpPrompt = useAppStore((s) => s.dismissLevelUpPrompt);

  const preset = presetFor(habit);
  if (!preset || preset.target === undefined) return null;
  const fullName = t(`presets.${preset.presetKey}` as any);
  const fullUnit = preset.unit;

  const onLevelUp = () => {
    levelUpHabit(habit.id, {
      name: fullName,
      target: preset.target,
      unit: fullUnit,
    });
  };

  return (
    <Card className="space-y-3 border-leaf-300 bg-gradient-to-br from-leaf-50 via-white to-sand-50">
      <div>
        <p className="text-xs uppercase tracking-wide text-leaf-700">
          {t('levelUp.eyebrow')}
        </p>
        <p className="numeral pt-1 text-base font-semibold leading-snug text-ink-900">
          {t('levelUp.title', { days: fmt(streak), habit: habit.name })}
        </p>
        <p className="pt-1 text-sm leading-relaxed text-ink-700">
          {t('levelUp.body')}
        </p>
      </div>

      <div className="rounded-xl border border-leaf-200 bg-white p-3">
        <p className="text-[11px] uppercase tracking-wide text-ink-500">
          {t('levelUp.scaleUpTo')}
        </p>
        <p className="pt-0.5 text-sm font-medium text-ink-800">{fullName}</p>
        <p className="numeral pt-0.5 text-xs text-ink-500">
          {t('levelUp.targetLine', {
            value: fmt(preset.target),
            unit: unitLabel(fullUnit ?? ''),
          })}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => dismissLevelUpPrompt(habit.id)}
        >
          {t('levelUp.stay')}
        </Button>
        <Button type="button" onClick={onLevelUp}>
          {t('levelUp.cta')}
        </Button>
      </div>
    </Card>
  );
}
