import type { Mask, PaintOptions, RasterImage } from '../types.js';
import { resampleMask } from './mask.js';

/** Зводить маску мазка до розміру кадру. */
function fitMask(mask: Mask | undefined, width: number, height: number): Mask | null {
  if (mask === undefined) return null;
  if (mask.width === width && mask.height === height) return mask;
  return resampleMask(mask, width, height);
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
  apply(data, 4, 3, img.width, img.height, opts);
  return { data, width: img.width, height: img.height };
}

/**
 * Те саме правило, але для маски суб'єкта.
 *
 * Обведення, розумна обрізка й обрізка країв спираються на маску, а не на
 * альфу. Якби мазки міняли лише альфу, повернута рука лишалась би без
 * обведення й обрізалась би кадруванням, а стерта пляма — навпаки,
 * отримувала б обведення.
 */
export function paintMask(mask: Mask, opts: PaintOptions): Mask {
  const data = new Uint8ClampedArray(mask.data);
  apply(data, 1, 0, mask.width, mask.height, opts);
  return { data, width: mask.width, height: mask.height };
}

/** Правило пензля над одним каналом: альфою зображення чи самою маскою. */
function apply(
  data: Uint8ClampedArray, stride: number, offset: number,
  width: number, height: number, opts: PaintOptions,
): void {
  const erase = fitMask(opts.erase, width, height);
  const keep = fitMask(opts.keep, width, height);
  if (erase === null && keep === null) return;

  for (let p = 0, i = offset; p < width * height; p++, i += stride) {
    if (erase !== null) {
      const e = erase.data[p]!;
      if (e > 0) data[i] = Math.round(data[i]! * (1 - e / 255));
    }
    if (keep !== null) {
      const k = keep.data[p]!;
      if (k > 0) data[i] = Math.max(data[i]!, k);
    }
  }
}
