import { describe, it, expect } from 'vitest';
import { crop } from '../src/ops/crop.js';
import { checkerImage, solidImage, pixelAt } from './helpers.js';
import type { RGBA } from '../src/types.js';

const A: RGBA = { r: 0, g: 0, b: 0, a: 255 };
const B: RGBA = { r: 255, g: 255, b: 255, a: 255 };

describe('crop', () => {
  it('вирізає точний прямокутник', () => {
    const src = checkerImage(4, 4, 1, A, B);
    const out = crop(src, { x: 1, y: 1, width: 2, height: 2 });
    expect(out.width).toBe(2);
    expect(out.height).toBe(2);
    expect(pixelAt(out, 0, 0)).toEqual(pixelAt(src, 1, 1));
    expect(pixelAt(out, 1, 1)).toEqual(pixelAt(src, 2, 2));
  });

  it('обрізає прямокутник до меж зображення', () => {
    const src = solidImage(4, 4, A);
    const out = crop(src, { x: 2, y: 2, width: 10, height: 10 });
    expect(out.width).toBe(2);
    expect(out.height).toBe(2);
  });

  it("обрізає від'ємні координати", () => {
    const src = solidImage(4, 4, A);
    const out = crop(src, { x: -2, y: -2, width: 4, height: 4 });
    expect(out.width).toBe(2);
    expect(out.height).toBe(2);
  });

  it('кидає помилку на порожньому перетині', () => {
    const src = solidImage(4, 4, A);
    expect(() => crop(src, { x: 10, y: 0, width: 2, height: 2 })).toThrow(RangeError);
  });

  it('округлює дробові координати', () => {
    const src = solidImage(4, 4, A);
    const out = crop(src, { x: 1.4, y: 1.6, width: 2.5, height: 2.5 });
    expect(Number.isInteger(out.width)).toBe(true);
    expect(Number.isInteger(out.height)).toBe(true);
  });
});
