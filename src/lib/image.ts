/**
 * Resize a user-uploaded image to a small JPEG data URL suitable for
 * localStorage. Book covers cap at 240px wide so a shelf of 50 books stays
 * well under the typical 5–10MB localStorage budget.
 *
 * Browsers only — call from a client component.
 */
export async function fileToCoverDataUrl(file: File, maxWidth = 240): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const ratio = img.width > 0 ? Math.min(1, maxWidth / img.width) : 1;
    const w = Math.max(1, Math.round(img.width * ratio));
    const h = Math.max(1, Math.round(img.height * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context unavailable');
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.78);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('failed to load image'));
    img.src = src;
  });
}
