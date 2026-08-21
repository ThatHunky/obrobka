import { describe, expect, it } from 'vitest';
import { inverseOrientation, isOrientation, orient, type Orientation } from '../src/ops/orient.js';
import type { RasterImage } from '../src/types.js';
import { pixelAt } from './helpers.js';

const ALL: readonly Orientation[] = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Кожен піксель унікальний: значення каналів кодують координату.
 * Так будь-яке переставляння видно точно, а не «схоже на правду».
 */
function coordImage(width: number, height: number): RasterImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = x * 10 + 5;
      data[i + 1] = y * 10 + 5;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

describe('orient', () => {
  it('одиниця віддає той самий об’єкт, без копіювання', () => {
    const img = coordImage(4, 3);
    expect(orient(img, 1)).toBe(img);
  });

  it('повороти на чверть міняють сторони місцями', () => {
    const img = coordImage(8, 4);
    for (const o of [5, 6, 7, 8] as const) {
      const out = orient(img, o);
      expect([out.width, out.height], `орієнтація ${o}`).toEqual([4, 8]);
    }
    for (const o of [1, 2, 3, 4] as const) {
      const out = orient(img, o);
      expect([out.width, out.height], `орієнтація ${o}`).toEqual([8, 4]);
    }
  });

  it('поворот на 90° за годинниковою переносить лівий край угору', () => {
    const img = coordImage(8, 4);
    const out = orient(img, 6);
    // Верхній лівий піксель результату — це нижній лівий піксель джерела.
    expect(pixelAt(out, 0, 0)).toEqual(pixelAt(img, 0, 3));
    // Нижній лівий піксель результату — верхній лівий джерела.
    expect(pixelAt(out, 0, 7)).toEqual(pixelAt(img, 7, 3));
    expect(pixelAt(out, 3, 0)).toEqual(pixelAt(img, 0, 0));
  });

  it('поворот на 270° переносить правий край угору', () => {
    const img = coordImage(8, 4);
    const out = orient(img, 8);
    expect(pixelAt(out, 0, 0)).toEqual(pixelAt(img, 7, 0));
    expect(pixelAt(out, 3, 7)).toEqual(pixelAt(img, 0, 3));
  });

  it('дзеркала не чіпають протилежну вісь', () => {
    const img = coordImage(4, 3);
    const h = orient(img, 2);
    expect(pixelAt(h, 0, 0)).toEqual(pixelAt(img, 3, 0));
    expect(pixelAt(h, 0, 2)).toEqual(pixelAt(img, 3, 2));

    const v = orient(img, 4);
    expect(pixelAt(v, 0, 0)).toEqual(pixelAt(img, 0, 2));
    expect(pixelAt(v, 3, 0)).toEqual(pixelAt(img, 3, 2));
  });

  it('поворот на 180° — це обидва дзеркала разом', () => {
    const img = coordImage(5, 3);
    expect(orient(img, 3).data).toEqual(orient(orient(img, 2), 4).data);
  });

  it('обернене перетворення повертає точно вихідне зображення', () => {
    const img = coordImage(7, 3);
    for (const o of ALL) {
      const back = orient(orient(img, o), inverseOrientation(o));
      expect([back.width, back.height], `орієнтація ${o}`).toEqual([7, 3]);
      expect(back.data, `орієнтація ${o}`).toEqual(img.data);
    }
  });

  it('битий теґ трактується як «без змін», а не як помилка', () => {
    const img = coordImage(3, 2);
    for (const bad of [0, 9, -1, 1.5, NaN, 255]) {
      expect(orient(img, bad), `значення ${bad}`).toBe(img);
    }
  });

  it('isOrientation відсіює те, що приходить із чужого EXIF', () => {
    expect(ALL.every(isOrientation)).toBe(true);
    for (const bad of [0, 9, 1.5, '6', null, undefined, NaN]) {
      expect(isOrientation(bad), `значення ${String(bad)}`).toBe(false);
    }
  });

  it('жоден піксель не губиться й не дублюється', () => {
    const img = coordImage(5, 4);
    for (const o of ALL) {
      const out = orient(img, o);
      const seen = new Set<number>();
      for (let i = 0; i < out.data.length; i += 4) {
        seen.add(out.data[i]! * 1000 + out.data[i + 1]!);
      }
      expect(seen.size, `орієнтація ${o}`).toBe(20);
    }
  });
});
