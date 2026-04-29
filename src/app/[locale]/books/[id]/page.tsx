'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter, Link } from '@/i18n/routing';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ArrowBack } from '@/components/Chevron';
import { ClientGate } from '@/components/ClientGate';
import { BookCover } from '@/components/BookCover';
import { useAppStore } from '@/lib/store';
import { useNumberFormatter } from '@/lib/format';
import {
  estimatedDaysLeft,
  pagesRead,
  progressPercent,
  recentPace,
} from '@/lib/books';
import { todayKey } from '@/lib/dates';

export default function BookDetailPage() {
  return (
    <ClientGate>
      <BookDetail />
    </ClientGate>
  );
}

function BookDetail() {
  const t = useTranslations();
  const router = useRouter();
  const fmt = useNumberFormatter();
  const { id } = useParams<{ id: string }>();
  const book = useAppStore((s) => s.books.find((b) => b.id === id));
  const logBookPages = useAppStore((s) => s.logBookPages);
  const completeBook = useAppStore((s) => s.completeBook);
  const updateBook = useAppStore((s) => s.updateBook);
  const deleteBook = useAppStore((s) => s.deleteBook);

  const [today, setToday] = useState('');
  const [showCompletion, setShowCompletion] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [editing, setEditing] = useState(false);

  // Hydrate today's input from existing log.
  useEffect(() => {
    if (book) {
      const v = book.pagesByDate[todayKey()];
      setToday(v ? String(v) : '');
    }
  }, [book?.id]);

  if (!book) {
    return (
      <div className="space-y-3">
        <Link href="/books" className="text-leaf-700 underline">
          {t('common.back')}
        </Link>
      </div>
    );
  }

  const read = pagesRead(book);
  const pct = progressPercent(book);
  const left = Math.max(0, book.totalPages - read);
  const pace = recentPace(book);
  const daysLeft = estimatedDaysLeft(book);

  const onLog = () => {
    const n = Math.max(0, Math.floor(Number(today) || 0));
    logBookPages(book.id, n);
  };

  const onConfirmComplete = (
    rating: 1 | 2 | 3 | 4 | 5 | undefined,
    review: string,
    quote: string,
  ) => {
    completeBook(book.id, {
      rating,
      review: review.trim() || undefined,
      favouriteQuote: quote.trim() || undefined,
    });
    setShowCompletion(false);
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 1800);
  };

  return (
    <div className="space-y-4">
      <Link
        href="/books"
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"
      >
        <ArrowBack /> {t('books.title')}
      </Link>

      <header className="flex items-start gap-4">
        <BookCover book={book} size="lg" />
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-xl font-semibold leading-tight">{book.title}</h1>
          <p className="text-sm text-ink-600">{book.author}</p>
          <p className="text-xs text-ink-500">
            <span className="numeral">{fmt(book.totalPages)}</span>{' '}
            {t('books.field.totalPages').toLowerCase()} · {t(`books.format.${book.format}` as any)} ·{' '}
            {t(`books.category.${book.category}` as any)}
          </p>
          {book.status === 'completed' && book.rating && (
            <p className="numeral text-sm text-sand-600">
              {'★'.repeat(book.rating)}
              <span className="text-ink-300">{'★'.repeat(5 - book.rating)}</span>
            </p>
          )}
        </div>
      </header>

      {book.status === 'reading' && (
        <Card className="space-y-3">
          <div className="space-y-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
              <div
                className="h-full bg-leaf-500 transition-all"
                style={{ width: `${Math.round(pct * 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-ink-500">
              <span className="numeral">
                {t('books.progressShort', {
                  read: fmt(read),
                  total: fmt(book.totalPages),
                })}
              </span>
              <span className="numeral">
                {t('books.progressPercent', { n: fmt(Math.round(pct * 100)) })}
              </span>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-ink-700">{t('books.paceTitle')}</p>
            {daysLeft !== null && pace > 0 ? (
              <p className="text-sm text-ink-700">
                <span className="numeral">
                  {t('books.paceLine', {
                    daysLeft: fmt(daysLeft),
                    pace: fmt(Math.round(pace)),
                  })}
                </span>
              </p>
            ) : (
              <p className="text-sm text-ink-500">{t('books.paceUnknown')}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-ink-700">
              {t('books.logToday')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder={t('books.todayPlaceholder')}
                value={today}
                onChange={(e) => setToday(e.target.value)}
                className="numeral w-24 rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
              />
              <Button onClick={onLog} type="button">
                {t('books.logSave')}
              </Button>
            </div>
          </div>

          <Button
            variant="secondary"
            onClick={() => setShowCompletion(true)}
          >
            {t('books.markComplete')}
          </Button>
        </Card>
      )}

      {(book.whyReading || book.targetCompletionDate || book.startedAt) && (
        <Card className="space-y-2 text-sm text-ink-700">
          {book.whyReading && (
            <p>
              <span className="text-ink-500">{t('books.field.whyReading')}: </span>
              {book.whyReading}
            </p>
          )}
          {book.targetCompletionDate && (
            <p className="numeral">
              {t('books.targetEta', { date: book.targetCompletionDate })}
            </p>
          )}
          <p className="numeral text-xs text-ink-500">
            {t('books.started', { date: book.startedAt.slice(0, 10) })}
            {book.completedAt && (
              <>
                {' · '}
                {t('books.completed', { date: book.completedAt.slice(0, 10) })}
              </>
            )}
          </p>
        </Card>
      )}

      {book.status === 'completed' && (book.review || book.favouriteQuote) && (
        <Card className="space-y-2 bg-sand-50">
          {book.review && (
            <div>
              <div className="text-xs uppercase tracking-wide text-sand-600">
                {t('books.review')}
              </div>
              <p className="text-sm text-ink-800">{book.review}</p>
            </div>
          )}
          {book.favouriteQuote && (
            <blockquote className="border-s-2 border-sand-400 ps-3 text-sm italic text-ink-700">
              {book.favouriteQuote}
            </blockquote>
          )}
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => setEditing(true)}>
          {t('books.edit')}
        </Button>
        <Button
          variant="ghost"
          className="text-red-600 hover:bg-red-50"
          onClick={() => {
            if (!confirm(t('books.confirmDelete'))) return;
            deleteBook(book.id);
            router.replace('/books');
          }}
        >
          {t('books.delete')}
        </Button>
      </div>

      {showCompletion && (
        <CompletionForm
          initial={{
            rating: book.rating,
            review: book.review ?? '',
            quote: book.favouriteQuote ?? '',
          }}
          onCancel={() => setShowCompletion(false)}
          onSave={onConfirmComplete}
        />
      )}

      {editing && (
        <EditBookForm
          book={book}
          onCancel={() => setEditing(false)}
          onSave={(patch) => {
            updateBook(book.id, patch);
            setEditing(false);
          }}
        />
      )}

      {showCelebration && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
          <div className="animate-pop rounded-2xl bg-leaf-600 px-6 py-4 text-2xl font-semibold text-white shadow-xl">
            {t('books.completionCelebration')}
          </div>
        </div>
      )}
    </div>
  );
}

function CompletionForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: { rating?: 1 | 2 | 3 | 4 | 5; review: string; quote: string };
  onCancel: () => void;
  onSave: (
    rating: 1 | 2 | 3 | 4 | 5 | undefined,
    review: string,
    quote: string,
  ) => void;
}) {
  const t = useTranslations();
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5 | undefined>(
    initial.rating,
  );
  const [review, setReview] = useState(initial.review);
  const [quote, setQuote] = useState(initial.quote);

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-ink-900/40 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-screen-sm overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl">
        <h2 className="text-lg font-semibold">{t('books.completeTitle')}</h2>
        <p className="pt-1 text-sm text-ink-500">{t('books.completeBody')}</p>

        <div className="mt-4 space-y-3">
          <div>
            <span className="block text-sm font-medium text-ink-700">
              {t('books.rating')}
            </span>
            <div className="mt-1 flex gap-1 text-2xl">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n as 1 | 2 | 3 | 4 | 5)}
                  className="tap-44 px-1"
                  aria-label={`${n}`}
                >
                  <span className={n <= (rating ?? 0) ? 'text-sand-500' : 'text-ink-300'}>
                    ★
                  </span>
                </button>
              ))}
            </div>
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-ink-700">
              {t('books.review')}
            </span>
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              rows={3}
              placeholder={t('books.reviewPlaceholder')}
              className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-ink-700">
              {t('books.favouriteQuote')}
            </span>
            <textarea
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              rows={3}
              placeholder={t('books.favouriteQuotePlaceholder')}
              className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
            />
          </label>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => onSave(rating, review, quote)}>
            {t('books.saveCompletion')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditBookForm({
  book,
  onCancel,
  onSave,
}: {
  book: ReturnType<typeof useAppStore.getState>['books'][number];
  onCancel: () => void;
  onSave: (patch: Partial<typeof book>) => void;
}) {
  const t = useTranslations();
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [totalPages, setTotalPages] = useState(String(book.totalPages));
  const [whyReading, setWhyReading] = useState(book.whyReading ?? '');
  const [targetDate, setTargetDate] = useState(book.targetCompletionDate ?? '');

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-ink-900/40 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-screen-sm overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl">
        <h2 className="text-lg font-semibold">{t('books.edit')}</h2>
        <div className="mt-3 space-y-3">
          <Input label={t('books.field.titleLabel')} value={title} onChange={setTitle} />
          <Input label={t('books.field.author')} value={author} onChange={setAuthor} />
          <Input
            label={t('books.field.totalPages')}
            type="number"
            value={totalPages}
            onChange={setTotalPages}
            numeral
          />
          <label className="block space-y-1">
            <span className="text-sm font-medium text-ink-700">
              {t('books.field.whyReading')}
            </span>
            <textarea
              value={whyReading}
              onChange={(e) => setWhyReading(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
            />
          </label>
          <Input
            label={t('books.field.targetDate')}
            type="date"
            value={targetDate}
            onChange={setTargetDate}
            numeral
          />
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => {
              const pages = Math.max(1, Math.floor(Number(totalPages) || book.totalPages));
              onSave({
                title: title.trim() || book.title,
                author: author.trim() || book.author,
                totalPages: pages,
                whyReading: whyReading.trim() || undefined,
                targetCompletionDate: targetDate || undefined,
              });
            }}
          >
            {t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
  numeral = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  numeral?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-ink-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${numeral ? 'numeral ' : ''}w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500`}
      />
    </label>
  );
}
