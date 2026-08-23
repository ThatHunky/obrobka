import { describe, it, expect } from 'vitest';
import { composite } from '../src/ops/composite.js';
import { resample } from '../src/ops/resample.js';
import { solidImage, pixelAt, expectPixel } from './helpers.js';
import type { Layer, RGBA } from '../src/types.js';

const RED: RGBA = { r: 255, g: 0, b: 0, a: 255 };
const BLUE: RGBA = { r: 0, g: 0, b: 255, a: 255 };
const WHITE: RGBA = { r: 255, g: 255, b: 255, a: 255 };
const CLEAR: RGBA = { r: 0, g: 0, b: 0, a: 0 };

const layer = (over: Partial<Layer> = {}): Layer => ({
  image: solidImage(20, 20, BLUE), x: 0.5, y: 0.5, scale: 0.5, ...over,
});

describe('composite', () => {
  it('не чіпає основу поза шаром', () => {
    const out = composite(solidImage(100, 100, RED), [layer()]);
    expect(pixelAt(out, 2, 2)).toEqual(RED);
    expect(pixelAt(out, 97, 97)).toEqual(RED);
  });

  it('кладе шар у центр', () => {
    const out = composite(solidImage(100, 100, RED), [layer()]);
    expect(pixelAt(out, 50, 50)).toEqual(BLUE);
  });

  it('масштаб рахується від ширини основи', () => {
    // scale 0.5 на основі 100 px — шар 50 px завширшки, тобто 25..75.
    const out = composite(solidImage(100, 100, RED), [layer()]);
    expect(pixelAt(out, 26, 50)).toEqual(BLUE);
    expect(pixelAt(out, 23, 50)).toEqual(RED);
  });

  it('те саме місце на основах різного розміру', () => {
    // scale 0.2 навмисно: при 0.5 лівий край шару сів би рівно на нуль
    // на обох основах, і тест проходив би, навіть якби нормалізації не було.
    const where = (side: number): number => {
      const out = composite(solidImage(side, side, RED), [
        layer({ x: 0.25, y: 0.5, scale: 0.2 }),
      ]);
      let first = -1;
      for (let x = 0; x < side; x++) {
        if (pixelAt(out, x, side / 2).b > 128) { first = x; break; }
      }
      return first / side;
    };
    expect(where(100)).toBeGreaterThan(0);
    expect(Math.abs(where(100) - where(400))).toBeLessThan(0.01);
  });

  it('висота шару йде з власного співвідношення, не з основи', () => {
    // Шар 20×10 при scale 0.5 на основі 100×100 має стати 50×25.
    const out = composite(solidImage(100, 100, RED), [
      layer({ image: solidImage(20, 10, BLUE) }),
    ]);
    expect(pixelAt(out, 50, 50)).toEqual(BLUE);
    expect(pixelAt(out, 50, 36)).toEqual(RED);
    expect(pixelAt(out, 50, 39)).toEqual(BLUE);
  });

  it('прозорість домножує альфу шару', () => {
    const out = composite(solidImage(100, 100, RED), [layer({ opacity: 0.5 })]);
    expectPixel(out, 50, 50, { r: 128, g: 0, b: 128, a: 255 }, 2);
  });

  it('нульова прозорість не видно за жодного режиму', () => {
    const out = composite(solidImage(100, 100, RED), [
      layer({ opacity: 0, blend: 'multiply' }),
    ]);
    expect(pixelAt(out, 50, 50)).toEqual(RED);
  });

  it('multiply множить канали', () => {
    const out = composite(solidImage(100, 100, WHITE), [
      layer({ image: solidImage(20, 20, RED), blend: 'multiply' }),
    ]);
    expectPixel(out, 50, 50, RED, 2);
  });

  it('screen освітлює', () => {
    const out = composite(solidImage(100, 100, RED), [layer({ blend: 'screen' })]);
    // Червоне плюс синє на екрані дає пурпурове
    expectPixel(out, 50, 50, { r: 255, g: 0, b: 255, a: 255 }, 2);
  });

  it('overlay бере темну гілку на темній основі', () => {
    // b <= 0.5 → 2·b·s. Основа 64 (0,251), шар 153 (0,6): 2·0,251·0,6 = 0,301 → 77
    const out = composite(solidImage(20, 20, { r: 64, g: 64, b: 64, a: 255 }), [
      layer({ image: solidImage(10, 10, { r: 153, g: 153, b: 153, a: 255 }), blend: 'overlay' }),
    ]);
    expectPixel(out, 10, 10, { r: 77, g: 77, b: 77, a: 255 }, 2);
  });

  it('overlay бере світлу гілку на світлій основі', () => {
    // b > 0.5 → 1 − 2·(1−b)·(1−s). Основа 191 (0,749), шар 153: 0,799 → 204
    const out = composite(solidImage(20, 20, { r: 191, g: 191, b: 191, a: 255 }), [
      layer({ image: solidImage(10, 10, { r: 153, g: 153, b: 153, a: 255 }), blend: 'overlay' }),
    ]);
    expectPixel(out, 10, 10, { r: 204, g: 204, b: 204, a: 255 }, 2);
  });

  it('darken лишає темніше з двох', () => {
    const dim = solidImage(10, 10, { r: 153, g: 153, b: 153, a: 255 });
    const onLight = composite(solidImage(20, 20, { r: 191, g: 191, b: 191, a: 255 }),
      [layer({ image: dim, blend: 'darken' })]);
    const onDark = composite(solidImage(20, 20, { r: 64, g: 64, b: 64, a: 255 }),
      [layer({ image: dim, blend: 'darken' })]);
    expectPixel(onLight, 10, 10, { r: 153, g: 153, b: 153, a: 255 }, 2);
    expectPixel(onDark, 10, 10, { r: 64, g: 64, b: 64, a: 255 }, 2);
  });

  it('lighten лишає світліше з двох', () => {
    const dim = solidImage(10, 10, { r: 153, g: 153, b: 153, a: 255 });
    const onLight = composite(solidImage(20, 20, { r: 191, g: 191, b: 191, a: 255 }),
      [layer({ image: dim, blend: 'lighten' })]);
    const onDark = composite(solidImage(20, 20, { r: 64, g: 64, b: 64, a: 255 }),
      [layer({ image: dim, blend: 'lighten' })]);
    expectPixel(onLight, 10, 10, { r: 191, g: 191, b: 191, a: 255 }, 2);
    expectPixel(onDark, 10, 10, { r: 153, g: 153, b: 153, a: 255 }, 2);
  });

  it('непрозорий шар без повороту не має напівпрозорого краю', () => {
    // Непарна ширина: 0,51 × 100 = 51 px. Саме там дробовий центр давав
    // облямівку — 204 змішані пікселі проти нуля при парній ширині.
    for (const scale of [0.5, 0.51]) {
      const out = composite(solidImage(100, 100, RED), [
        layer({ image: solidImage(50, 50, BLUE), scale }),
      ]);
      let mixed = 0;
      for (let x = 0; x < 100; x++) {
        for (let y = 0; y < 100; y++) {
          const p = pixelAt(out, x, y);
          if (p.b > 0 && p.b < 255) mixed++;
        }
      }
      expect({ scale, mixed }).toEqual({ scale, mixed: 0 });
    }
  });

  it('повний оберт лягає так само чітко, як нульовий', () => {
    // MCP приймає −360..360. 360° — це те саме, що 0°, тож і краю
    // напівпрозорого там бути не має.
    for (const rotation of [0, 360, -360]) {
      const out = composite(solidImage(100, 100, RED), [
        layer({ image: solidImage(50, 50, BLUE), scale: 0.51, rotation }),
      ]);
      let mixed = 0;
      for (let x = 0; x < 100; x++) {
        for (let y = 0; y < 100; y++) {
          const p = pixelAt(out, x, y);
          if (p.b > 0 && p.b < 255) mixed++;
        }
      }
      expect({ rotation, mixed }).toEqual({ rotation, mixed: 0 });
    }
  });

  it('порядок масиву — це порядок накладання', () => {
    const out = composite(solidImage(100, 100, WHITE), [
      layer({ image: solidImage(20, 20, RED) }),
      layer({ image: solidImage(20, 20, BLUE) }),
    ]);
    expect(pixelAt(out, 50, 50)).toEqual(BLUE);
  });

  it('прозорий край шару не темніє', () => {
    // Синій диск на прозорому тлі, покладений на біле. Правильна
    // композиція дає r = g = 255·(1 − a), а b лишається 255 по всьому
    // ряду. Якби альфа не була premultiplied, чорний колір повністю
    // прозорих пікселів затікав би в край і збивав саме b — та сама
    // темна облямівка, від якої бережеться resample.
    const src = solidImage(64, 64, CLEAR);
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        if (Math.hypot(x - 31.5, y - 31.5) > 28) continue;
        const i = (y * 64 + x) * 4;
        src.data[i + 2] = 255; src.data[i + 3] = 255;
      }
    }
    const out = composite(solidImage(100, 100, WHITE), [
      layer({ image: src, scale: 0.4 }),
    ]);
    for (let x = 30; x < 70; x++) {
      const p = pixelAt(out, x, 50);
      expect({ x, b: p.b }).toEqual({ x, b: 255 });
      expect({ x, r: p.r }).toEqual({ x, r: p.g });
    }
  });

  it('зменшення шару не гірше за resample', () => {
    // Смугастий шар, зведений удвічі. Якби ми брали білінійну вибірку
    // замість усереднення по площі, смуги дали б муар.
    const stripes = solidImage(64, 64, WHITE);
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        if (x % 2 === 0) continue;
        const i = (y * 64 + x) * 4;
        stripes.data[i] = 0; stripes.data[i + 1] = 0; stripes.data[i + 2] = 0;
      }
    }
    const out = composite(solidImage(32, 32, RED), [
      { image: stripes, x: 0.5, y: 0.5, scale: 1 },
    ]);
    const direct = resample(stripes, 32, 32);
    expectPixel(out, 16, 16, pixelAt(direct, 16, 16), 3);
  });

  it('поворот на 90° міняє сторони місцями', () => {
    const out = composite(solidImage(100, 100, RED), [
      layer({ image: solidImage(40, 10, BLUE), scale: 0.4, rotation: 90 }),
    ]);
    // До повороту шар 40×10 px; після — 10 завширшки, 40 заввишки
    expect(pixelAt(out, 50, 35)).toEqual(BLUE);
    expect(pixelAt(out, 35, 50)).toEqual(RED);
  });

  it('шар за межами полотна нічого не ламає', () => {
    const out = composite(solidImage(50, 50, RED), [layer({ x: 3, y: -2 })]);
    expect(pixelAt(out, 25, 25)).toEqual(RED);
  });

  it('порожній список шарів повертає копію, а не ту саму пам’ять', () => {
    const base = solidImage(10, 10, RED);
    const out = composite(base, []);
    expect(out.data).not.toBe(base.data);
    expect(Array.from(out.data)).toEqual(Array.from(base.data));
  });
});
