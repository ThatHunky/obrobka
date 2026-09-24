import { describe, it, expect } from 'vitest';
import { runJob } from '../src/ops/pipeline.js';
import type { Codec, Segmenter } from '../src/ports/index.js';
import type { Job, Mask, RasterImage } from '../src/types.js';
import { solidImage, pixelAt } from './helpers.js';

const RED = { r: 255, g: 0, b: 0, a: 255 } as const;
const BLUE = { r: 0, g: 0, b: 255, a: 255 } as const;

/** Кодек, що нічого не кодує, а запам'ятовує готовий кадр. */
function capture(source: RasterImage): { codec: Codec; out: () => RasterImage } {
  let last: RasterImage | null = null;
  return {
    codec: {
      canDecode: () => true,
      canEncode: () => true,
      decode: async () => source,
      encode: async (img) => { last = img; return new Uint8Array(0); },
    },
    out: () => last!,
  };
}

/** Маска 64² з прямокутником — так її віддає модель, у своїй роздільності. */
function segmenter(x0: number, y0: number, x1: number, y1: number): Segmenter {
  return {
    id: 'fake',
    inputSize: 64,
    load: async () => {},
    segment: async (): Promise<Mask> => {
      const data = new Uint8ClampedArray(64 * 64);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data[y * 64 + x] = 255;
      return { data, width: 64, height: 64 };
    },
    dispose: async () => {},
  };
}

function rect(w: number, h: number, x0: number, y0: number, x1: number, y1: number): Mask {
  const data = new Uint8ClampedArray(w * h);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data[y * w + x] = 255;
  return { data, width: w, height: h };
}

async function run(source: RasterImage, seg: Segmenter, job: Job): Promise<RasterImage> {
  const c = capture(source);
  await runJob(new Uint8Array(0), 'image/png', job, { codec: c.codec, segmenter: () => seg });
  return c.out();
}

describe('маска в пікселях зображення', () => {
  it('стискання на 1 px — це піксель фото, а не піксель моделі', async () => {
    // Модель 64², фото 256²: один піксель моделі — чотири пікселі фото
    const out = await run(solidImage(256, 256, RED), segmenter(16, 16, 48, 48), {
      ops: [{ type: 'removeBackground', shrink: 1 }], output: { format: 'png' },
    });
    expect(pixelAt(out, 66, 128).a).toBeGreaterThan(128);
    expect(pixelAt(out, 68, 128).a).toBe(255);
  });

  it("не прорізає смугу там, де суб'єкт обрізано рамкою", async () => {
    const out = await run(solidImage(256, 256, RED), segmenter(16, 16, 48, 64), {
      ops: [{ type: 'removeBackground', shrink: 3 }], output: { format: 'png' },
    });
    expect(pixelAt(out, 128, 255).a).toBe(255);
  });
});

describe('маска йде за пензлем і обведенням', () => {
  it('обрізка країв лишає повернуте пензлем', async () => {
    // Суб'єкт 32…96, мазок «лишити» в кутку 0…16
    const out = await run(solidImage(128, 128, RED), segmenter(16, 16, 48, 48), {
      ops: [
        { type: 'removeBackground', shrink: 0 },
        { type: 'paint', keep: rect(64, 64, 0, 0, 8, 8) },
        { type: 'trim' },
      ],
      output: { format: 'png' },
    });
    expect([out.width, out.height]).toEqual([96, 96]);
    expect(pixelAt(out, 4, 4).a).toBe(255);
  });

  it('обрізка країв лишає й стерте поза собою', async () => {
    const out = await run(solidImage(128, 128, RED), segmenter(16, 16, 48, 48), {
      ops: [
        { type: 'removeBackground', shrink: 0 },
        { type: 'paint', erase: rect(64, 64, 16, 16, 48, 32) },
        { type: 'trim' },
      ],
      output: { format: 'png' },
    });
    expect([out.width, out.height]).toEqual([64, 32]);
  });

  it('обрізка після обведення не зрізає кільце', async () => {
    const out = await run(solidImage(128, 128, RED), segmenter(16, 16, 48, 48), {
      ops: [
        { type: 'removeBackground', shrink: 0 },
        { type: 'outline', width: 4, color: BLUE },
        { type: 'trim' },
      ],
      output: { format: 'png' },
    });
    // Суб'єкт 64 px і по 4 px кільця з кожного боку
    expect([out.width, out.height]).toEqual([72, 72]);
    expect(pixelAt(out, 1, 36)).toMatchObject({ b: 255, a: 255 });
  });

  it('повернуте пензлем обводиться й має свої кольори', async () => {
    const out = await run(solidImage(128, 128, RED), segmenter(16, 16, 48, 48), {
      ops: [
        { type: 'removeBackground', shrink: 0 },
        { type: 'paint', keep: rect(64, 64, 0, 0, 8, 8) },
        { type: 'outline', width: 4, color: BLUE },
      ],
      output: { format: 'png' },
    });
    // Полотно розширене на 4: кут мазка — на (4…20, 4…20)
    expect(pixelAt(out, 10, 10)).toMatchObject({ r: 255, b: 0, a: 255 });
    expect(pixelAt(out, 10, 1)).toMatchObject({ b: 255 });
  });
});
