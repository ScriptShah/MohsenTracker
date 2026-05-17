'use client';

import clsx from 'clsx';

/** Small circular profile chip. Renders the user's photo when available,
 *  otherwise falls back to a coloured initials chip derived deterministically
 *  from their display name. Used in workspace member lists, member-pickers,
 *  and any future "see your circle" widgets.
 *
 *  Why initials over a generic silhouette: a recognisable 1-2 letter mark
 *  is faster to scan than identical placeholders, and works without
 *  external image loads (avatars from Google Auth photoURLs occasionally
 *  fail or 404 — the fallback path is the normal case for many users).
 */
export function Avatar({
  name,
  photoURL,
  size = 'sm',
  className,
}: {
  /** Display name — used for the initials fallback AND for the alt text. */
  name: string;
  /** Optional photo URL (typically from Firebase Auth `user.photoURL`). */
  photoURL?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClass = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-base',
  }[size];

  const bg = colourForName(name);

  if (photoURL) {
    return (
      <span
        className={clsx(
          'inline-flex shrink-0 overflow-hidden rounded-full',
          sizeClass,
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoURL}
          alt={name}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      </span>
    );
  }

  return (
    <span
      aria-label={name}
      title={name}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        sizeClass,
        bg,
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

function initialsOf(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '·';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Deterministic colour from a stable hash of the name, picked from the
 *  app's palette. Same name → same colour across renders + sessions. */
function colourForName(name: string): string {
  const palette = [
    'bg-leaf-500',
    'bg-sand-500',
    'bg-red-500',
    'bg-sky-500',
    'bg-purple-500',
    'bg-amber-500',
    'bg-emerald-500',
    'bg-rose-500',
    'bg-indigo-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length]!;
}
