'use client';

import { Suspense } from 'react';
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
  const archiveCategory = useAppStore((s) => s.archiveCategory);

  if (!category) {
    return (
      <div>
        <Link href="/categories" className="text-leaf-700 underline">
          {t('common.back')}
        </Link>
      </div>
    );
  }

  // Spec §5.10: archive is soft — sets `archivedAt` + `isActive=false` so the
  // category disappears from the list but the habits + their logs survive.
  // The habits keep their categoryId pointing at the now-archived category;
  // home checklist still shows them. We warn the user in the confirm text so
  // they know what will happen.
  const onArchive = () => {
    const msg =
      habits.length > 0
        ? t('categories.archiveConfirmWithHabits', { n: fmt(habits.length) })
        : t('categories.archiveConfirm');
    if (!confirm(msg)) return;
    archiveCategory(category.id);
    router.replace('/categories');
  };

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
          onClick={onArchive}
          className="text-red-600 hover:bg-red-50"
        >
          {t('categories.archive')}
        </Button>
      </div>
    </div>
  );
}
