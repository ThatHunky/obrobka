import { describe, it, expect } from 'vitest';
import { resample } from '../src/ops/resample.js';
import { solidImage, checkerImage, pixelAt, expectPixel } from './helpers.js';
import type { RasterImage, RGBA } from '../src/types.js';

const OPAQUE_RED: RGBA = { r: 255, g: 0, b: 0, a: 255 };
const TRANSPARENT: RGBA = { r: 0, g: 0, b: 0, a: 0 };

function imageFrom(width: number, height: number, pixels: readonly RGBA[]): RasterImage {
  const data = new Uint8ClampedArray(width * height * 4);
  pixels.forEach((p, n) => {
    data[n * 4] = p.r; data[n * 4 + 1] = p.g; data[n * 4 + 2] = p.b; data[n * 4 + 3] = p.a;
  });
  return { data, width, height };
}

describe('resample', () => {
  it('повертає копію при незмінному розмірі', () => {
    const src = solidImage(3, 3, OPAQUE_RED);
    const out = resample(src, 3, 3);
    expect(out.data).not.toBe(src.data);
    expect(Array.from(out.data)).toEqual(Array.from(src.data));
  });

  it('усереднює по площі при зменшенні вдвічі', () => {
    const black: RGBA = { r: 0, g: 0, b: 0, a: 255 };
    const white: RGBA = { r: 255, g: 255, b: 255, a: 255 };
    const src = imageFrom(2, 2, [black, white, white, black]);
    const out = resample(src, 1, 1);
    expectPixel(out, 0, 0, { r: 128, g: 128, b: 128, a: 255 }, 1);
  });

  it('зменшення шахівниці до 1×1 дає середній колір', () => {
    const black: RGBA = { r: 0, g: 0, b: 0, a: 255 };
    const white: RGBA = { r: 255, g: 255, b: 255, a: 255 };
    const src = checkerImage(100, 100, 10, black, white);
    const out = resample(src, 1, 1);
    expectPixel(out, 0, 0, { r: 128, g: 128, b: 128, a: 255 }, 2);
  });

  it('білінійно інтерполює при збільшенні', () => {
    const black: RGBA = { r: 0, g: 0, b: 0, a: 255 };
    const white: RGBA = { r: 255, g: 255, b: 255, a: 255 };
    const src = imageFrom(2, 1, [black, white]);
    const out = resample(src, 4, 1);
    expect(pixelAt(out, 0, 0).r).toBeLessThan(64);
    expect(pixelAt(out, 3, 0).r).toBeGreaterThan(191);
    expect(pixelAt(out, 1, 0).r).toBeLessThan(pixelAt(out, 2, 0).r);
  });

  it('НЕ затікає кольором із прозорих пікселів', () => {
    const src = imageFrom(2, 1, [OPAQUE_RED, TRANSPARENT]);
    const out = resample(src, 1, 1);
    const p = pixelAt(out, 0, 0);
    expect(p.a).toBeCloseTo(128, -1);
    expect(p.r).toBeGreaterThan(250);
    expect(p.g).toBeLessThan(5);
  });

  it('відхиляє недодатний цільовий розмір', () => {
    const src = solidImage(4, 4, OPAQUE_RED);
    expect(() => resample(src, 0, 4)).toThrow(RangeError);
  });
});
