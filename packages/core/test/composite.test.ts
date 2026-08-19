import { describe, it, expect } from 'vitest';
import { applyMask } from '../src/ops/applyMask.js';
import { outline } from '../src/ops/outline.js';
import { smartCrop } from '../src/ops/smartCrop.js';
import { solidImage, pixelAt } from './helpers.js';
import type { Mask, RGBA } from '../src/types.js';

const RED: RGBA = { r: 255, g: 0, b: 0, a: 255 };
const BLUE: RGBA = { r: 0, g: 0, b: 255, a: 255 };

function maskWithRect(
  width: number, height: number, x0: number, y0: number, x1: number, y1: number,
): Mask {
  const data = new Uint8ClampedArray(width * height);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data[y * width + x] = 255;
  return { data, width, height };
}

describe('applyMask', () => {
  it('обнуляє альфу поза маскою й лишає всередині', () => {
    const out = applyMask(solidImage(10, 10, RED), maskWithRect(10, 10, 2, 2, 8, 8));
    expect(pixelAt(out, 5, 5)).toEqual(RED);
    expect(pixelAt(out, 0, 0).a).toBe(0);
  });

  it('не змінює кольорові канали', () => {
    const out = applyMask(solidImage(10, 10, RED), maskWithRect(10, 10, 0, 0, 10, 10));
    expect(pixelAt(out, 3, 3).r).toBe(255);
    expect(pixelAt(out, 3, 3).g).toBe(0);
  });

  it('масштабує маску до розміру зображення', () => {
    const out = applyMask(solidImage(40, 40, RED), maskWithRect(10, 10, 0, 0, 5, 10));
    expect(pixelAt(out, 5, 20).a).toBe(255);
    expect(pixelAt(out, 35, 20).a).toBe(0);
  });

  it('перемножує півтони маски', () => {
    const half: Mask = { data: new Uint8ClampedArray(16).fill(128), width: 4, height: 4 };
    expect(pixelAt(applyMask(solidImage(4, 4, RED), half), 2, 2).a).toBe(128);
  });
});

describe('outline', () => {
  it("малює обведення навколо суб'єкта", () => {
    const m = maskWithRect(40, 40, 15, 15, 25, 25);
    const masked = applyMask(solidImage(40, 40, RED), m);
    const out = outline(masked, m, { width: 3, color: BLUE, expand: false });
    expect(pixelAt(out, 20, 20)).toEqual(RED);
    expect(pixelAt(out, 13, 20)).toEqual(BLUE);
    expect(pixelAt(out, 5, 20).a).toBe(0);
  });

  it('розширює полотно, коли обведення не влазить', () => {
    const out = outline(solidImage(20, 20, RED), maskWithRect(20, 20, 0, 0, 20, 20), {
      width: 4, color: BLUE, expand: true,
    });
    expect(out.width).toBe(28);
    expect(out.height).toBe(28);
  });

  it('не розширює полотно, коли expand вимкнено', () => {
    const out = outline(solidImage(20, 20, RED), maskWithRect(20, 20, 0, 0, 20, 20), {
      width: 4, color: BLUE, expand: false,
    });
    expect(out.width).toBe(20);
  });
});

describe('smartCrop', () => {
  it("кадрує під квадрат навколо суб'єкта", () => {
    const out = smartCrop(solidImage(200, 100, RED), maskWithRect(200, 100, 20, 20, 60, 80), {
      aspectRatio: 1,
    });
    expect(out.width).toBe(out.height);
  });

  it('не виходить за межі зображення', () => {
    const out = smartCrop(solidImage(100, 100, RED), maskWithRect(100, 100, 0, 0, 10, 10), {
      aspectRatio: 1, padding: 2,
    });
    expect(out.width).toBeLessThanOrEqual(100);
    expect(out.height).toBeLessThanOrEqual(100);
  });

  it('витягує широкий кадр для співвідношення 16:9', () => {
    const out = smartCrop(solidImage(400, 400, RED), maskWithRect(400, 400, 150, 150, 250, 250), {
      aspectRatio: 16 / 9,
    });
    expect(out.width / out.height).toBeCloseTo(16 / 9, 1);
  });
});
