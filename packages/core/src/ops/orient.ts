import type { RasterImage } from '../types.js';

/** Значення теґу EXIF Orientation (0x0112). */
export type Orientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/**
 * Куди дивиться джерело для кожного пікселя призначення.
 *
 * Замість восьми окремих циклів — одна афінна адресація:
 * `srcIndex = base + dx · stepX + dy · stepY`. Усі вісім перетворень
 * EXIF є комбінацією віддзеркалень і транспонування, тож кожне з них
 * задається трьома числами, а сам цикл лишається один.
 */
interface Addressing {
  /** Чи міняються сторони місцями. */
  readonly swap: boolean;
  readonly base: (w: number, h: number) => number;
  readonly stepX: (w: number, h: number) => number;
  readonly stepY: (w: number, h: number) => number;
}

const TABLE: Readonly<Record<Orientation, Addressing>> = {
  // без змін
  1: { swap: false, base: () => 0, stepX: () => 1, stepY: (w) => w },
  // дзеркало по горизонталі
  2: { swap: false, base: (w) => w - 1, stepX: () => -1, stepY: (w) => w },
  // поворот на 180°
  3: { swap: false, base: (w, h) => w * h - 1, stepX: () => -1, stepY: (w) => -w },
  // дзеркало по вертикалі
  4: { swap: false, base: (w, h) => w * (h - 1), stepX: () => 1, stepY: (w) => -w },
  // транспонування — дзеркало по головній діагоналі
  5: { swap: true, base: () => 0, stepX: (w) => w, stepY: () => 1 },
  // поворот на 90° за годинниковою
  6: { swap: true, base: (w, h) => (h - 1) * w, stepX: (w) => -w, stepY: () => 1 },
  // дзеркало по побічній діагоналі
  7: { swap: true, base: (w, h) => w * h - 1, stepX: (w) => -w, stepY: () => -1 },
  // поворот на 270° за годинниковою
  8: { swap: true, base: (w) => w - 1, stepX: (w) => w, stepY: () => -1 },
};

/**
 * Обернене перетворення.
 *
 * Шість із восьми — інволюції: дзеркала й поворот на 180° повертають
 * зображення на місце, якщо застосувати їх удруге. Взаємно оберненою
 * є лише пара поворотів на 90° і 270°.
 */
export function inverseOrientation(o: Orientation): Orientation {
  if (o === 6) return 8;
  if (o === 8) return 6;
  return o;
}

/** Чи є значення коректним теґом орієнтації. */
export function isOrientation(value: unknown): value is Orientation {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 8;
}

/**
 * Застосовує орієнтацію EXIF.
 *
 * Биті EXIF трапляються частіше, ніж хотілося б, тож будь-яке значення
 * поза 1..8 трактується як «без змін»: зіпсований теґ не привід
 * відмовитись обробляти фотографію.
 */
export function orient(img: RasterImage, orientation: number): RasterImage {
  if (!isOrientation(orientation) || orientation === 1) return img;

  const { swap, base, stepX, stepY } = TABLE[orientation];
  const w = img.width;
  const h = img.height;
  const width = swap ? h : w;
  const height = swap ? w : h;

  const data = new Uint8ClampedArray(width * height * 4);
  const b = base(w, h);
  const sx = stepX(w, h);
  const sy = stepY(w, h);

  let d = 0;
  for (let dy = 0; dy < height; dy++) {
    let s = (b + dy * sy) * 4;
    const step = sx * 4;
    for (let dx = 0; dx < width; dx++) {
      data[d] = img.data[s]!;
      data[d + 1] = img.data[s + 1]!;
      data[d + 2] = img.data[s + 2]!;
      data[d + 3] = img.data[s + 3]!;
      d += 4;
      s += step;
    }
  }
  return { data, width, height };
}
