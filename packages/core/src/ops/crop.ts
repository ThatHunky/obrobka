import type { RasterImage, Rect } from '../types.js';

/**
 * Вирізає прямокутник. Прямокутник обрізається до меж зображення,
 * тож вихідний розмір може бути меншим за запитаний.
 */
export function crop(img: RasterImage, rect: Rect): RasterImage {
  const x0 = Math.max(0, Math.round(rect.x));
  const y0 = Math.max(0, Math.round(rect.y));
  const x1 = Math.min(img.width, Math.round(rect.x + rect.width));
  const y1 = Math.min(img.height, Math.round(rect.y + rect.height));

  const width = x1 - x0;
  const height = y1 - y0;
  if (width < 1 || height < 1) {
    throw new RangeError(
      `Прямокутник (${rect.x}, ${rect.y}, ${rect.width}×${rect.height}) ` +
      `не перетинається із зображенням ${img.width}×${img.height}`,
    );
  }

  const data = new Uint8ClampedArray(width * height * 4);
  const rowBytes = width * 4;
  for (let y = 0; y < height; y++) {
    const srcStart = ((y0 + y) * img.width + x0) * 4;
    data.set(img.data.subarray(srcStart, srcStart + rowBytes), y * rowBytes);
  }
  return { data, width, height };
}
