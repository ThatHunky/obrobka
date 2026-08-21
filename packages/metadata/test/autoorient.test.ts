import { nodeCodec } from '@obrobka/codecs/node';
import { runJob, type Context, type Job, type RasterImage } from '@obrobka/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildExifApp1, withExif } from '../src/exif-writer.js';
import { readOrientation } from '../src/read.js';
import { halvesImage, makeJpeg } from './fixtures.js';

/**
 * Перевірка того, заради чого затівався автоповорот.
 *
 * Живе в цьому пакеті, а не в ядрі, бо потребує і кодека, і читача EXIF.
 * Ядро про них не знає — і не має знати.
 */

const base: Context = { codec: nodeCodec, metadata: { readOrientation } };
const JOB: Job = { ops: [], output: { format: 'png' } };

let plain: Uint8Array;
let rotated: Uint8Array;

beforeAll(async () => {
  // 8×4: ліва половина червона, права синя. Після повороту на 90° за
  // годинниковою це має стати 4×8 із червоною половиною згори.
  plain = await makeJpeg(halvesImage(8, 4));
  rotated = withExif(plain, buildExifApp1({ orientation: 6 }));
});

async function run(input: Uint8Array, ctx: Context, job: Job = JOB): Promise<RasterImage> {
  return nodeCodec.decode(await runJob(input, 'image/jpeg', job, ctx), 'image/png');
}

function isRed(img: RasterImage, x: number, y: number): boolean {
  const i = (y * img.width + x) * 4;
  return img.data[i]! > 128 && img.data[i + 2]! < 128;
}

describe('автоповорот у пайплайні', () => {
  it('декодер сам орієнтацію не застосовує — саме тому крок і потрібен', async () => {
    const raw = await nodeCodec.decode(rotated, 'image/jpeg');
    expect([raw.width, raw.height]).toEqual([8, 4]);
    expect(isRed(raw, 0, 0)).toBe(true);
  });

  it('повертає кадр за теґом EXIF', async () => {
    const out = await run(rotated, base);
    expect([out.width, out.height]).toEqual([4, 8]);
    // Ліва половина джерела опинилась угорі.
    expect(isRed(out, 0, 0), 'верх мав стати червоним').toBe(true);
    expect(isRed(out, 0, 7), 'низ мав стати синім').toBe(false);
  });

  it('файл без EXIF лишається як був', async () => {
    const out = await run(plain, base);
    expect([out.width, out.height]).toEqual([8, 4]);
  });

  it('autoOrient: false вимикає поворот', async () => {
    const out = await run(rotated, base, { ...JOB, autoOrient: false });
    expect([out.width, out.height]).toEqual([8, 4]);
  });

  it('без порту метаданих пайплайн працює як раніше', async () => {
    const out = await run(rotated, { codec: nodeCodec });
    expect([out.width, out.height]).toEqual([8, 4]);
  });

  it('помилка читання EXIF не валить обробку', async () => {
    const broken: Context = {
      codec: nodeCodec,
      metadata: { readOrientation: () => Promise.reject(new Error('диск відвалився')) },
    };
    const out = await run(rotated, broken);
    expect([out.width, out.height]).toEqual([8, 4]);
  });

  it('поворот відбувається до операцій, а не після', async () => {
    // Вирізаємо верхню половину поверненого кадру. Якщо поворот стався
    // першим — вона червона; якщо ні — прямокутник 4×4 узявся б із лівої
    // половини вихідного кадру, і результат був би того самого кольору,
    // але розмір видав би підміну.
    const job: Job = {
      ops: [{ type: 'crop', rect: { x: 0, y: 0, width: 4, height: 4 } }],
      output: { format: 'png' },
    };
    const out = await run(rotated, base, job);
    expect([out.width, out.height]).toEqual([4, 4]);
    for (const [x, y] of [[0, 0], [3, 0], [0, 3], [3, 3]] as const) {
      expect(isRed(out, x, y), `піксель (${x}, ${y}) мав бути червоним`).toBe(true);
    }
  });

  it('усі вісім орієнтацій дають очікуваний розмір кадру', async () => {
    for (const [o, dims] of [
      [1, [8, 4]], [2, [8, 4]], [3, [8, 4]], [4, [8, 4]],
      [5, [4, 8]], [6, [4, 8]], [7, [4, 8]], [8, [4, 8]],
    ] as const) {
      const bytes = withExif(plain, buildExifApp1({ orientation: o }));
      const out = await run(bytes, base);
      expect([out.width, out.height], `орієнтація ${o}`).toEqual([...dims]);
    }
  });
});
