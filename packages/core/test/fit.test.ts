import { describe, it, expect } from 'vitest';
import { fit } from '../src/ops/fit.js';
import { solidImage, pixelAt } from './helpers.js';
import type { RGBA } from '../src/types.js';

const RED: RGBA = { r: 255, g: 0, b: 0, a: 255 };
const BLUE: RGBA = { r: 0, g: 0, b: 255, a: 255 };
const CLEAR: RGBA = { r: 0, g: 0, b: 0, a: 0 };

describe('fit', () => {
  it('contain дає точний цільовий розмір', () => {
    const out = fit(solidImage(200, 100, RED), { width: 50, height: 50, mode: 'contain' });
    expect(out.width).toBe(50);
    expect(out.height).toBe(50);
  });

  it('contain робить поля прозорими за замовчуванням', () => {
    const out = fit(solidImage(200, 100, RED), { width: 100, height: 100, mode: 'contain' });
    expect(pixelAt(out, 50, 0)).toEqual(CLEAR);
    expect(pixelAt(out, 50, 99)).toEqual(CLEAR);
    expect(pixelAt(out, 50, 50).a).toBe(255);
  });

  it('contain заповнює поля заданим кольором', () => {
    const out = fit(solidImage(200, 100, RED), {
      width: 100, height: 100, mode: 'contain', pad: BLUE,
    });
    expect(pixelAt(out, 50, 0)).toEqual(BLUE);
  });

  it('квадрат 200×200 у 512×512 contain дає 156 px полів', () => {
    const out = fit(solidImage(200, 200, RED), { width: 512, height: 512, mode: 'contain' });
    expect(out.width).toBe(512);
    expect(pixelAt(out, 155, 256)).toEqual(CLEAR);
    expect(pixelAt(out, 156, 256).a).toBe(255);
    expect(pixelAt(out, 355, 256).a).toBe(255);
    expect(pixelAt(out, 356, 256)).toEqual(CLEAR);
  });

  it('contain збільшує, коли allowUpscale увімкнено', () => {
    const out = fit(solidImage(200, 200, RED), {
      width: 512, height: 512, mode: 'contain', allowUpscale: true,
    });
    expect(pixelAt(out, 0, 0).a).toBe(255);
    expect(pixelAt(out, 511, 511).a).toBe(255);
  });

  it('cover заповнює кадр без полів', () => {
    const out = fit(solidImage(200, 100, RED), { width: 100, height: 100, mode: 'cover' });
    expect(out.width).toBe(100);
    expect(out.height).toBe(100);
    for (const [x, y] of [[0, 0], [99, 0], [0, 99], [99, 99]] as const) {
      expect(pixelAt(out, x, y).a).toBe(255);
    }
  });

  it('fill розтягує, ігноруючи співвідношення', () => {
    const out = fit(solidImage(200, 100, RED), { width: 50, height: 200, mode: 'fill' });
    expect(out.width).toBe(50);
    expect(out.height).toBe(200);
    expect(pixelAt(out, 25, 100).a).toBe(255);
  });

  it('inside повертає масштабований розмір, а не цільовий', () => {
    const out = fit(solidImage(200, 100, RED), { width: 50, height: 50, mode: 'inside' });
    expect(out.width).toBe(50);
    expect(out.height).toBe(25);
  });

  it('position зміщує вміст у contain', () => {
    const out = fit(solidImage(200, 100, RED), {
      width: 100, height: 100, mode: 'contain', position: 'top',
    });
    expect(pixelAt(out, 50, 0).a).toBe(255);
    expect(pixelAt(out, 50, 99)).toEqual(CLEAR);
  });
});

describe('прив’язка часткою люфту', () => {
  it('нулі збігаються з top-left', () => {
    const opts = { width: 100, height: 100, mode: 'cover' as const };
    const named = fit(solidImage(200, 100, RED), { ...opts, position: 'top-left' });
    const frac = fit(solidImage(200, 100, RED), { ...opts, position: { fx: 0, fy: 0 } });
    expect(Array.from(frac.data)).toEqual(Array.from(named.data));
  });

  it('половини збігаються з center', () => {
    const opts = { width: 100, height: 100, mode: 'cover' as const };
    const named = fit(solidImage(200, 100, RED), { ...opts, position: 'center' });
    const frac = fit(solidImage(200, 100, RED), { ...opts, position: { fx: 0.5, fy: 0.5 } });
    expect(Array.from(frac.data)).toEqual(Array.from(named.data));
  });

  it('одиниці збігаються з bottom-right', () => {
    const opts = { width: 100, height: 100, mode: 'contain' as const };
    const named = fit(solidImage(200, 100, RED), { ...opts, position: 'bottom-right' });
    const frac = fit(solidImage(200, 100, RED), { ...opts, position: { fx: 1, fy: 1 } });
    expect(Array.from(frac.data)).toEqual(Array.from(named.data));
  });

  it('зміщує кадр по горизонталі', () => {
    // Ліва половина червона, права синя; кадр 50×100 з 200×100.
    const img = solidImage(200, 100, RED);
    for (let y = 0; y < 100; y++) {
      for (let x = 100; x < 200; x++) {
        const i = (y * 200 + x) * 4;
        img.data[i] = 0; img.data[i + 2] = 255;
      }
    }
    const opts = { width: 50, height: 100, mode: 'cover' as const };
    expect(pixelAt(fit(img, { ...opts, position: { fx: 0, fy: 0 } }), 25, 50)).toEqual(RED);
    expect(pixelAt(fit(img, { ...opts, position: { fx: 1, fy: 0 } }), 25, 50)).toEqual(BLUE);
  });

  it('затискає значення поза 0..1', () => {
    const opts = { width: 100, height: 100, mode: 'contain' as const };
    const clamped = fit(solidImage(200, 100, RED), { ...opts, position: { fx: -3, fy: 9 } });
    const edge = fit(solidImage(200, 100, RED), { ...opts, position: { fx: 0, fy: 1 } });
    expect(Array.from(clamped.data)).toEqual(Array.from(edge.data));
  });
});

describe('наближення', () => {
  it('cover із zoom 2 лишає вдвічі меншу частину кадру', () => {
    // Смуга 8 px посередині 200×200: при zoom 2 вона має стати 16 px.
    const img = solidImage(200, 200, RED);
    for (let y = 96; y < 104; y++) {
      for (let x = 0; x < 200; x++) {
        const i = (y * 200 + x) * 4;
        img.data[i] = 0; img.data[i + 2] = 255;
      }
    }
    const plain = fit(img, { width: 200, height: 200, mode: 'cover' });
    const zoomed = fit(img, { width: 200, height: 200, mode: 'cover', zoom: 2 });
    const blueRows = (r: typeof plain): number => {
      let n = 0;
      for (let y = 0; y < r.height; y++) if (pixelAt(r, 100, y).b > 128) n++;
      return n;
    };
    expect(blueRows(plain)).toBe(8);
    expect(blueRows(zoomed)).toBe(16);
  });

  it('діє попри вимкнений allowUpscale', () => {
    // 100×50 у кадр 100×100: масштаб 1, зверху й знизу поля. allowUpscale
    // збільшувати не дозволяє, але явний жест людини має право — і після
    // нього кути займає зображення, а не поля.
    const opts = { width: 100, height: 100, mode: 'contain' as const, allowUpscale: false };
    expect(pixelAt(fit(solidImage(100, 50, RED), opts), 0, 0)).toEqual(CLEAR);
    expect(pixelAt(fit(solidImage(100, 50, RED), { ...opts, zoom: 2 }), 0, 0)).toEqual(RED);
  });

  it('менше за одиницю затискається до одиниці', () => {
    const one = fit(solidImage(200, 100, RED), { width: 100, height: 100, mode: 'cover' });
    const small = fit(solidImage(200, 100, RED), {
      width: 100, height: 100, mode: 'cover', zoom: 0.25,
    });
    expect(Array.from(small.data)).toEqual(Array.from(one.data));
  });

  it('ігнорується там, де люфту немає', () => {
    for (const mode of ['fill', 'inside', 'outside'] as const) {
      const plain = fit(solidImage(200, 100, RED), { width: 100, height: 100, mode });
      const zoomed = fit(solidImage(200, 100, RED), { width: 100, height: 100, mode, zoom: 3 });
      expect({ mode, w: zoomed.width, h: zoomed.height })
        .toEqual({ mode, w: plain.width, h: plain.height });
    }
  });
});
