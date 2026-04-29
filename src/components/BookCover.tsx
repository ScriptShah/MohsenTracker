'use client';

import clsx from 'clsx';
import type { Book } from '@/domain/types';

interface Props {
  book: Pick<Book, 'title' | 'author' | 'coverImage'>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-20 w-14 text-[9px]',
  md: 'h-28 w-20 text-[10px]',
  lg: 'h-40 w-28 text-xs',
};

const GRADIENTS = [
  'bg-gradient-to-br from-leaf-600 to-leaf-800',
  'bg-gradient-to-br from-sand-500 to-sand-600',
  'bg-gradient-to-br from-ink-700 to-ink-900',
  'bg-gradient-to-br from-rose-500 to-rose-700',
  'bg-gradient-to-br from-sky-600 to-indigo-700',
];

function gradientFor(title: string): string {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

export function BookCover({ book, size = 'md', className }: Props) {
  if (book.coverImage) {
    return (
      <img
        src={book.coverImage}
        alt={book.title}
        className={clsx(
          'shrink-0 rounded-md object-cover shadow-sm',
          SIZES[size],
          className,
        )}
      />
    );
  }
  return (
    <div
      className={clsx(
        'shrink-0 rounded-md text-white shadow-sm flex flex-col justify-between p-2 leading-tight',
        SIZES[size],
        gradientFor(book.title),
        className,
      )}
      aria-label={book.title}
    >
      <span className="line-clamp-3 break-words font-semibold">{book.title}</span>
      <span className="line-clamp-1 break-words opacity-80">{book.author}</span>
    </div>
  );
}
