import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nodeCodec } from '@obrobka/codecs/node';
import { buildExifApp1, withExif } from '@obrobka/metadata';
import { ensureFixture } from '../../../scripts/fixtures.mjs';

/**
 * Файли для браузерних перевірок.
 *
 * Будуються на місці, а не лежать у репозиторії: JPEG із координатами —
 * це чиїсь координати, а HEIC береться з conformance-набору й кешується
 * поруч із моделями.
 */

let dir: string | null = null;

async function tempDir(): Promise<string> {
  dir ??= await mkdtemp(join(tmpdir(), 'obrobka-e2e-'));
  return dir;
}

/** 60×30, ліва половина червона: після повороту на 90° має стати 30×60. */
function halves(width: number, height: number): {
  data: Uint8ClampedArray; width: number; height: number;
} {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const left = x < width / 2;
      data[i] = left ? 220 : 20;
      data[i + 2] = left ? 20 : 220;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

export interface RotatedFixture {
  readonly path: string;
  readonly width: number;
  readonly height: number;
}

/** JPEG з Orientation 6, координатами Києва й моделлю камери. */
export async function rotatedJpeg(): Promise<RotatedFixture> {
  const base = await nodeCodec.encode(halves(60, 30), { format: 'jpeg', quality: 92 });
  const bytes = withExif(base, buildExifApp1({
    orientation: 6,
    make: 'Apple',
    model: 'iPhone 15 Pro',
    gps: { latitude: 50.45, longitude: 30.5233 },
  }));
  const path = join(await tempDir(), 'rotated.jpg');
  await writeFile(path, bytes);
  return { path, width: 60, height: 30 };
}

/** Той самий кадр, але без жодних метаданих — контрольний зразок. */
export async function plainJpeg(name = 'plain.jpg'): Promise<string> {
  const bytes = await nodeCodec.encode(halves(60, 30), { format: 'jpeg', quality: 92 });
  const path = join(await tempDir(), name);
  await writeFile(path, bytes);
  return path;
}

export async function heicSample(): Promise<string> {
  return ensureFixture('sample.heic');
}
