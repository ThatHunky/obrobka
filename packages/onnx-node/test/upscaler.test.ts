import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createUpscaler } from '../src/upscaler.js';
import { upscaleTiled, type RasterImage } from '@obrobka/core';
import { sphereImage } from '@obrobka/contract-tests';

/** Різкість через середній градієнт: більше — чіткіше. */
function sharpness(img: RasterImage): number {
  let sum = 0, n = 0;
  for (let y = 1; y < img.height - 1; y++) {
    for (let x = 1; x < img.width - 1; x++) {
      const i = (y * img.width + x) * 4;
      const r = (y * img.width + x + 1) * 4;
      const d = ((y + 1) * img.width + x) * 4;
      sum += Math.abs(img.data[i]! - img.data[r]!) + Math.abs(img.data[i]! - img.data[d]!);
      n += 2;
    }
  }
  return sum / n;
}

describe('апскейлер ×2', () => {
  const up = createUpscaler(2);
  beforeAll(async () => { await up.load(); }, 300_000);
  afterAll(async () => { await up.dispose(); });

  it('оголошує множник і розмір тайла', () => {
    expect(up.factor).toBe(2);
    expect(up.tileSize).toBe(256);
  });

  it('подвоює розмір', async () => {
    const out = await up.upscale(sphereImage(96));
    expect(out.width).toBe(192);
    expect(out.height).toBe(192);
  }, 300_000);

  it('приймає розмір, не кратний восьми', async () => {
    // Swin2SR вимагає кратності 8 — доповнення має бути прозорим для викликача
    const out = await up.upscale(sphereImage(101));
    expect(out.width).toBe(202);
    expect(out.height).toBe(202);
  }, 300_000);

  it('тайлова обробка дає той самий розмір і не лишає дірок', async () => {
    const src = sphereImage(200);
    const out = await upscaleTiled(src, up);
    expect(out.width).toBe(400);
    let empty = 0;
    for (let i = 3; i < out.data.length; i += 4) if (out.data[i]! === 0) empty++;
    expect(empty).toBe(0);
  }, 600_000);

  it('результат різкіший за просте розтягнення', async () => {
    const { resample } = await import('@obrobka/core');
    const src = sphereImage(128);
    const model = await up.upscale(src);
    const plain = resample(src, 256, 256);
    expect(sharpness(model)).toBeGreaterThan(sharpness(plain));
  }, 300_000);

  it('без завантаження кидає зрозумілу помилку', async () => {
    const fresh = createUpscaler(2);
    await expect(fresh.upscale(sphereImage(64))).rejects.toThrow(/не завантажен/);
  });
});
