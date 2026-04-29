'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Card } from '@/components/Card';
import { ClientGate } from '@/components/ClientGate';
import { useAppStore } from '@/lib/store';

export default function CategoriesPage() {
  return (
    <ClientGate>
      <Categories />
    </ClientGate>
  );
}

function Categories() {
  const t = useTranslations();
  const categories = useAppStore((s) => s.categories.filter((c) => c.isActive));
  const habits = useAppStore((s) => s.habits);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t('categories.title')}</h1>
      <ul className="space-y-3">
        {categories.map((c) => {
          const count = habits.filter((h) => h.categoryId === c.id).length;
          return (
            <li key={c.id}>
              <Link href={`/categories/${c.id}`} className="block">
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
                  <span className="text-ink-400" aria-hidden>
                    ›
                  </span>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
