'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { getIconPath, getTierName, isDiamond } from '@/lib/streakFire';

type Size = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_PX: Record<Size, number> = {
  sm: 32,
  md: 48,
  lg: 80,
  xl: 160,
};

/** Renders the streak-fire icon for a given tier (1-7). Animation is on
 *  only at size 'xl' by default — sm/md/lg are static thumbnails. The
 *  diamond shimmers (rotation) while the fire pulses (scale). Both
 *  animations honour `prefers-reduced-motion`. */
export function StreakFire({
  tier,
  size = 'md',
  animated,
}: {
  tier: number;
  size?: Size;
  animated?: boolean;
}) {
  const t = useTranslations();
  const name = getTierName(tier);
  const px = SIZE_PX[size];
  const shouldAnimate = animated ?? size === 'xl';
  const animClass = shouldAnimate
    ? isDiamond(tier)
      ? 'streak-diamond-shimmer'
      : 'streak-fire-pulse'
    : '';
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${animClass}`}
      style={{ width: px, height: px }}
    >
      <Image
        src={getIconPath(tier)}
        alt={t(`streakFire.tierNames.${name}` as any)}
        width={px}
        height={px}
        loading={size === 'sm' ? 'lazy' : 'eager'}
        priority={size === 'xl'}
        className="select-none"
        draggable={false}
      />
    </span>
  );
}
