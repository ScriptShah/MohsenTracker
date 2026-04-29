import clsx from 'clsx';
import { forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={clsx(
        'tap-44 inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-leaf-600 text-white hover:bg-leaf-700 active:bg-leaf-800',
        variant === 'secondary' &&
          'border border-ink-200 bg-white text-ink-800 hover:border-ink-300 hover:bg-ink-50',
        variant === 'ghost' && 'text-ink-700 hover:bg-ink-100',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
        className,
      )}
      {...props}
    />
  );
});
