import { describe, it, expect } from 'vitest';
import { runJob } from '../src/ops/pipeline.js';
import type { Codec } from '../src/ports/index.js';
import type { Job, RasterImage } from '../src/types.js';
import { solidImage } from './helpers.js';

const RED = { r: 255, g: 0, b: 0, a: 255 } as const;

function fakeCodec(source: RasterImage): Codec {
  return {
    canDecode: (mime) => mime === 'image/fake',
    canEncode: (format) => format === 'png',
    decode: async () => source,
    encode: async (img, opts) =>
      new TextEncoder().encode(JSON.stringify({ w: img.width, h: img.height, f: opts.format })),
  };
}

function decodeResult(bytes: Uint8Array): { w: number; h: number; f: string } {
  return JSON.parse(new TextDecoder().decode(bytes)) as { w: number; h: number; f: string };
}

describe('runJob', () => {
  const source = solidImage(200, 100, RED);
  const ctx = { codec: fakeCodec(source) };
  const input = new Uint8Array(0);

  it('застосовує fit', async () => {
    const job: Job = {
      ops: [{ type: 'fit', width: 512, height: 512, mode: 'contain' }],
      output: { format: 'png' },
    };
    const out = decodeResult(await runJob(input, 'image/fake', job, ctx));
    expect(out).toEqual({ w: 512, h: 512, f: 'png' });
  });

  it('шар лягає на полотно після fit', async () => {
    const BLUE = { r: 0, g: 0, b: 255, a: 255 } as const;
    let final: RasterImage | null = null;
    // Наявний fakeCodec кодує в JSON із самими розмірами — пікселів через
    // нього не побачити, тож тут потрібен кодек, який тримає готовий кадр.
    const capturing: Codec = {
      canDecode: (mime) => mime === 'image/fake',
      canEncode: (format) => format === 'png',
      decode: async () => source,
      encode: async (img) => { final = img; return new Uint8Array(0); },
    };
    const job: Job = {
      ops: [
        { type: 'fit', width: 50, height: 50, mode: 'cover' },
        {
          type: 'composite',
          layers: [{ image: solidImage(10, 10, BLUE), x: 0.5, y: 0.5, scale: 1 }],
        },
      ],
      output: { format: 'png' },
    };
    await runJob(input, 'image/fake', job, { codec: capturing });

    expect(final).not.toBeNull();
    const out = final as unknown as RasterImage;
    expect(out.width).toBe(50);
    // Шар накриває полотно цілком (scale 1), тож центр має бути синім
    expect(out.data[(25 * 50 + 25) * 4 + 2]).toBeGreaterThan(200);
    // Кут теж — інакше composite виконався до fit і його обрізало
    expect(out.data[2]).toBeGreaterThan(200);
  });

  it('пензель робить пікселі під мазком прозорими', async () => {
    let final: RasterImage | null = null;
    const capturing: Codec = {
      canDecode: (mime) => mime === 'image/fake',
      canEncode: (format) => format === 'png',
      decode: async () => source,
      encode: async (img) => { final = img; return new Uint8Array(0); },
    };
    // Маска мазка навмисно менша за кадр: інтерфейс тримає їх зменшеними
    const erase = { data: new Uint8ClampedArray(10 * 10).fill(0), width: 10, height: 10 };
    for (let y = 0; y < 5; y++) for (let x = 0; x < 10; x++) erase.data[y * 10 + x] = 255;

    const job: Job = { ops: [{ type: 'paint', erase }], output: { format: 'png' } };
    await runJob(input, 'image/fake', job, { codec: capturing });

    const out = final as unknown as RasterImage;
    expect(out.data[3]).toBe(0);
    expect(out.data[(out.height - 1) * out.width * 4 + 3]).toBe(255);
  });

  it('застосовує операції по порядку', async () => {
    const job: Job = {
      ops: [
        { type: 'fit', width: 100, height: 100, mode: 'cover' },
        { type: 'crop', rect: { x: 0, y: 0, width: 40, height: 40 } },
      ],
      output: { format: 'png' },
    };
    const out = decodeResult(await runJob(input, 'image/fake', job, ctx));
    expect(out).toEqual({ w: 40, h: 40, f: 'png' });
  });

  it('порожній список операцій — чиста переконвертація', async () => {
    const job: Job = { ops: [], output: { format: 'png' } };
    const out = decodeResult(await runJob(input, 'image/fake', job, ctx));
    expect(out).toEqual({ w: 200, h: 100, f: 'png' });
  });

  it('відхиляє MIME, який кодек не декодує', async () => {
    const job: Job = { ops: [], output: { format: 'png' } };
    await expect(runJob(input, 'image/tiff', job, ctx)).rejects.toThrow(/image\/tiff/);
  });

  it('відхиляє формат, який кодек не кодує', async () => {
    const job: Job = { ops: [], output: { format: 'avif' } };
    await expect(runJob(input, 'image/fake', job, ctx)).rejects.toThrow(/avif/);
  });
});
