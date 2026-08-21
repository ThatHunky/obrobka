import { describe, it, expect } from 'vitest';
import { runJob } from '../src/ops/pipeline.js';
import type { Codec, Segmenter } from '../src/ports/index.js';
import type { Job, Mask, RasterImage } from '../src/types.js';

const OPAQUE = { r: 200, g: 30, b: 40, a: 255 } as const;

function solid(w: number, h: number): RasterImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = OPAQUE.r; data[i + 1] = OPAQUE.g; data[i + 2] = OPAQUE.b; data[i + 3] = 255;
  }
  return { data, width: w, height: h };
}

/** Кодек, що віддає готове зображення й повертає сире RGBA назад. */
function passthrough(src: RasterImage): { codec: Codec; last: () => RasterImage } {
  let out: RasterImage = src;
  return {
    codec: {
      canDecode: () => true,
      canEncode: () => true,
      decode: async () => src,
      encode: async (img) => { out = img; return new Uint8Array(0); },
    },
    last: () => out,
  };
}

/** Маска моделі: суцільна, у роздільності моделі, а не зображення. */
function fullMaskSegmenter(mw: number, mh: number): Segmenter {
  return {
    id: 'stub', inputSize: mw,
    load: async () => {},
    segment: async (): Promise<Mask> =>
      ({ data: new Uint8ClampedArray(mw * mh).fill(255), width: mw, height: mh }),
    dispose: async () => {},
  };
}

describe('маска накриває кадр повністю', () => {
  /**
   * Розміри навмисно не збігаються з входом моделі: 555×833 проти 512×768.
   * Якби маска десь застосовувалась без масштабування, незакритими лишились
   * би праві 43 колонки й нижні 65 рядків — саме така смуга й видно, коли
   * фон «майже знявся».
   */
  it('суцільна маска дає суцільну альфу на нерівному розмірі', async () => {
    const src = solid(555, 833);
    const { codec, last } = passthrough(src);
    const job: Job = {
      ops: [{ type: 'removeBackground', shrink: 0, despeckle: false, fillHoles: false }],
      output: { format: 'png' },
    };
    await runJob(new Uint8Array(0), 'image/png', job, {
      codec, segmenter: () => fullMaskSegmenter(512, 768),
    });

    const out = last();
    expect(out.width).toBe(555);
    expect(out.height).toBe(833);

    // Перевіряємо саме проблемні краї
    const alphaAt = (x: number, y: number): number => out.data[(y * out.width + x) * 4 + 3]!;
    expect(alphaAt(554, 400)).toBe(255);   // остання колонка
    expect(alphaAt(520, 400)).toBe(255);   // одразу за шириною моделі
    expect(alphaAt(300, 832)).toBe(255);   // останній рядок
    expect(alphaAt(300, 800)).toBe(255);   // одразу за висотою моделі

    let holes = 0;
    for (let i = 3; i < out.data.length; i += 4) if (out.data[i]! < 250) holes++;
    expect(holes).toBe(0);
  });

  it('порожня маска обнуляє альфу всюди, включно з краями', async () => {
    const src = solid(555, 833);
    const { codec, last } = passthrough(src);
    const empty: Segmenter = {
      id: 'stub', inputSize: 512,
      load: async () => {},
      segment: async () => ({ data: new Uint8ClampedArray(512 * 768), width: 512, height: 768 }),
      dispose: async () => {},
    };
    await runJob(new Uint8Array(0), 'image/png', {
      ops: [{ type: 'removeBackground', shrink: 0, despeckle: false, fillHoles: false }],
      output: { format: 'png' },
    }, { codec, segmenter: () => empty });

    const out = last();
    let opaque = 0;
    for (let i = 3; i < out.data.length; i += 4) if (out.data[i]! > 5) opaque++;
    expect(opaque).toBe(0);
  });
});
