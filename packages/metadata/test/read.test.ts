import { beforeAll, describe, expect, it } from 'vitest';
import { buildExifApp1, withExif } from '../src/exif-writer.js';
import { hasMetadata, readMetadata, readOrientation } from '../src/read.js';
import { halvesImage, makeJpeg, makePng } from './fixtures.js';

let plain: Uint8Array;
let rich: Uint8Array;

beforeAll(async () => {
  plain = await makeJpeg(halvesImage(8, 4));
  rich = withExif(plain, buildExifApp1({
    orientation: 6,
    make: 'Apple',
    model: 'iPhone 15 Pro',
    software: '18.2',
    gps: { latitude: 50.45, longitude: 30.5233 },
  }));
});

describe('readMetadata', () => {
  it('читає орієнтацію числом, а не описом', async () => {
    const meta = await readMetadata(rich);
    // З типовими налаштуваннями exifr тут був би рядок «Rotate 90 CW»,
    // яким повернути зображення неможливо.
    expect(meta.orientation).toBe(6);
  });

  it('розбирає камеру на поля', async () => {
    const meta = await readMetadata(rich);
    expect(meta.camera).toEqual({ make: 'Apple', model: 'iPhone 15 Pro' });
    expect(meta.software).toBe('18.2');
  });

  it('віддає координати десятковим градусом', async () => {
    const meta = await readMetadata(rich);
    expect(meta.gps?.latitude).toBeCloseTo(50.45, 3);
    expect(meta.gps?.longitude).toBeCloseTo(30.5233, 3);
  });

  it('тримає південну й західну півкулі', async () => {
    const south = withExif(plain, buildExifApp1({
      gps: { latitude: -33.8688, longitude: -70.6693 },
    }));
    const meta = await readMetadata(south);
    expect(meta.gps?.latitude).toBeCloseTo(-33.8688, 3);
    expect(meta.gps?.longitude).toBeCloseTo(-70.6693, 3);
  });

  it('файл без EXIF дає порожній результат, а не помилку', async () => {
    const meta = await readMetadata(plain);
    expect(meta.orientation).toBeUndefined();
    expect(meta.gps).toBeUndefined();
    expect(hasMetadata(meta)).toBe(false);
  });

  it('PNG без текстових чанків теж порожній', async () => {
    const meta = await readMetadata(await makePng(halvesImage(4, 4)));
    expect(hasMetadata(meta)).toBe(false);
  });

  it('невідомий формат не валить читання', async () => {
    const junk = new Uint8Array(64).fill(0x42);
    await expect(readMetadata(junk)).resolves.toEqual({ tags: {} });
  });

  it('обірваний файл не валить читання', async () => {
    const cut = rich.subarray(0, 20);
    await expect(readMetadata(cut)).resolves.toBeDefined();
  });

  it('похідні координати не дублюються в теґах', async () => {
    const meta = await readMetadata(rich);
    expect(meta.tags).not.toHaveProperty('latitude');
    expect(meta.tags).not.toHaveProperty('longitude');
    // Але сирі теґи, з яких вони пораховані, лишаються.
    expect(meta.tags).toHaveProperty('GPSLatitude');
  });

  it('усе, що лишилось у теґах, серіалізується в JSON', async () => {
    const meta = await readMetadata(rich);
    expect(() => JSON.stringify(meta)).not.toThrow();
    expect(JSON.parse(JSON.stringify(meta)).tags).toEqual(meta.tags);
  });
});

describe('readOrientation', () => {
  it('без EXIF повертає одиницю', async () => {
    await expect(readOrientation(plain)).resolves.toBe(1);
  });

  it('усі вісім значень доходять із файлу назад', async () => {
    for (const o of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
      const bytes = withExif(plain, buildExifApp1({ orientation: o }));
      await expect(readOrientation(bytes), `орієнтація ${o}`).resolves.toBe(o);
    }
  });
});
