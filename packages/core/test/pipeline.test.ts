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
