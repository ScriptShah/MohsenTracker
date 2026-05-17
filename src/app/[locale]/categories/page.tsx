'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ChevronEnd } from '@/components/Chevron';
import { ClientGate } from '@/components/ClientGate';
import { useAppStore } from '@/lib/store';
import { useNumberFormatter } from '@/lib/format';

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

export default function CategoriesPage() {
  return (
    <ClientGate>
      <Categories />
    </ClientGate>
  );
}

function Categories() {
  const t = useTranslations();
  const fmt = useNumberFormatter();
  const allCategories = useAppStore((s) => s.categories);
  const habits = useAppStore((s) => s.habits);
  const restoreCategory = useAppStore((s) => s.restoreCategory);
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const categories = useMemo(
    () => allCategories.filter((c) => c.isActive),
    [allCategories],
  );
  // Archived categories surface in a collapsed section so users can find and
  // restore them. Sorted by archived-at descending so the most-recent archive
  // appears first — the user's "I just deleted that, bring it back" mental
  // model wants the freshest one at the top.
  const archived = useMemo(
    () =>
      allCategories
        .filter((c) => !c.isActive)
        .sort((a, b) =>
          (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''),
        ),
    [allCategories],
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t('categories.title')}</h1>
      <ul className="space-y-3">
        {categories.map((c) => {
          const count = habits.filter((h) => h.categoryId === c.id).length;
          return (
            <li key={c.id}>
              <Link href={`/categories/detail?id=${c.id}`} className="block">
                <Card className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: c.color }}
                    aria-hidden
                  >
                    {c.icon}
                  </span>
                  <span className="flex-1">
                    <span className="block font-medium">{c.name}</span>
                    <span className="numeral block text-xs text-ink-500">
                      {count === 1
                        ? t('categories.habitsCountOne')
                        : t('categories.habitsCount', { n: count })}
                    </span>
                  </span>
                  <ChevronEnd className="h-4 w-4 text-ink-400" />
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>

      {adding ? (
        <NewCategoryForm onClose={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="tap-44 flex w-full items-center justify-center rounded-xl border-2 border-dashed border-ink-300 px-4 py-3 text-sm text-ink-600 hover:border-leaf-400 hover:text-leaf-700"
        >
          + {t('categories.addCustom')}
        </button>
      )}

      {archived.length > 0 && (
        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="text-sm text-ink-500 underline-offset-4 hover:text-ink-800 hover:underline"
          >
            {showArchived
              ? t('categories.hideArchived', { n: fmt(archived.length) })
              : t('categories.showArchived', { n: fmt(archived.length) })}
          </button>
          {showArchived && (
            <ul className="space-y-2">
              {archived.map((c) => (
                <li key={c.id}>
                  <Card className="flex items-center gap-3 border-ink-200 bg-ink-50/40">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full text-white opacity-70"
                      style={{ backgroundColor: c.color }}
                      aria-hidden
                    >
                      {c.icon}
                    </span>
                    <span className="flex-1 text-sm text-ink-700">{c.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-xs"
                      onClick={() => restoreCategory(c.id)}
                    >
                      {t('categories.restore')}
                    </Button>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function NewCategoryForm({ onClose }: { onClose: () => void }) {
  const t = useTranslations();
  const addCategory = useAppStore((s) => s.addCategory);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('✦');
  const [color, setColor] = useState(COLOR_PALETTE[0]);

  const canSave = name.trim().length > 0 && icon.trim().length > 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    addCategory({ name: name.trim(), icon: icon.trim(), color });
    onClose();
  };

  return (
    <form onSubmit={onSubmit}>
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-800">
            {t('categories.newTitle')}
          </h2>
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: color }}
            aria-hidden
          >
            {icon}
          </span>
        </div>

        <label className="block space-y-1">
          <span className="block text-xs font-medium text-ink-700">
            {t('categories.newName')}
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('categories.namePlaceholder')}
            maxLength={40}
            className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
            autoFocus
            required
          />
        </label>

        <div>
          <span className="block text-xs font-medium text-ink-700">
            {t('categories.newIcon')}
          </span>
          <div className="mt-1 flex items-center gap-2">
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value.slice(0, 2))}
              maxLength={2}
              className="w-14 rounded-xl border border-ink-200 px-3 py-2 text-center text-lg outline-none focus:border-leaf-500"
            />
            <div className="flex flex-wrap gap-1">
              {ICON_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setIcon(s)}
                  className="tap-44 flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 text-base hover:border-leaf-400"
                  aria-label={s}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <span className="block text-xs font-medium text-ink-700">
            {t('categories.newColor')}
          </span>
          <div className="mt-1 grid grid-cols-6 gap-2">
            {COLOR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={c}
                aria-pressed={color === c}
                className={`tap-44 h-10 w-10 rounded-full ring-offset-2 transition ${
                  color === c ? 'ring-2 ring-leaf-500' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={!canSave}>
            {t('categories.create')}
          </Button>
        </div>
      </Card>
    </form>
  );
}
