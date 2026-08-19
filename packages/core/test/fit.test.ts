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
