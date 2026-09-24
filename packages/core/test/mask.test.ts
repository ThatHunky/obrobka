import { describe, it, expect } from 'vitest';
import { maskBBox, resampleMask, dilateMask, featherMask, thresholdMask } from '../src/ops/mask.js';
import type { Mask } from '../src/types.js';

/** Маска із заповненим прямокутником у заданих межах. */
function maskWithRect(
  width: number, height: number,
  x0: number, y0: number, x1: number, y1: number, value = 255,
): Mask {
  const data = new Uint8ClampedArray(width * height);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) data[y * width + x] = value;
  }
  return { data, width, height };
}

describe('maskBBox', () => {
  it('знаходить точні межі прямокутника', () => {
    const m = maskWithRect(20, 20, 4, 6, 12, 15);
    expect(maskBBox(m)).toEqual({ x: 4, y: 6, width: 8, height: 9 });
  });

  it('ігнорує пікселі нижче порогу', () => {
    const m = maskWithRect(20, 20, 4, 6, 12, 15, 100);
    expect(() => maskBBox(m, 128)).toThrow(RangeError);
    expect(maskBBox(m, 50)).toEqual({ x: 4, y: 6, width: 8, height: 9 });
  });

  it('кидає помилку на порожній масці', () => {
    const m: Mask = { data: new Uint8ClampedArray(400), width: 20, height: 20 };
    expect(() => maskBBox(m)).toThrow(/суб/);
  });

  it('охоплює всю площу, коли маска суцільна', () => {
    const m = maskWithRect(10, 10, 0, 0, 10, 10);
    expect(maskBBox(m)).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });
});

describe('resampleMask', () => {
  it('змінює роздільність', () => {
    const m = maskWithRect(4, 4, 0, 0, 2, 4);
    const out = resampleMask(m, 8, 8);
    expect(out.width).toBe(8);
    expect(out.height).toBe(8);
    expect(out.data.length).toBe(64);
  });

  it('зберігає крайні значення при збільшенні', () => {
    const m = maskWithRect(4, 4, 0, 0, 4, 4);
    const out = resampleMask(m, 16, 16);
    expect(out.data[0]).toBe(255);
    expect(out.data[out.data.length - 1]).toBe(255);
  });

  it('повертає копію при незмінному розмірі', () => {
    const m = maskWithRect(4, 4, 1, 1, 3, 3);
    const out = resampleMask(m, 4, 4);
    expect(out.data).not.toBe(m.data);
    expect(Array.from(out.data)).toEqual(Array.from(m.data));
  });
});

describe('dilateMask', () => {
  it('розширює область на заданий радіус', () => {
    const m = maskWithRect(21, 21, 10, 10, 11, 11);
    const out = dilateMask(m, 3);
    expect(maskBBox(out)).toEqual({ x: 7, y: 7, width: 7, height: 7 });
  });

  it('нульовий радіус нічого не змінює', () => {
    const m = maskWithRect(10, 10, 3, 3, 6, 6);
    expect(Array.from(dilateMask(m, 0).data)).toEqual(Array.from(m.data));
  });
});

describe('featherMask', () => {
  it("пом'якшує край, лишаючи серцевину непрозорою", () => {
    const m = maskWithRect(40, 40, 10, 10, 30, 30);
    const out = featherMask(m, 3);
    expect(out.data[20 * 40 + 20]).toBe(255);
    const edge = out.data[20 * 40 + 10]!;
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(255);
  });

  it('збігається з наївним двопрохідним розмиттям', () => {
    const m = maskWithRect(31, 19, 4, 3, 22, 15);
    m.data[0] = 200; m.data[30] = 90;
    const r = 4;
    const at = (x: number, y: number): number =>
      m.data[Math.min(m.height - 1, Math.max(0, y)) * m.width + Math.min(m.width - 1, Math.max(0, x))]!;
    const got = featherMask(m, r);
    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) {
        let sum = 0;
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) sum += at(x + dx, y + dy);
        const want = sum / ((2 * r + 1) ** 2);
        expect(Math.abs(got.data[y * m.width + x]! - want)).toBeLessThanOrEqual(0.5);
      }
    }
  });
});

describe('thresholdMask', () => {
  it('перетворює півтони на двійкову маску', () => {
    const m = maskWithRect(4, 4, 0, 0, 4, 4, 130);
    expect(thresholdMask(m, 128).data[0]).toBe(255);
    expect(thresholdMask(m, 200).data[0]).toBe(0);
  });
});
