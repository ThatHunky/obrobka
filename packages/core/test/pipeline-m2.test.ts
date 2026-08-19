import { describe, it, expect } from 'vitest';
import { runJob } from '../src/ops/pipeline.js';
import type { Codec, Segmenter } from '../src/ports/index.js';
import type { Job, Mask, RasterImage } from '../src/types.js';
import { solidImage } from './helpers.js';

const RED = { r: 255, g: 0, b: 0, a: 255 } as const;

function fakeCodec(source: RasterImage): Codec {
  return {
    canDecode: () => true,
    canEncode: () => true,
    decode: async () => source,
    encode: async (img) =>
      new TextEncoder().encode(JSON.stringify({ w: img.width, h: img.height })),
  };
}

/** Маска-заглушка: центральний квадрат. Рахує виклики segment. */
function fakeSegmenter(calls: { n: number }): Segmenter {
  return {
    id: 'fake',
    inputSize: 64,
    load: async () => {},
    segment: async (): Promise<Mask> => {
      calls.n += 1;
      const data = new Uint8ClampedArray(64 * 64);
      for (let y = 16; y < 48; y++) for (let x = 16; x < 48; x++) data[y * 64 + x] = 255;
      return { data, width: 64, height: 64 };
    },
    dispose: async () => {},
  };
}

function decode(bytes: Uint8Array): { w: number; h: number } {
  return JSON.parse(new TextDecoder().decode(bytes)) as { w: number; h: number };
}

describe('runJob із маскою', () => {
  const source = solidImage(128, 128, RED);
  const input = new Uint8Array(0);
  const withSeg = (calls: { n: number }) =>
    ({ codec: fakeCodec(source), segmenter: () => fakeSegmenter(calls) });

  it('видаляє фон', async () => {
    const calls = { n: 0 };
    const job: Job = { ops: [{ type: 'removeBackground' }], output: { format: 'png' } };
    expect(decode(await runJob(input, 'image/png', job, withSeg(calls)))).toEqual({ w: 128, h: 128 });
    expect(calls.n).toBe(1);
  });

  it('рахує маску один раз на кілька операцій', async () => {
    const calls = { n: 0 };
    const job: Job = {
      ops: [
        { type: 'removeBackground' },
        { type: 'outline', width: 2, color: { r: 0, g: 0, b: 255, a: 255 }, expand: false },
        { type: 'smartCrop', aspectRatio: 1 },
      ],
      output: { format: 'png' },
    };
    await runJob(input, 'image/png', job, withSeg(calls));
    expect(calls.n).toBe(1);
  });

  it('аутлайн розширює полотно', async () => {
    const job: Job = {
      ops: [{ type: 'outline', width: 4, color: { r: 0, g: 0, b: 255, a: 255 } }],
      output: { format: 'png' },
    };
    expect(decode(await runJob(input, 'image/png', job, withSeg({ n: 0 }))))
      .toEqual({ w: 136, h: 136 });
  });

  it('розумна обрізка дає квадрат', async () => {
    const job: Job = { ops: [{ type: 'smartCrop', aspectRatio: 1 }], output: { format: 'png' } };
    const out = decode(await runJob(input, 'image/png', job, withSeg({ n: 0 })));
    expect(out.w).toBe(out.h);
  });

  it('без сегментатора дає зрозумілу помилку', async () => {
    const ctx = { codec: fakeCodec(source) };
    const job: Job = { ops: [{ type: 'removeBackground' }], output: { format: 'png' } };
    await expect(runJob(input, 'image/png', job, ctx)).rejects.toThrow(/сегментатор/i);
  });

  it('операції M1 працюють без сегментатора', async () => {
    const ctx = { codec: fakeCodec(source) };
    const job: Job = {
      ops: [{ type: 'fit', width: 64, height: 64, mode: 'contain' }],
      output: { format: 'png' },
    };
    expect(decode(await runJob(input, 'image/png', job, ctx))).toEqual({ w: 64, h: 64 });
  });
});
