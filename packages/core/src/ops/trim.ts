import type { Mask, RasterImage } from '../types.js';
import { maskBBox, resampleMask } from './mask.js';
import { crop } from './crop.js';

export interface TrimOptions {
  /** Запас навколо суб'єкта як частка його більшої сторони. Типово 0. */
  readonly padding?: number;
  readonly threshold?: number;
}

/**
 * Обрізає порожні краї до прямокутника суб'єкта.
 *
 * На відміну від smartCrop не нав'язує співвідношення сторін: віддає рівно
 * те, що займає суб'єкт. Найкорисніше одразу після видалення фону, коли
 * навколо лишається широка прозора смуга.
 */
export function trim(img: RasterImage, mask: Mask, opts: TrimOptions = {}): RasterImage {
  const m = mask.width === img.width && mask.height === img.height
    ? mask
    : resampleMask(mask, img.width, img.height);

  const box = maskBBox(m, opts.threshold ?? 128);
  const grow = Math.round(Math.max(box.width, box.height) * (opts.padding ?? 0));

  return crop(img, {
    x: box.x - grow,
    y: box.y - grow,
    width: box.width + grow * 2,
    height: box.height + grow * 2,
  });
}
