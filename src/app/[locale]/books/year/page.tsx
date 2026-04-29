'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Card } from '@/components/Card';
import { ArrowBack } from '@/components/Chevron';
import { ClientGate } from '@/components/ClientGate';
import { BookCover } from '@/components/BookCover';
import { useAppStore } from '@/lib/store';
import { useNumberFormatter } from '@/lib/format';
import {
  booksCompletedInYear,
  categoryBreakdown,
  pagesReadInYear,
  readingHoursEstimate,
} from '@/lib/books';

export default function YearReviewPage() {
  return (
    <ClientGate>
      <YearReview />
    </ClientGate>
  );
}

function YearReview() {
  const t = useTranslations();
  const fmt = useNumberFormatter();
  const books = useAppStore((s) => s.books);

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const yearOptions = useMemo(() => {
    const yearsWithData = new Set<number>([currentYear]);
    for (const b of books) {
      if (b.completedAt) yearsWithData.add(new Date(b.completedAt).getFullYear());
      for (const date of Object.keys(b.pagesByDate)) {
        const y = parseInt(date.slice(0, 4), 10);
        if (!Number.isNaN(y)) yearsWithData.add(y);
      }
    }
    return [...yearsWithData].sort((a, b) => b - a);
  }, [books, currentYear]);

  const completed = booksCompletedInYear(books, year);
  const totalPages = pagesReadInYear(books, year);
  const hours = readingHoursEstimate(totalPages);
  const breakdown = categoryBreakdown(completed);

  return (
    <div className="space-y-5">
      <Link
        href="/books"
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"
      >
        <ArrowBack /> {t('books.title')}
      </Link>

      <header className="flex items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold leading-tight">
          {t('books.yearReview.title')}
        </h1>
        <label className="space-y-1 text-end">
          <span className="block text-xs uppercase tracking-wide text-ink-500">
            {t('books.yearReview.year')}
          </span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="numeral rounded-xl border border-ink-200 bg-white px-3 py-1.5 outline-none focus:border-leaf-500"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </header>

      <Card className="grid grid-cols-3 gap-3 bg-gradient-to-br from-leaf-50 to-white">
        <Stat
          big={fmt(completed.length)}
          label={
            completed.length === 1
              ? t('books.yearReview.totalsBooksOne')
              : t('books.yearReview.totalsBooks', { n: fmt(completed.length) })
          }
        />
        <Stat
          big={fmt(totalPages)}
          label={t('books.yearReview.totalsPages', { n: fmt(totalPages) })}
        />
        <Stat
          big={fmt(hours)}
          label={t('books.yearReview.totalsHours', { n: fmt(hours) })}
        />
      </Card>

      <Card className="bg-sand-50">
        <p className="leading-relaxed text-ink-800">
          {t('books.yearReview.compoundLine', {
            n: fmt(completed.length),
            decade: fmt(completed.length * 10),
          })}
        </p>
      </Card>

      {Object.keys(breakdown).length > 0 && (
        <Card className="space-y-2">
          <h2 className="text-sm font-semibold text-ink-800">
            {t('books.yearReview.categoryBreakdown')}
          </h2>
          <ul className="space-y-1.5">
            {(Object.entries(breakdown) as [keyof typeof breakdown, number][]).map(
              ([cat, count]) => {
                const pct = (count / completed.length) * 100;
                return (
                  <li key={cat} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span>{t(`books.category.${cat}` as any)}</span>
                      <span className="numeral text-ink-500">{fmt(count)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                      <div
                        className="h-full bg-leaf-500 transition-all"
                        style={{ width: `${Math.round(pct)}%` }}
                      />
                    </div>
                  </li>
                );
              },
            )}
          </ul>
        </Card>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-800">
          {t('books.yearReview.shelfTitle')}
        </h2>
        {completed.length === 0 ? (
          <p className="text-sm text-ink-500">{t('books.yearReview.noBooks')}</p>
        ) : (
          <ul className="grid grid-cols-4 gap-3 sm:grid-cols-5">
            {completed.map((b) => (
              <li key={b.id}>
                <Link href={`/books/${b.id}`} className="flex flex-col items-center gap-1">
                  <BookCover book={b} size="md" />
                  <span className="line-clamp-2 text-center text-[11px] text-ink-700">
                    {b.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ big, label }: { big: string; label: string }) {
  return (
    <div className="text-center">
      <div className="numeral text-2xl font-semibold text-ink-900">{big}</div>
      <div className="text-[11px] leading-tight text-ink-500">{label}</div>
    </div>
  );
}
