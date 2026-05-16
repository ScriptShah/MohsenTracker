'use client';

import { Suspense, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/routing';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ClientGate } from '@/components/ClientGate';
import { useAppStore } from '@/lib/store';
import { presetHabits, presetReplacements, seedCategories } from '@/domain/seed';
import type { PresetHabit } from '@/domain/seed';
import { useNumberFormatter } from '@/lib/format';
import { useUnitLabel } from '@/lib/units';

export default function NewHabitPage() {
  return (
    <ClientGate>
      <Suspense>
        <NewHabit />
      </Suspense>
    </ClientGate>
  );
}

function NewHabit() {
  const t = useTranslations();
  const router = useRouter();
  const search = useSearchParams();
  const initialCategoryId = search.get('categoryId') ?? '';
  const categories = useAppStore((s) => s.categories.filter((c) => c.isActive));
  const addHabit = useAppStore((s) => s.addHabit);

  const [name, setName] = useState('');
  const [type, setType] = useState<'good' | 'bad'>('good');
  const [categoryId, setCategoryId] = useState(initialCategoryId || categories[0]?.id || '');
  const [unit, setUnit] = useState('');
  const [target, setTarget] = useState('');
  const [limit, setLimit] = useState('');
  const [replacementName, setReplacementName] = useState('');
  const [positiveCargo, setPositiveCargo] = useState('');

  const canSubmit = name.trim().length > 0 && categoryId.length > 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    let replacementHabitId: string | undefined;
    if (type === 'bad' && replacementName.trim()) {
      const replacement = addHabit({
        categoryId,
        name: replacementName.trim(),
        type: 'good',
        frequency: 'daily',
      });
      replacementHabitId = replacement.id;
    }

    addHabit({
      categoryId,
      name: name.trim(),
      type,
      unit: unit.trim() || undefined,
      target: type === 'good' && target ? Number(target) : undefined,
      limit: type === 'bad' && limit ? Number(limit) : undefined,
      replacementHabitId,
      positiveCargo: type === 'bad' && positiveCargo.trim() ? positiveCargo.trim() : undefined,
      frequency: 'daily',
    });

    router.replace(initialCategoryId ? `/categories/detail?id=${initialCategoryId}` : '/');
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h1 className="text-xl font-semibold">{t('habit.newTitle')}</h1>

      <PresetPicker />

      <Card className="space-y-4">
        <Field label={t('habit.name')}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('habit.namePlaceholder')}
            maxLength={60}
            className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
            required
          />
        </Field>

        <Field label={t('habit.category')}>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 outline-none focus:border-leaf-500"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('habit.type')}>
          <div className="grid grid-cols-2 gap-2">
            <TypeChip
              active={type === 'good'}
              onClick={() => setType('good')}
              label={t('habit.typeGood')}
              tone="leaf"
            />
            <TypeChip
              active={type === 'bad'}
              onClick={() => setType('bad')}
              label={t('habit.typeBad')}
              tone="red"
            />
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('habit.unit')}>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder={t('habit.unitPlaceholder')}
              maxLength={20}
              className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
            />
          </Field>
          {type === 'good' ? (
            <Field label={t('habit.target')}>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100000}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="numeral w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
              />
            </Field>
          ) : (
            <Field label={t('habit.limit')}>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100000}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="numeral w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
              />
            </Field>
          )}
        </div>

        {type === 'bad' && (
          <>
            <Field label={t('habit.replacement')} hint={t('habit.replacementHint')}>
              <input
                value={replacementName}
                onChange={(e) => setReplacementName(e.target.value)}
                placeholder={t('habit.replacementPlaceholder')}
                maxLength={60}
                className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
              />
            </Field>
            <Field label={t('habit.cargoLabel')} hint={t('habit.cargoHint')}>
              <input
                value={positiveCargo}
                onChange={(e) => setPositiveCargo(e.target.value)}
                placeholder={t('habit.cargoPlaceholder')}
                maxLength={140}
                className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
              />
            </Field>
          </>
        )}

        <Field label={t('habit.startRitualLabel')} hint={t('habit.startRitualHint')}>
          <input
            value={startRitual}
            onChange={(e) => setStartRitual(e.target.value)}
            placeholder={t('habit.startRitualPlaceholder')}
            maxLength={140}
            className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
          />
        </Field>

        <Field label={t('habit.endRitualLabel')} hint={t('habit.endRitualHint')}>
          <input
            value={endRitual}
            onChange={(e) => setEndRitual(e.target.value)}
            placeholder={t('habit.endRitualPlaceholder')}
            maxLength={140}
            className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
          />
        </Field>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {t('habit.create')}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-sm font-medium text-ink-700">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}

function TypeChip({
  active,
  onClick,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone: 'leaf' | 'red';
}) {
  const activeClass =
    tone === 'leaf' ? 'border-leaf-500 bg-leaf-50 text-leaf-800' : 'border-red-500 bg-red-50 text-red-800';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap-44 rounded-xl border px-3 py-2 text-sm font-medium ${
        active ? activeClass : 'border-ink-200 bg-white text-ink-700'
      }`}
    >
      {label}
    </button>
  );
}

/** One-tap add for the seed habits the user doesn't already have. */
function PresetPicker() {
  const t = useTranslations();
  const router = useRouter();
  const search = useSearchParams();
  const initialCategoryId = search.get('categoryId') ?? '';
  const habits = useAppStore((s) => s.habits);
  const categories = useAppStore((s) => s.categories);
  const addHabit = useAppStore((s) => s.addHabit);
  const addCategory = useAppStore((s) => s.addCategory);
  const fmt = useNumberFormatter();
  const unitLabel = useUnitLabel();

  // Spec §23: when a preset has a 2-minute version, the picker pauses on a
  // size-choice card before adding. `pendingPreset` holds the preset under
  // review; null means no pending choice and chips behave as before.
  const [pendingPreset, setPendingPreset] = useState<PresetHabit | null>(null);

  const available = useMemo(() => {
    const haveByPreset = new Set(habits.map((h) => h.presetKey).filter(Boolean));
    return presetHabits.filter((p) => !haveByPreset.has(p.presetKey));
  }, [habits]);

  if (available.length === 0) return null;

  const resolveCategory = (preset: PresetHabit) => {
    let cat = categories.find((c) => c.key === preset.category && c.isActive);
    if (cat) return cat;
    // Auto-create the matching default category for existing users who
    // didn't have it (e.g. Sport when the user onboarded before it
    // existed). Falls back to any active category as a last resort.
    const seed = seedCategories.find((s) => s.key === preset.category);
    if (seed) {
      return addCategory({
        name: t(`categories.names.${seed.key}` as any),
        icon: seed.icon,
        color: seed.color,
        key: seed.key,
      });
    }
    return categories.find((c) => c.isActive);
  };

  const addPresetHabit = (
    preset: PresetHabit,
    options?: { replacementHabitId?: string; useTwoMinute?: boolean },
  ) => {
    const cat = resolveCategory(preset);
    if (!cat) return undefined;
    const useSmall = options?.useTwoMinute === true && preset.twoMinuteVersion !== undefined;
    const tmv = useSmall ? preset.twoMinuteVersion! : undefined;
    return addHabit({
      categoryId: cat.id,
      presetKey: preset.presetKey,
      name: tmv ? t(tmv.nameKey as any) : t(`presets.${preset.presetKey}` as any),
      type: preset.type,
      unit: tmv ? tmv.unit ?? preset.unit : preset.unit,
      target: tmv ? tmv.target : preset.target,
      limit: preset.limit,
      replacementHabitId: options?.replacementHabitId,
      isTwoMinuteVersion: useSmall ? true : undefined,
      frequency: 'daily',
    });
  };

  const goBackOrHome = () => {
    router.replace(initialCategoryId ? `/categories/detail?id=${initialCategoryId}` : '/');
  };

  /** Add the preset (and a silent replacement pair for bad presets) and exit. */
  const commitPreset = (preset: PresetHabit, useTwoMinute: boolean) => {
    // Spec §5.7: bad-habit presets with a known good-habit counterpart get
    // paired silently. If the counterpart already exists, link to it; if
    // not, add it alongside the bad habit. No dialog — we don't interrupt
    // the picker flow.
    if (preset.type === 'bad') {
      const replacementKey = presetReplacements[preset.presetKey];
      if (replacementKey) {
        const existing = habits.find((h) => h.presetKey === replacementKey);
        if (existing) {
          addPresetHabit(preset, { replacementHabitId: existing.id, useTwoMinute });
          goBackOrHome();
          return;
        }
        const goodPreset = presetHabits.find((p) => p.presetKey === replacementKey);
        if (goodPreset) {
          // The replacement good habit defaults to its 2-minute size too,
          // for the same Atomic-Habits reason.
          const good = addPresetHabit(goodPreset, { useTwoMinute: true });
          addPresetHabit(preset, { replacementHabitId: good?.id, useTwoMinute });
          goBackOrHome();
          return;
        }
      }
    }

    addPresetHabit(preset, { useTwoMinute });
    goBackOrHome();
  };

  const onPick = (presetKey: string) => {
    const preset = presetHabits.find((p) => p.presetKey === presetKey);
    if (!preset) return;
    // Spec §23: target-based presets with a 2-minute alternative pause on
    // a size-choice card. Everything else (binary toggles, bad presets) is
    // a one-tap add as before.
    if (preset.twoMinuteVersion) {
      setPendingPreset(preset);
      return;
    }
    commitPreset(preset, false);
  };

  if (pendingPreset) {
    const tmv = pendingPreset.twoMinuteVersion!;
    const fullName = t(`presets.${pendingPreset.presetKey}` as any);
    const fullUnit = pendingPreset.unit;
    const tmvUnit = tmv.unit ?? pendingPreset.unit;
    return (
      <Card className="space-y-4 border-leaf-200 bg-gradient-to-br from-leaf-50 to-white">
        <div>
          <p className="text-xs uppercase tracking-wide text-leaf-700">
            {t('habit.twoMinuteStarter.eyebrow')}
          </p>
          <h2 className="pt-1 text-base font-semibold text-ink-800">
            {t('habit.twoMinuteStarter.title', { name: fullName })}
          </h2>
          <p className="pt-1 text-sm leading-relaxed text-ink-700">
            {t('habit.twoMinuteStarter.body')}
          </p>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => commitPreset(pendingPreset, true)}
            className="tap-44 block w-full rounded-2xl border-2 border-leaf-500 bg-white p-3 text-start shadow-sm transition hover:bg-leaf-50"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
                {t('habit.twoMinuteStarter.twoMinuteLabel')}
              </span>
              <span className="rounded-full bg-leaf-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                {t('habit.twoMinuteStarter.recommended')}
              </span>
            </div>
            <p className="pt-1 text-base font-medium text-ink-800">
              {t(tmv.nameKey as any)}
            </p>
            <p className="numeral pt-0.5 text-xs text-ink-500">
              {t('habit.twoMinuteStarter.targetLine', {
                value: fmt(tmv.target),
                unit: unitLabel(tmvUnit ?? ''),
              })}
            </p>
          </button>

          <button
            type="button"
            onClick={() => commitPreset(pendingPreset, false)}
            className="tap-44 block w-full rounded-2xl border border-ink-200 bg-white p-3 text-start transition hover:border-ink-300"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {t('habit.twoMinuteStarter.fullLabel')}
            </span>
            <p className="pt-1 text-base font-medium text-ink-800">{fullName}</p>
            {pendingPreset.target !== undefined && (
              <p className="numeral pt-0.5 text-xs text-ink-500">
                {t('habit.twoMinuteStarter.targetLine', {
                  value: fmt(pendingPreset.target),
                  unit: unitLabel(fullUnit ?? ''),
                })}
              </p>
            )}
          </button>
        </div>

        <div className="flex items-center justify-end">
          <Button type="button" variant="ghost" onClick={() => setPendingPreset(null)}>
            {t('common.cancel')}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-ink-800">
          {t('habit.presetsTitle')}
        </h2>
        <p className="text-xs text-ink-500">{t('habit.presetsBody')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {available.map((p) => (
          <button
            key={p.presetKey}
            type="button"
            onClick={() => onPick(p.presetKey)}
            className="tap-44 rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-leaf-400 hover:text-leaf-700"
          >
            + {t(`presets.${p.presetKey}` as any)}
          </button>
        ))}
      </div>
    </Card>
  );
}
