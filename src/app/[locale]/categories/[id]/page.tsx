'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Card } from '@/components/Card';
import { ChevronEnd } from '@/components/Chevron';
import { ClientGate } from '@/components/ClientGate';
import { useAppStore } from '@/lib/store';
import { projectCompound } from '@/lib/compound';
import { useUnitLabel } from '@/lib/units';

export default function CategoryDetailPage() {
  return (
    <ClientGate>
      <CategoryDetail />
    </ClientGate>
  );
}

function CategoryDetail() {
  const t = useTranslations();
  const unitLabel = useUnitLabel();
  const { id } = useParams<{ id: string }>();
  const category = useAppStore((s) => s.categories.find((c) => c.id === id));
  const habits = useAppStore((s) => s.habits.filter((h) => h.categoryId === id));

  if (!category) {
    return (
      <div>
        <Link href="/categories" className="text-leaf-700 underline">
          {t('common.back')}
        </Link>
      </div>
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
        <h1 className="text-xl font-semibold">{category.name}</h1>
      </div>

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

      {habits.length === 0 ? (
        <p className="text-ink-500">{t('categories.noHabitsInCategory')}</p>
      ) : (
        <ul className="space-y-2">
          {habits.map((h) => {
            const proj = projectCompound(h);
            return (
              <li key={h.id}>
                <Link href={`/habits/${h.id}`} className="block">
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
    </div>
  );
}
