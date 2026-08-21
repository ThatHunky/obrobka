import { describe, it, expect } from 'vitest';
import { upscaleTiled } from '../src/ops/upscale.js';
import type { RasterImage, Upscaler } from '../src/index.js';

/** Апскейлер-заглушка: повторює кожен піксель factor разів. */
function nearest(factor: 2 | 4, tileSize: number, calls?: { n: number; sizes: number[] }): Upscaler {
  return {
    id: 'stub', factor, tileSize,
    load: async () => {},
    dispose: async () => {},
    upscale: async (img: RasterImage): Promise<RasterImage> => {
      calls?.sizes.push(img.width);
      if (calls) calls.n += 1;
      const W = img.width * factor, H = img.height * factor;
      const data = new Uint8ClampedArray(W * H * 4);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const s = (Math.floor(y / factor) * img.width + Math.floor(x / factor)) * 4;
          const d = (y * W + x) * 4;
          data[d] = img.data[s]!; data[d + 1] = img.data[s + 1]!;
          data[d + 2] = img.data[s + 2]!; data[d + 3] = img.data[s + 3]!;
        }
      }
      return { data, width: W, height: H };
    },
  };
}

function gradient(w: number, h: number): RasterImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    data[i] = Math.round((255 * x) / Math.max(1, w - 1));
    data[i + 1] = Math.round((255 * y) / Math.max(1, h - 1));
    data[i + 2] = 128;
    data[i + 3] = 255;
  }
  return { data, width: w, height: h };
}

const at = (img: RasterImage, x: number, y: number): number[] => {
  const i = (y * img.width + x) * 4;
  return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!, img.data[i + 3]!];
};

describe('upscaleTiled', () => {
  it('дає точний цільовий розмір', async () => {
    const out = await upscaleTiled(gradient(50, 30), nearest(2, 32));
    expect(out.width).toBe(100);
    expect(out.height).toBe(60);
  });

  it('працює й коли зображення менше за тайл', async () => {
    const calls = { n: 0, sizes: [] as number[] };
    const out = await upscaleTiled(gradient(20, 20), nearest(2, 256, calls));
    expect(out.width).toBe(40);
    expect(calls.n).toBe(1);
  });

  it('ріже на тайли, коли зображення більше', async () => {
    const calls = { n: 0, sizes: [] as number[] };
    await upscaleTiled(gradient(200, 100), nearest(2, 64, calls));
    expect(calls.n).toBeGreaterThan(1);
    // Жоден тайл не має перевищувати заявлений розмір
    expect(Math.max(...calls.sizes)).toBeLessThanOrEqual(64);
  });

  it('повідомляє прогрес до самого кінця', async () => {
    const seen: number[] = [];
    await upscaleTiled(gradient(200, 100), nearest(2, 64), (d, t) => {
      expect(t).toBeGreaterThan(0);
      seen.push(d / t);
    });
    expect(seen.at(-1)).toBe(1);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it('на швах немає провалів — усі пікселі накриті', async () => {
    const out = await upscaleTiled(gradient(150, 90), nearest(2, 64));
    let empty = 0;
    for (let i = 3; i < out.data.length; i += 4) if (out.data[i]! === 0) empty++;
    expect(empty).toBe(0);
  });

  it('градієнт лишається монотонним попри зшивання', async () => {
    const out = await upscaleTiled(gradient(150, 40), nearest(2, 64));
    const y = 40;
    let previous = -1;
    for (let x = 0; x < out.width; x += 4) {
      const r = at(out, x, y)[0]!;
      expect(r).toBeGreaterThanOrEqual(previous - 2);   // допуск на зшивання
      previous = r;
    }
  });

  it('множник 4 теж працює', async () => {
    const out = await upscaleTiled(gradient(40, 25), nearest(4, 32));
    expect(out.width).toBe(160);
    expect(out.height).toBe(100);
  });
});
