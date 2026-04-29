/**
 * Direction-aware chevrons. The SVGs are LTR by default and flip via Tailwind's
 * built-in `rtl:` variant when the document is `dir="rtl"` (next-intl sets this
 * on <html>). Literal `›`/`←` characters do not flip on their own, which is why
 * we use SVGs everywhere "next" / "back" hints appear.
 */

type Props = React.SVGProps<SVGSVGElement>;

export function ChevronEnd({ className = 'h-4 w-4', ...props }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
      className={`${className} rtl:-scale-x-100`}
      {...props}
    >
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowBack({ className = 'h-4 w-4', ...props }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
      className={`${className} rtl:-scale-x-100`}
      {...props}
    >
      <path
        d="M15 6l-6 6 6 6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
