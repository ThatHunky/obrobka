import { describe, it, expect } from 'vitest';
import { paint } from '../src/ops/paint.js';
import { solidImage, pixelAt } from './helpers.js';
import type { Mask, RGBA } from '../src/types.js';

const RED: RGBA = { r: 255, g: 0, b: 0, a: 255 };

/** Маска, у якій зафарбовано прямокутник. */
function rect(
  width: number, height: number, x0: number, y0: number, x1: number, y1: number, value = 255,
): Mask {
  const data = new Uint8ClampedArray(width * height);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data[y * width + x] = value;
  return { data, width, height };
}

describe('paint', () => {
  it('стирання обнуляє альфу під мазком', () => {
    const out = paint(solidImage(10, 10, RED), { erase: rect(10, 10, 2, 2, 8, 8) });
    expect(pixelAt(out, 5, 5).a).toBe(0);
    expect(pixelAt(out, 0, 0).a).toBe(255);
  });

  it('стирання не чіпає кольорові канали', () => {
    const out = paint(solidImage(10, 10, RED), { erase: rect(10, 10, 0, 0, 10, 10) });
    expect(pixelAt(out, 5, 5).r).toBe(255);
    expect(pixelAt(out, 5, 5).g).toBe(0);
  });

  it('повернення піднімає альфу до 255', () => {
    // Спершу все прозоре — так виглядає кадр після зняття фону
    const clear = solidImage(10, 10, { r: 255, g: 0, b: 0, a: 0 });
    const out = paint(clear, { keep: rect(10, 10, 3, 3, 7, 7) });
    expect(pixelAt(out, 5, 5).a).toBe(255);
    expect(pixelAt(out, 0, 0).a).toBe(0);
  });

  it('повернуте поверх стертого лишається повернутим', () => {
    // Людина стерла, потім передумала й повернула те саме місце
    const out = paint(solidImage(10, 10, RED), {
      erase: rect(10, 10, 0, 0, 10, 10),
      keep: rect(10, 10, 4, 4, 6, 6),
    });
    expect(pixelAt(out, 5, 5).a).toBe(255);
    expect(pixelAt(out, 1, 1).a).toBe(0);
  });

  it('часткове стирання дає часткову прозорість', () => {
    const out = paint(solidImage(10, 10, RED), { erase: rect(10, 10, 0, 0, 10, 10, 128) });
    expect(pixelAt(out, 5, 5).a).toBeGreaterThan(100);
    expect(pixelAt(out, 5, 5).a).toBeLessThan(155);
  });

  it('маску іншого розміру зводить до зображення', () => {
    // Мазки зберігаються зменшеними; операція має сама привести їх до кадру
    const out = paint(solidImage(40, 40, RED), { erase: rect(10, 10, 0, 0, 10, 5) });
    expect(pixelAt(out, 20, 4).a).toBe(0);
    expect(pixelAt(out, 20, 36).a).toBe(255);
  });

  it('порожні маски нічого не змінюють, але повертають копію', () => {
    const src = solidImage(8, 8, RED);
    const out = paint(src, {});
    expect(out.data).not.toBe(src.data);
    expect(Array.from(out.data)).toEqual(Array.from(src.data));
  });
});
