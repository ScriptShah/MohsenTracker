import type { Book, BookCategoryKey, BookFormat } from '@/domain/types';
import { dateKey } from './dates';

/** Audiobooks store *minutes* in pagesByDate / totalPages instead of pages.
 *  Use this helper everywhere so display + math stay consistent. */
export function isAudiobook(book: Book): boolean {
  return book.format === 'audiobook';
}

/** "pages" for physical/ebook, "minutes" for audiobook. */
export function bookUnit(book: Book): 'pages' | 'minutes' {
  return isAudiobook(book) ? 'minutes' : 'pages';
}

export function pagesRead(book: Book): number {
  return Object.values(book.pagesByDate).reduce((a, b) => a + b, 0);
}

export function progressPercent(book: Book): number {
  if (book.totalPages <= 0) return 0;
  return Math.min(1, Math.max(0, pagesRead(book) / book.totalPages));
}

/** Mean pages-per-day across the last `days` days that had any reading. */
export function recentPace(book: Book, days = 7): number {
  const today = new Date();
  let pages = 0;
  let active = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const p = book.pagesByDate[dateKey(d)];
    if (p && p > 0) {
      pages += p;
      active += 1;
    }
  }
  return active === 0 ? 0 : pages / active;
}

/** null when no recent activity to project from. */
export function estimatedDaysLeft(book: Book): number | null {
  const left = Math.max(0, book.totalPages - pagesRead(book));
  if (left === 0) return 0;
  const pace = recentPace(book);
  if (pace <= 0) return null;
  return Math.ceil(left / pace);
}

export function pagesReadInYear(books: Book[], year: number): number {
  let total = 0;
  for (const b of books) {
    if (isAudiobook(b)) continue;
    for (const [date, pages] of Object.entries(b.pagesByDate)) {
      if (parseInt(date.slice(0, 4), 10) === year) total += pages;
    }
  }
  return total;
}

/** Sum of audiobook minutes logged in the given year. */
export function audioMinutesInYear(books: Book[], year: number): number {
  let total = 0;
  for (const b of books) {
    if (!isAudiobook(b)) continue;
    for (const [date, minutes] of Object.entries(b.pagesByDate)) {
      if (parseInt(date.slice(0, 4), 10) === year) total += minutes;
    }
  }
  return total;
}

export function booksCompletedInYear(books: Book[], year: number): Book[] {
  return books.filter(
    (b) => b.completedAt && new Date(b.completedAt).getFullYear() === year,
  );
}

/** Rough estimate: ~2 minutes per page → hours. */
export function readingHoursEstimate(pages: number): number {
  return Math.round((pages * 2) / 60);
}

export function categoryBreakdown(
  books: Book[],
): Record<BookCategoryKey, number> {
  const acc: Record<string, number> = {};
  for (const b of books) {
    acc[b.category] = (acc[b.category] ?? 0) + 1;
  }
  return acc as Record<BookCategoryKey, number>;
}
