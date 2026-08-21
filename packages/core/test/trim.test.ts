import { describe, it, expect } from 'vitest';
import { trim } from '../src/ops/trim.js';
import { fit } from '../src/ops/fit.js';
import { solidImage, pixelAt } from './helpers.js';
import type { Mask, RGBA } from '../src/types.js';
import { POSITIONS } from '../src/types.js';

const RED: RGBA = { r: 255, g: 0, b: 0, a: 255 };
const CLEAR: RGBA = { r: 0, g: 0, b: 0, a: 0 };

function maskWithRect(
  w: number, h: number, x0: number, y0: number, x1: number, y1: number,
): Mask {
  const data = new Uint8ClampedArray(w * h);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data[y * w + x] = 255;
  return { data, width: w, height: h };
}

describe('trim', () => {
  it("обрізає рівно до прямокутника суб'єкта", () => {
    const out = trim(solidImage(100, 100, RED), maskWithRect(100, 100, 20, 30, 60, 80));
    expect(out.width).toBe(40);
    expect(out.height).toBe(50);
  });

  it('додає запас, коли просять', () => {
    const out = trim(solidImage(100, 100, RED), maskWithRect(100, 100, 20, 30, 60, 80), {
      padding: 0.1,
    });
    expect(out.width).toBe(40 + 10);
    expect(out.height).toBe(50 + 10);
  });

  it('не виходить за межі зображення', () => {
    const out = trim(solidImage(50, 50, RED), maskWithRect(50, 50, 0, 0, 50, 50), {
      padding: 0.5,
    });
    expect(out.width).toBe(50);
    expect(out.height).toBe(50);
  });

  it('не нав’язує співвідношення сторін', () => {
    const out = trim(solidImage(200, 200, RED), maskWithRect(200, 200, 10, 10, 190, 40));
    expect(out.width).toBe(180);
    expect(out.height).toBe(30);
  });
});

describe("дев'ять точок прив'язки", () => {
  it('усі дев’ять оголошені', () => {
    expect(POSITIONS).toHaveLength(9);
  });

  it('кути притискають вміст саме в кут', () => {
    // 200×100 у 100×100 contain → масштаб 0.5 → 100×50, поле 50 px по висоті
    const tl = fit(solidImage(200, 100, RED), {
      width: 100, height: 100, mode: 'contain', position: 'top-left',
    });
    expect(pixelAt(tl, 0, 0).a).toBe(255);
    expect(pixelAt(tl, 50, 99)).toEqual(CLEAR);

    const br = fit(solidImage(200, 100, RED), {
      width: 100, height: 100, mode: 'contain', position: 'bottom-right',
    });
    expect(pixelAt(br, 99, 99).a).toBe(255);
    expect(pixelAt(br, 50, 0)).toEqual(CLEAR);
  });

  it('cover вибирає ділянку за позицією', () => {
    const left = fit(solidImage(200, 100, RED), {
      width: 50, height: 50, mode: 'cover', position: 'left',
    });
    expect(left.width).toBe(50);
    expect(left.height).toBe(50);
  });
});
