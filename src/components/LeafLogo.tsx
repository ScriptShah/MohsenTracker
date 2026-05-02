/** Stylised green leaf logo. Two-tone (lighter blade, darker veins on
 *  the underside) so it reads at any size. Pure SVG — no asset, scales
 *  cleanly. Default size 40px; pass `size` to override. */
export function LeafLogo({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="MohsenTracker"
    >
      <defs>
        <linearGradient id="leafBlade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      {/* leaf blade */}
      <path
        d="M32 4
           C18 4 8 14 8 28
           C8 44 22 56 32 60
           C42 56 56 44 56 28
           C56 14 46 4 32 4 Z"
        fill="url(#leafBlade)"
      />
      {/* central vein */}
      <path
        d="M32 8 L32 58"
        stroke="#065f46"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* side veins */}
      <path
        d="M32 18 C24 22 20 26 18 32
           M32 28 C24 32 20 36 19 42
           M32 38 C26 42 23 46 22 50
           M32 18 C40 22 44 26 46 32
           M32 28 C40 32 44 36 45 42
           M32 38 C38 42 41 46 42 50"
        stroke="#065f46"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
      {/* stem */}
      <path
        d="M32 60 L32 62"
        stroke="#065f46"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
