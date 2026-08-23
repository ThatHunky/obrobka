import type { Mask, PaintOptions, RasterImage } from '../types.js';
import { resampleMask } from './mask.js';

/** Зводить маску мазка до розміру кадру. */
function fitMask(mask: Mask | undefined, img: RasterImage): Mask | null {
  if (mask === undefined) return null;
  if (mask.width === img.width && mask.height === img.height) return mask;
  return resampleMask(mask, img.width, img.height);
}

/**
 * Ручна правка прозорості пензлем.
 *
 * Одне правило на обидва випадки: під `erase` альфа йде в нуль, під
 * `keep` — у 255, решта лишається як була. Без моделі альфа скрізь 255,
 * тож стирання просто вирізає дірки в будь-якому зображенні. З уже
 * знятим фоном альфу записала модель, тож повернення відновлює з'їдене,
 * а стирання прибирає те, що модель лишила зайвим.
 *
 * Кольорові канали не чіпаються — так само, як в applyMask. Саме тому
 * повернення й працює: під нульовою альфою лежить незайманий піксель
 * оригіналу, а не чорнота.
 *
 * Порядок теж має значення. Стирання йде перше: якщо людина стерла, а
 * потім передумала й повернула те саме місце, лишитись має повернуте.
 */
export function paint(img: RasterImage, opts: PaintOptions): RasterImage {
  const data = new Uint8ClampedArray(img.data);
  const erase = fitMask(opts.erase, img);
  const keep = fitMask(opts.keep, img);
  if (erase === null && keep === null) return { data, width: img.width, height: img.height };

  for (let p = 0, i = 3; p < img.width * img.height; p++, i += 4) {
    if (erase !== null) {
      const e = erase.data[p]!;
      if (e > 0) data[i] = Math.round(data[i]! * (1 - e / 255));
    }
    if (keep !== null) {
      const k = keep.data[p]!;
      if (k > 0) data[i] = Math.max(data[i]!, k);
    }
  }
  return { data, width: img.width, height: img.height };
}
