import { nodeCodec } from '@obrobka/codecs/node';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildExifApp1, withExif } from '../src/exif-writer.js';
import { hasMetadata, readMetadata } from '../src/read.js';
import { stripMetadata } from '../src/strip.js';
import {
  halvesImage, jpegMarkers, makeJpeg, makePng, makeWebp,
  pngChunkTypes, pngWithText, webpChunkTypes, webpWithExif,
} from './fixtures.js';

const IMG = halvesImage(16, 8);
const EXIF = buildExifApp1({
  orientation: 6, make: 'Apple', gps: { latitude: 50.45, longitude: 30.5233 },
});

let jpeg: Uint8Array;
let png: Uint8Array;
let webp: Uint8Array;

beforeAll(async () => {
  jpeg = withExif(await makeJpeg(IMG), EXIF);
  png = pngWithText(await makePng(IMG), 'Author', 'хтось');
  webp = webpWithExif(await makeWebp(IMG), EXIF.subarray(4), IMG.width, IMG.height);
});

/** Головна обіцянка: метадані зникли, зображення лишилось те саме. */
async function expectSamePixels(before: Uint8Array, after: Uint8Array, mime: string): Promise<void> {
  const a = await nodeCodec.decode(before, mime);
  const b = await nodeCodec.decode(after, mime);
  expect([b.width, b.height]).toEqual([a.width, a.height]);
  expect(b.data).toEqual(a.data);
}

describe('stripMetadata — JPEG', () => {
  it('вихідний файл справді має що знімати', async () => {
    const meta = await readMetadata(jpeg);
    expect(meta.gps).toBeDefined();
    expect(meta.orientation).toBe(6);
  });

  it('прибирає координати, камеру й дату', async () => {
    const after = await readMetadata(await stripMetadata(jpeg));
    expect(after.gps).toBeUndefined();
    expect(after.camera).toBeUndefined();
    expect(after.shot).toBeUndefined();
  });

  it('лишає орієнтацію — інакше знімок ляже набік', async () => {
    // Пікселі в JPEG лежать так, як їх зняла матриця; як їх показувати,
    // каже теґ. Прибрати теґ, не чіпаючи пікселів, — розвернути фото.
    const after = await readMetadata(await stripMetadata(jpeg));
    expect(after.orientation).toBe(6);
    // І це єдине, що лишилось: не перенесений старий блок, а новий.
    expect(Object.keys(after.tags)).toEqual(['Orientation']);
  });

  it('лишає APP0 і не тягне старий APP1', async () => {
    const after = jpegMarkers(await stripMetadata(jpeg));
    // JFIF описує сам файл, а не того, хто його зняв.
    expect(after).toContain('e0');
    // APP1 рівно один — той мінімальний, що ми зібрали самі.
    expect(after.filter((m) => m === 'e1')).toHaveLength(1);
  });

  it('файл без орієнтації не отримує APP1 нізвідки', async () => {
    const plain = withExif(await makeJpeg(IMG), buildExifApp1({
      make: 'Apple', gps: { latitude: 50.45, longitude: 30.5233 },
    }));
    const after = await stripMetadata(plain);
    expect(jpegMarkers(after)).not.toContain('e1');
    expect(hasMetadata(await readMetadata(after))).toBe(false);
  });

  it('пікселі побайтово ті самі', async () => {
    await expectSamePixels(jpeg, await stripMetadata(jpeg), 'image/jpeg');
  });

  it('файл без метаданих проходить без змін у вмісті', async () => {
    const plain = await makeJpeg(IMG);
    const clean = await stripMetadata(plain);
    expect(clean).toEqual(plain);
  });

  it('пошкоджений JPEG дає зрозумілу помилку, а не тихий огризок', async () => {
    const broken = jpeg.slice(0, 30);
    await expect(stripMetadata(broken)).rejects.toThrow(/JPEG/);
  });
});

describe('stripMetadata — PNG', () => {
  it('прибирає tEXt і tIME, лишає решту чанків', async () => {
    const before = pngChunkTypes(png);
    expect(before).toContain('tEXt');
    expect(before).toContain('tIME');

    const after = pngChunkTypes(await stripMetadata(png));
    expect(after).not.toContain('tEXt');
    expect(after).not.toContain('tIME');
    expect(after[0]).toBe('IHDR');
    expect(after.at(-1)).toBe('IEND');
    expect(after).toContain('IDAT');
  });

  it('пікселі побайтово ті самі', async () => {
    await expectSamePixels(png, await stripMetadata(png), 'image/png');
  });
});

describe('stripMetadata — WebP', () => {
  it('прибирає чанк EXIF', async () => {
    expect(webpChunkTypes(webp)).toContain('EXIF');
    expect(webpChunkTypes(await stripMetadata(webp))).not.toContain('EXIF');
  });

  it('гасить прапорець EXIF у VP8X', async () => {
    const clean = await stripMetadata(webp);
    // VP8X іде першим чанком, його дані починаються з байта прапорців.
    const flags = clean[20]!;
    expect(flags & 0x08, 'біт EXIF мав погаснути').toBe(0);
  });

  it('лагодить поле розміру RIFF', async () => {
    const clean = await stripMetadata(webp);
    const declared = new DataView(clean.buffer, clean.byteOffset).getUint32(4, true);
    expect(declared).toBe(clean.length - 8);
  });

  it('пікселі побайтово ті самі', async () => {
    await expectSamePixels(webp, await stripMetadata(webp), 'image/webp');
  });
});

describe('stripMetadata — межі', () => {
  it('AVIF відхиляється з поясненням і підказкою', async () => {
    const avif = await nodeCodec.encode(IMG, { format: 'avif', quality: 60 });
    await expect(stripMetadata(avif)).rejects.toThrow(/перекодуйте/i);
  });

  it('невідомий формат відхиляється з переліком підтриманих', async () => {
    await expect(stripMetadata(new Uint8Array(64).fill(7)))
      .rejects.toThrow(/JPEG, PNG і WebP/);
  });
});
