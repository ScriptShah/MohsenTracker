'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from './Button';
import { BookCover } from './BookCover';
import { useAppStore } from '@/lib/store';
import { todayKey } from '@/lib/dates';
import { isAudiobook, pagesRead, progressPercent } from '@/lib/books';
import { useNumberFormatter } from '@/lib/format';
import type { Book } from '@/domain/types';

export function BookLogSheet({
  onClose,
  habitId,
}: {
  onClose: () => void;
  /** When set, the sheet shows only books linked to this habit (plus any
   *  unattached books — they're fair game until the user assigns them). */
  habitId?: string;
}) {
  const t = useTranslations();
  const fmt = useNumberFormatter();
  const reading = useAppStore((s) =>
    s.books.filter((b) => {
      if (b.status !== 'reading') return false;
      if (!habitId) return true;
      return b.habitId === habitId || b.habitId === undefined;
    }),
  );
  const addBookHref = habitId ? `/books/new?habitId=${habitId}` : '/books/new';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink-900/40 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-screen-sm overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{t('books.logSheet.title')}</h2>
        <p className="pt-1 text-sm text-ink-500">
          {t('books.logSheet.body')}
        </p>

        <ul className="mt-4 space-y-3">
          {reading.length === 0 ? (
            <li className="rounded-xl border border-dashed border-ink-200 p-3 text-sm text-ink-500">
              {t('books.logSheet.noActive')}
            </li>
          ) : (
            reading.map((b) => (
              <li key={b.id}>
                <BookRow book={b} fmt={fmt} onSaved={onClose} />
              </li>
            ))
          )}
        </ul>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Link
            href={addBookHref}
            onClick={onClose}
            className="tap-44 inline-flex items-center justify-center rounded-xl border-2 border-dashed border-ink-300 px-3 py-2 text-sm text-ink-600 hover:border-leaf-400 hover:text-leaf-700"
          >
            + {t('books.addBook')}
          </Link>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function BookRow({
  book,
  fmt,
  onSaved,
}: {
  book: Book;
  fmt: (n: number) => string;
  onSaved: () => void;
}) {
  const t = useTranslations();
  const logBookPages = useAppStore((s) => s.logBookPages);
  const today = todayKey();
  const audio = isAudiobook(book);
  const [value, setValue] = useState<string>(() => {
    const v = book.pagesByDate[today];
    return v ? String(v) : '';
  });

  const read = pagesRead(book);
  const pct = progressPercent(book);
  const progressKey = audio ? 'books.progressShortMinutes' : 'books.progressShort';

  const onSave = () => {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    logBookPages(book.id, n);
    onSaved();
  };

  return (
    <div className="flex items-start gap-3 rounded-xl border border-ink-200 p-3">
      <BookCover book={book} size="sm" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="line-clamp-1 text-sm font-medium">{book.title}</div>
        <div className="line-clamp-1 text-xs text-ink-500">{book.author}</div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
          <div
            className="h-full bg-leaf-500 transition-all"
            style={{ width: `${Math.round(pct * 100)}%` }}
          />
        </div>
        <div className="numeral text-[11px] text-ink-500">
          {t(progressKey, { read: fmt(read), total: fmt(book.totalPages) })}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={t('books.todayPlaceholder')}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label={t(audio ? 'books.logTodayMinutes' : 'books.logToday')}
            className="numeral w-20 rounded-xl border border-ink-200 px-3 py-2 text-sm outline-none focus:border-leaf-500"
          />
          <Button type="button" onClick={onSave}>
            {t('books.logSave')}
          </Button>
        </div>
        {audio && (
          <p className="text-[11px] text-ink-500">
            {t('books.logSheet.audiobookNote')}
          </p>
        )}
      </div>
    </div>
  );
}
