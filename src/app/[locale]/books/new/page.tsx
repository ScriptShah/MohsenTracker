'use client';

import { Suspense, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter, Link } from '@/i18n/routing';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ArrowBack } from '@/components/Chevron';
import { ClientGate } from '@/components/ClientGate';
import { useAppStore } from '@/lib/store';
import { fileToCoverDataUrl } from '@/lib/image';
import type { BookCategoryKey, BookFormat } from '@/domain/types';

const CATEGORIES: BookCategoryKey[] = [
  'islamic',
  'selfImprovement',
  'fiction',
  'biography',
  'business',
  'science',
  'history',
  'other',
];

const FORMATS: BookFormat[] = ['physical', 'ebook', 'audiobook'];

export default function NewBookPage() {
  return (
    <ClientGate>
      <Suspense>
        <NewBook />
      </Suspense>
    </ClientGate>
  );
}

function NewBook() {
  const t = useTranslations();
  const router = useRouter();
  const search = useSearchParams();
  const addBook = useAppStore((s) => s.addBook);
  // When the new-book flow is opened from a specific reading habit (via the
  // book-log sheet or the habit's books section), the new book inherits that
  // habit so its daily pages count toward that habit's total.
  const initialHabitId = search.get('habitId') ?? undefined;
  const initialHabit = useAppStore((s) =>
    initialHabitId ? s.habits.find((h) => h.id === initialHabitId) : undefined,
  );

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [totalPages, setTotalPages] = useState('');
  const [category, setCategory] = useState<BookCategoryKey>('selfImprovement');
  const [format, setFormat] = useState<BookFormat>('physical');
  const [whyReading, setWhyReading] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [coverImage, setCoverImage] = useState<string | undefined>();
  const [coverError, setCoverError] = useState<string | null>(null);

  const canSubmit =
    title.trim() && author.trim() && Number(totalPages) > 0;

  const onCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverError(null);
    try {
      const url = await fileToCoverDataUrl(file);
      setCoverImage(url);
    } catch (err: any) {
      setCoverError(err?.message ?? 'failed');
    }
    // Reset the input so the same file can be re-picked.
    e.target.value = '';
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const book = addBook({
      title: title.trim(),
      author: author.trim(),
      totalPages: Math.max(1, Math.floor(Number(totalPages))),
      category,
      format,
      whyReading: whyReading.trim() || undefined,
      targetCompletionDate: targetDate || undefined,
      coverImage,
      habitId: initialHabit?.id,
    });
    router.replace(`/books/${book.id}`);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Link
        href="/books"
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"
      >
        <ArrowBack /> {t('books.title')}
      </Link>
      <h1 className="text-xl font-semibold">{t('books.newTitle')}</h1>

      <Card className="space-y-4">
        <Field label={t('books.field.titleLabel')}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
            required
            autoFocus
          />
        </Field>
        <Field label={t('books.field.author')}>
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            maxLength={100}
            className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
            required
          />
        </Field>
        <Field
          label={t(
            format === 'audiobook' ? 'books.field.totalMinutes' : 'books.field.totalPages',
          )}
        >
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={100000}
            value={totalPages}
            onChange={(e) => setTotalPages(e.target.value)}
            className="numeral w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('books.field.category')}>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as BookCategoryKey)}
              className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 outline-none focus:border-leaf-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`books.category.${c}` as any)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('books.field.format')}>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as BookFormat)}
              className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 outline-none focus:border-leaf-500"
            >
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {t(`books.format.${f}` as any)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={t('books.field.whyReading')}>
          <textarea
            value={whyReading}
            onChange={(e) => setWhyReading(e.target.value)}
            rows={3}
            placeholder={t('books.field.whyReadingPlaceholder')}
            maxLength={300}
            className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
          />
        </Field>
        <Field label={t('books.field.targetDate')}>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="numeral w-full rounded-xl border border-ink-200 bg-white px-3 py-2 outline-none focus:border-leaf-500"
          />
        </Field>
        <Field label={t('books.field.cover')}>
          <div className="flex items-start gap-3">
            {coverImage && (
              <img
                src={coverImage}
                alt=""
                className="h-24 w-16 rounded-md object-cover shadow-sm"
              />
            )}
            <div className="flex-1 space-y-2">
              <label className="tap-44 inline-flex cursor-pointer items-center justify-center rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm">
                {t('books.field.uploadCover')}
                <input
                  type="file"
                  accept="image/*"
                  onChange={onCoverChange}
                  className="hidden"
                />
              </label>
              {coverImage && (
                <button
                  type="button"
                  onClick={() => setCoverImage(undefined)}
                  className="block text-xs text-red-600 underline-offset-4 hover:underline"
                >
                  {t('books.field.removeCover')}
                </button>
              )}
              {coverError && (
                <p className="text-xs text-red-600">{coverError}</p>
              )}
            </div>
          </div>
        </Field>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {t('books.create')}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-ink-700">{label}</span>
      {children}
    </label>
  );
}
