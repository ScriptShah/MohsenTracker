'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ChevronEnd } from '@/components/Chevron';
import { ClientGate } from '@/components/ClientGate';
import { useAppStore } from '@/lib/store';
import { projectCompound } from '@/lib/compound';
import { useUnitLabel } from '@/lib/units';
import { useNumberFormatter } from '@/lib/format';
import type { Category } from '@/domain/types';

// Same palette + emoji set the new-category form on /categories uses.
// Kept duplicated rather than extracted into a shared module — the lists
// are short, change rarely, and keeping the file self-contained makes
// review easier.
const COLOR_PALETTE = [
  '#0ea5e9', // sky
  '#6366f1', // indigo
  '#7c3aed', // purple
  '#ec4899', // pink
  '#ef4444', // red
  '#f59e0b', // amber
  '#84cc16', // lime
  '#16a34a', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#64748b', // slate
  '#a855f7', // violet
];

const ICON_SUGGESTIONS = ['✦', '◆', '◐', '☀', '☾', '✺', '⚑', '♥', '☘', '◇'];

export default function CategoryDetailPage() {
  // See note on /books/detail — useSearchParams needs a Suspense boundary
  // in Next.js 14 to avoid bailing the whole route to client rendering.
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <CategoryDetail />
      </Suspense>
    </ClientGate>
  );
}

function CategoryDetail() {
  const t = useTranslations();
  const router = useRouter();
  const unitLabel = useUnitLabel();
  const fmt = useNumberFormatter();
  const id = useSearchParams().get('id') ?? '';
  const category = useAppStore((s) => s.categories.find((c) => c.id === id));
  const habits = useAppStore((s) => s.habits.filter((h) => h.categoryId === id));
  const deleteCategory = useAppStore((s) => s.deleteCategory);
  const updateCategory = useAppStore((s) => s.updateCategory);
  const [editing, setEditing] = useState(false);

  if (!category) {
    return (
      <div>
        <Link href="/categories" className="text-leaf-700 underline">
          {t('common.back')}
        </Link>
      </div>
    );
  }

  // Hard cascade delete (irreversible): drops the category AND every habit
  // inside it along with their logs, streaks, and any pending rewards or
  // active punishments tied to those habits. The confirm dialog spells out
  // the habit count so the user knows what they're erasing — the warning
  // text differs from the no-habit case so a careless tap on an empty
  // category doesn't read like a panic message.
  const onDelete = () => {
    const msg =
      habits.length > 0
        ? t('categories.deleteConfirmWithHabits', { n: fmt(habits.length) })
        : t('categories.deleteConfirmEmpty');
    if (!confirm(msg)) return;
    deleteCategory(category.id);
    router.replace('/categories');
  };

  if (editing) {
    return (
      <EditCategoryForm
        category={category}
        onCancel={() => setEditing(false)}
        onSave={(patch) => {
          updateCategory(category.id, patch);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: category.color }}
          aria-hidden
        >
          {category.icon}
        </span>
        <h1 className="flex-1 text-xl font-semibold">{category.name}</h1>
        <Button
          type="button"
          variant="ghost"
          className="text-xs"
          onClick={() => setEditing(true)}
        >
          {t('categories.edit')}
        </Button>
      </div>

      {category.key === 'islamic' && (
        <Card className="space-y-2 border-leaf-200 bg-gradient-to-br from-leaf-50 to-white">
          <p
            lang="ar"
            dir="rtl"
            className="text-end text-lg leading-loose text-ink-900"
            style={{ fontFamily: '"Amiri","Noto Naskh Arabic",serif' }}
          >
            {t('categories.islamicVerse.arabic')}
          </p>
          <p className="text-sm leading-relaxed text-ink-700">
            {t('categories.islamicVerse.translation')}
          </p>
          <p className="text-xs text-ink-500">
            — {t('categories.islamicVerse.source')}
          </p>
        </Card>
      )}

      {category.key === 'growth' && (
        <Link href="/books" className="block">
          <Card className="flex items-center gap-3 border-leaf-200 bg-leaf-50 transition hover:border-leaf-400">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full bg-leaf-600 text-white"
              aria-hidden
            >
              📚
            </span>
            <div className="flex-1">
              <div className="font-medium">{t('books.feature.categoryCardTitle')}</div>
              <div className="text-xs text-ink-600">
                {t('books.feature.categoryCardBody')}
              </div>
            </div>
            <ChevronEnd className="h-4 w-4 text-leaf-700" />
          </Card>
        </Link>
      )}

      {category.key === 'health' && (
        <div className="space-y-2">
          <Link href="/fasting" className="block">
            <Card className="flex items-center gap-3 border-leaf-200 bg-leaf-50 transition hover:border-leaf-400">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full bg-leaf-600 text-white"
                aria-hidden
              >
                🌙
              </span>
              <div className="flex-1">
                <div className="font-medium">{t('fasting.categoryCardTitle')}</div>
                <div className="text-xs text-ink-600">
                  {t('fasting.categoryCardBody')}
                </div>
              </div>
              <ChevronEnd className="h-4 w-4 text-leaf-700" />
            </Card>
          </Link>
          <Link href="/autophagy" className="block">
            <Card className="flex items-center gap-3 border-leaf-200 bg-leaf-50 transition hover:border-leaf-400">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full bg-leaf-600 text-white"
                aria-hidden
              >
                ⏱
              </span>
              <div className="flex-1">
                <div className="font-medium">{t('autophagy.categoryCardTitle')}</div>
                <div className="text-xs text-ink-600">
                  {t('autophagy.categoryCardBody')}
                </div>
              </div>
              <ChevronEnd className="h-4 w-4 text-leaf-700" />
            </Card>
          </Link>
        </div>
      )}

      {category.key === 'finance' && (
        <div className="space-y-2">
          <Link href="/savings" className="block">
            <Card className="flex items-center gap-3 border-leaf-200 bg-leaf-50 transition hover:border-leaf-400">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full bg-leaf-600 text-white"
                aria-hidden
              >
                🪙
              </span>
              <div className="flex-1">
                <div className="font-medium">{t('savings.categoryCardTitle')}</div>
                <div className="text-xs text-ink-600">
                  {t('savings.categoryCardBody')}
                </div>
              </div>
              <ChevronEnd className="h-4 w-4 text-leaf-700" />
            </Card>
          </Link>
          <Link href="/debts" className="block">
            <Card className="flex items-center gap-3 border-leaf-200 bg-leaf-50 transition hover:border-leaf-400">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full bg-leaf-600 text-white"
                aria-hidden
              >
                💸
              </span>
              <div className="flex-1">
                <div className="font-medium">{t('debts.categoryCardTitle')}</div>
                <div className="text-xs text-ink-600">
                  {t('debts.categoryCardBody')}
                </div>
              </div>
              <ChevronEnd className="h-4 w-4 text-leaf-700" />
            </Card>
          </Link>
        </div>
      )}

      {habits.length === 0 ? (
        <p className="text-ink-500">{t('categories.noHabitsInCategory')}</p>
      ) : (
        <ul className="space-y-2">
          {habits.map((h) => {
            const proj = projectCompound(h);
            return (
              <li key={h.id}>
                <Link href={`/habits/detail?id=${h.id}`} className="block">
                  <Card className="flex items-start gap-3 transition hover:border-ink-300">
                    <span
                      className={`mt-1 inline-block h-2 w-2 rounded-full ${
                        h.type === 'good' ? 'bg-leaf-500' : 'bg-red-500'
                      }`}
                      aria-hidden
                    />
                    <div className="flex-1">
                      <div className="font-medium">{h.name}</div>
                      {h.unit && (
                        <div className="text-xs text-ink-500">
                          {h.type === 'good' && h.target !== undefined && (
                            <>
                              <span className="numeral">{h.target}</span> {unitLabel(h.unit)}
                            </>
                          )}
                          {h.type === 'bad' && h.limit !== undefined && (
                            <>
                              ≤ <span className="numeral">{h.limit}</span> {unitLabel(h.unit)}
                            </>
                          )}
                        </div>
                      )}
                      {h.type === 'good' && h.unit && proj.yearly > 0 && (
                        <div className="mt-1 text-xs text-leaf-700">
                          {t('compound.yearly', {
                            value: `${Math.round(proj.yearly).toLocaleString()} ${unitLabel(h.unit)}`,
                          })}
                        </div>
                      )}
                    </div>
                    <ChevronEnd className="h-4 w-4 text-ink-300" />
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        href={`/habits/new?categoryId=${category.id}`}
        className="tap-44 flex items-center justify-center rounded-xl border-2 border-dashed border-ink-300 px-4 py-3 text-sm text-ink-600 hover:border-leaf-400 hover:text-leaf-700"
      >
        + {t('categories.addHabit')}
      </Link>

      <div className="pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onDelete}
          className="border border-red-300 text-red-600 hover:border-red-400 hover:bg-red-50"
        >
          {t('categories.delete')}
        </Button>
      </div>
    </div>
  );
}

function EditCategoryForm({
  category,
  onCancel,
  onSave,
}: {
  category: Category;
  onCancel: () => void;
  onSave: (patch: { name: string; icon: string; color: string }) => void;
}) {
  const t = useTranslations();
  const [name, setName] = useState(category.name);
  const [icon, setIcon] = useState(category.icon);
  const [color, setColor] = useState(category.color);

  const canSave =
    name.trim().length > 0 &&
    icon.trim().length > 0 &&
    color.trim().length > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    onSave({ name: name.trim(), icon: icon.trim(), color });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: color }}
          aria-hidden
        >
          {icon}
        </span>
        <h1 className="text-xl font-semibold">{t('categories.editTitle')}</h1>
      </div>

      <Card className="space-y-4">
        <label className="block space-y-1">
          <span className="block text-sm font-medium text-ink-700">
            {t('categories.newName')}
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
            required
            autoFocus
          />
        </label>

        <div className="space-y-1">
          <span className="block text-sm font-medium text-ink-700">
            {t('categories.newIcon')}
          </span>
          <div className="flex flex-wrap gap-2">
            {ICON_SUGGESTIONS.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIcon(i)}
                className={`tap-44 flex h-10 w-10 items-center justify-center rounded-full border text-lg ${
                  icon === i
                    ? 'border-leaf-500 bg-leaf-50'
                    : 'border-ink-200 bg-white'
                }`}
                aria-pressed={icon === i}
              >
                {i}
              </button>
            ))}
          </div>
          <input
            value={icon}
            onChange={(e) => setIcon(e.target.value.slice(0, 2))}
            maxLength={2}
            className="numeral w-20 rounded-xl border border-ink-200 px-3 py-2 text-center outline-none focus:border-leaf-500"
            aria-label={t('categories.newIcon')}
          />
        </div>

        <div className="space-y-1">
          <span className="block text-sm font-medium text-ink-700">
            {t('categories.newColor')}
          </span>
          <div className="flex flex-wrap gap-2">
            {COLOR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`tap-44 h-9 w-9 rounded-full border-2 ${
                  color === c ? 'border-ink-900' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
                aria-label={c}
                aria-pressed={color === c}
              />
            ))}
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={!canSave}>
          {t('categories.save')}
        </Button>
      </div>
    </form>
  );
}
