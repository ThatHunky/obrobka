import type { Mask, RasterImage } from '../types.js';
import { resampleMask } from './mask.js';

/**
 * Множить альфу зображення на маску.
 *
 * Маска приходить у роздільності моделі (320² чи 1024²), тож майже завжди
 * потребує масштабування. Робимо це тут, а не на боці адаптера: так
 * реалізація сегментатора лишається тонкою, а логіка — у ядрі.
 */
export function applyMask(img: RasterImage, mask: Mask): RasterImage {
  const m = mask.width === img.width && mask.height === img.height
    ? mask
    : resampleMask(mask, img.width, img.height);

  const data = new Uint8ClampedArray(img.data);
  for (let i = 0, p = 3; i < m.data.length; i++, p += 4) {
    data[p] = (data[p]! * m.data[i]!) / 255;
  }
  return { data, width: img.width, height: img.height };
}
