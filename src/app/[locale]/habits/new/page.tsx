'use client';

import { Suspense, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/routing';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ClientGate } from '@/components/ClientGate';
import { useAppStore } from '@/lib/store';
import { presetHabits, seedCategories } from '@/domain/seed';

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
      frequency: 'daily',
    });

    router.replace(initialCategoryId ? `/categories/${initialCategoryId}` : '/');
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
              className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
            />
          </Field>
          {type === 'good' ? (
            <Field label={t('habit.target')}>
              <input
                type="number"
                inputMode="numeric"
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
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="numeral w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
              />
            </Field>
          )}
        </div>

        {type === 'bad' && (
          <Field label={t('habit.replacement')} hint={t('habit.replacementHint')}>
            <input
              value={replacementName}
              onChange={(e) => setReplacementName(e.target.value)}
              placeholder={t('habit.replacementPlaceholder')}
              className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
            />
          </Field>
        )}
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

  const available = useMemo(() => {
    const haveByPreset = new Set(habits.map((h) => h.presetKey).filter(Boolean));
    return presetHabits.filter((p) => !haveByPreset.has(p.presetKey));
  }, [habits]);

  if (available.length === 0) return null;

  const onPick = (presetKey: string) => {
    const preset = presetHabits.find((p) => p.presetKey === presetKey);
    if (!preset) return;
    let cat = categories.find((c) => c.key === preset.category && c.isActive);
    if (!cat) {
      // Auto-create the matching default category for existing users who
      // didn't have it (e.g. Sport when the user onboarded before it
      // existed). Falls back to any active category as a last resort.
      const seed = seedCategories.find((s) => s.key === preset.category);
      if (seed) {
        cat = addCategory({
          name: t(`categories.names.${seed.key}` as any),
          icon: seed.icon,
          color: seed.color,
          key: seed.key,
        });
      } else {
        cat = categories.find((c) => c.isActive);
      }
    }
    if (!cat) return;
    addHabit({
      categoryId: cat.id,
      presetKey: preset.presetKey,
      name: t(`presets.${preset.presetKey}` as any),
      type: preset.type,
      unit: preset.unit,
      target: preset.target,
      limit: preset.limit,
      frequency: 'daily',
    });
    router.replace(initialCategoryId ? `/categories/${initialCategoryId}` : '/');
  };

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
