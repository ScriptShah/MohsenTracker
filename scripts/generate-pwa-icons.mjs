/**
 * Generate raster PWA icons from public/icon.svg.
 *
 * Required because:
 *  - iOS's apple-touch-icon must be PNG (SVG is unreliable < iOS 16.4 and
 *    when added to the home screen, Safari often falls back to a
 *    screenshot of the page if it can't decode the icon).
 *  - Android prefers explicit raster sizes in the manifest for the
 *    splash screen and launcher icon.
 *
 * Run via `npm run gen:icons` or automatically before `npm run build`.
 */

import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PUBLIC = 'public';
const src = readFileSync(join(PUBLIC, 'icon.svg'));

const TARGETS = [
  { name: 'apple-icon.png', size: 180 }, // iOS apple-touch-icon
  { name: 'icon-192.png', size: 192 },   // Android (small)
  { name: 'icon-512.png', size: 512 },   // Android (splash + maskable)
];

for (const { name, size } of TARGETS) {
  await sharp(src, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(join(PUBLIC, name));
  // eslint-disable-next-line no-console
  console.log(`✓ ${PUBLIC}/${name}`);
}
