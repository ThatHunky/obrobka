import type { Mask, RasterImage, SmartCropOptions } from '../types.js';
import { maskBBox, resampleMask } from './mask.js';
import { crop } from './crop.js';

/**
 * Кадрує зображення під задане співвідношення, тримаючи суб'єкт у центрі.
 *
 * Суб'єкт визначається з маски — окрема модель детекції не потрібна.
 * Якщо потрібний кадр не влазить у зображення, він стискається до
 * максимально можливого із збереженням співвідношення.
 */
export function smartCrop(img: RasterImage, mask: Mask, opts: SmartCropOptions): RasterImage {
  if (opts.aspectRatio <= 0) {
    throw new RangeError(`Співвідношення має бути додатним, отримано ${opts.aspectRatio}`);
  }
  const m = mask.width === img.width && mask.height === img.height
    ? mask
    : resampleMask(mask, img.width, img.height);

  const box = maskBBox(m, opts.threshold ?? 128);
  const padding = opts.padding ?? 0.08;
  const grow = Math.max(box.width, box.height) * padding;

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  let w = box.width + grow * 2;
  let h = box.height + grow * 2;

  // Розтягуємо до потрібного співвідношення — тільки збільшуючи
  if (w / h < opts.aspectRatio) w = h * opts.aspectRatio;
  else h = w / opts.aspectRatio;

  // Стискаємо, якщо не влазить у зображення
  const scale = Math.min(1, img.width / w, img.height / h);
  w *= scale;
  h *= scale;

  // Тримаємо кадр у межах
  const x = Math.min(Math.max(cx - w / 2, 0), img.width - w);
  const y = Math.min(Math.max(cy - h / 2, 0), img.height - h);

  return crop(img, {
    x: Math.round(x), y: Math.round(y),
    width: Math.round(w), height: Math.round(h),
  });
}
