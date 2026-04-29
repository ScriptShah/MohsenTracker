'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Card } from '@/components/Card';
import { ChevronEnd } from '@/components/Chevron';
import { ClientGate } from '@/components/ClientGate';
import { BookCover } from '@/components/BookCover';
import { useAppStore } from '@/lib/store';
import { progressPercent, pagesRead } from '@/lib/books';
import { useNumberFormatter } from '@/lib/format';
import type { Book } from '@/domain/types';

export default function BooksPage() {
  return (
    <ClientGate>
      <BooksShelf />
    </ClientGate>
  );
}

function BooksShelf() {
  const t = useTranslations();
  const fmt = useNumberFormatter();
  const books = useAppStore((s) => s.books);

  const reading = books.filter((b) => b.status === 'reading');
  const completed = books
    .filter((b) => b.status === 'completed')
    .sort((a, b) =>
      (b.completedAt ?? '').localeCompare(a.completedAt ?? ''),
    );

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('books.title')}</h1>
          <p className="text-sm text-ink-500">{t('books.intro')}</p>
        </div>
        <Link
          href="/books/year"
          className="inline-flex items-center gap-1 text-sm text-leaf-700 underline-offset-4 hover:underline"
        >
          {t('books.yearReviewLink')} <ChevronEnd className="h-3.5 w-3.5" />
        </Link>
      </header>

      {reading.length > 5 && (
        <Card className="border-sand-200 bg-sand-50 text-sm text-sand-700">
          {t('books.tooManyActive')}
        </Card>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-800">
          {t('books.currentlyReading')}
        </h2>
        {reading.length === 0 ? (
          <p className="text-sm text-ink-500">{t('books.noActive')}</p>
        ) : (
          <ul className="space-y-2">
            {reading.map((b) => (
              <li key={b.id}>
                <ReadingRow book={b} fmt={fmt} t={t} />
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/books/new"
          className="tap-44 mt-2 flex items-center justify-center rounded-xl border-2 border-dashed border-ink-300 px-4 py-3 text-sm text-ink-600 hover:border-leaf-400 hover:text-leaf-700"
        >
          + {t('books.addBook')}
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-800">
          {t('books.completedShelf')}
        </h2>
        {completed.length === 0 ? (
          <p className="text-sm text-ink-500">{t('books.noCompleted')}</p>
        ) : (
          <ul className="grid grid-cols-4 gap-3 sm:grid-cols-5">
            {completed.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/books/${b.id}`}
                  className="flex flex-col items-center gap-1"
                >
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

function ReadingRow({
  book,
  fmt,
  t,
}: {
  book: Book;
  fmt: (n: number) => string;
  t: (k: string, vars?: Record<string, any>) => string;
}) {
  const read = pagesRead(book);
  const pct = progressPercent(book);
  return (
    <Link href={`/books/${book.id}`} className="block">
      <Card className="flex items-center gap-3 transition hover:border-ink-300">
        <BookCover book={book} size="sm" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="line-clamp-1 font-medium">{book.title}</div>
          <div className="line-clamp-1 text-xs text-ink-500">{book.author}</div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full bg-leaf-500 transition-all"
              style={{ width: `${Math.round(pct * 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-ink-500">
            <span className="numeral">
              {t('books.progressShort', { read: fmt(read), total: fmt(book.totalPages) })}
            </span>
            <span className="numeral">
              {t('books.progressPercent', { n: fmt(Math.round(pct * 100)) })}
            </span>
          </div>
        </div>
        <ChevronEnd className="h-4 w-4 shrink-0 text-ink-300" />
      </Card>
    </Link>
  );
}
