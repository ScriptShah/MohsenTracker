import clsx from 'clsx';

export function Card({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        'rounded-2xl border border-ink-200 bg-white p-4 shadow-sm',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
