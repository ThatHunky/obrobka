import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nodeCodec } from '@obrobka/codecs/node';
import { buildExifApp1, withExif } from '@obrobka/metadata';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { ensureFixture } from '../../../scripts/fixtures.mjs';
import { processBatch, readImageMetadata, stripImageMetadata } from '../src/tools.js';

let dir = '';
let inDir = '';
let outDir = '';

/** Несиметричне зображення — щоб поворот було видно за розміром і кольором. */
function halves(width: number, height: number): {
  data: Uint8ClampedArray; width: number; height: number;
} {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const left = x < width / 2;
      data[i] = left ? 255 : 0;
      data[i + 2] = left ? 0 : 255;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'obrobka-batch-'));
  inDir = join(dir, 'in');
  outDir = join(dir, 'out');
  await mkdir(inDir, { recursive: true });
  await mkdir(join(inDir, 'nested'), { recursive: true });

  const jpeg = await nodeCodec.encode(halves(40, 20), { format: 'jpeg', quality: 90 });
  const png = await nodeCodec.encode(halves(30, 30), { format: 'png' });

  await writeFile(join(inDir, 'alpha.jpg'), jpeg);
  await writeFile(join(inDir, 'beta.jpg'), jpeg);
  await writeFile(join(inDir, 'gamma.png'), png);
  // Той самий стем, інше розширення — перевірка розведення імен.
  await writeFile(join(inDir, 'alpha.png'), png);
  await writeFile(join(inDir, 'broken.jpg'), Uint8Array.of(0xff, 0xd8, 0xff, 1, 2, 3, 4, 5, 6, 7, 8, 9));
  await writeFile(join(inDir, 'nested', 'delta.jpg'), jpeg);

  // Файл із координатами та орієнтацією — для метаданих і автоповороту.
  await writeFile(join(inDir, 'geotagged.jpg'), withExif(jpeg, buildExifApp1({
    orientation: 6, make: 'Apple', gps: { latitude: 50.45, longitude: 30.5233 },
  })));

  await copyFile(await ensureFixture('sample.heic'), join(inDir, 'phone.heic'));
}, 60_000);

afterAll(async () => { await rm(dir, { recursive: true, force: true }); });

describe('read_metadata', () => {
  it('віддає структуру, а не текстовий дамп', async () => {
    const r = await readImageMetadata({ input: join(inDir, 'geotagged.jpg') });
    expect(r.hasGps).toBe(true);
    expect(r.metadata.orientation).toBe(6);
    expect(r.metadata.camera?.make).toBe('Apple');
    expect(r.metadata.gps?.latitude).toBeCloseTo(50.45, 3);
  });

  it('файл без метаданих — не помилка', async () => {
    const r = await readImageMetadata({ input: join(inDir, 'alpha.jpg') });
    expect(r.hasGps).toBe(false);
    expect(Object.keys(r.metadata.tags)).toHaveLength(0);
  });
});

describe('strip_metadata', () => {
  it('прибирає координати й перелічує зняте', async () => {
    const out = join(dir, 'clean.jpg');
    const r = await stripImageMetadata({ input: join(inDir, 'geotagged.jpg'), output: out });
    expect(r.removed).toContain('GPSLatitude');
    expect(r.removed).toContain('Orientation');
    expect(r.bytesAfter).toBeLessThan(r.bytesBefore);
    expect((await readImageMetadata({ input: out })).hasGps).toBe(false);
  });

  it('не перестискає: пікселі лишаються ті самі', async () => {
    const out = join(dir, 'clean2.jpg');
    await stripImageMetadata({ input: join(inDir, 'geotagged.jpg'), output: out });
    const before = await nodeCodec.decode(
      new Uint8Array(await readFile(join(inDir, 'geotagged.jpg'))), 'image/jpeg',
    );
    const after = await nodeCodec.decode(new Uint8Array(await readFile(out)), 'image/jpeg');
    expect(after.data).toEqual(before.data);
  });
});

describe('process_batch', () => {
  it('обробляє всі знайдені файли й складає результати в теку', async () => {
    const r = await processBatch({
      pattern: '*.jpg', cwd: inDir, outputDir: outDir, format: 'webp', quality: 80,
    });
    expect(r.outputs.map((o) => o.path.split('/').at(-1)).sort())
      .toEqual(['alpha.webp', 'beta.webp', 'geotagged.webp']);
    expect(r.errors.map((e) => e.input.split('/').at(-1))).toEqual(['broken.jpg']);
    expect(r.skipped).toBe(0);
  }, 30_000);

  it('битий файл не зупиняє решту', async () => {
    const r = await processBatch({
      pattern: '*.jpg', cwd: inDir, outputDir: join(dir, 'o2'), format: 'png',
    });
    expect(r.outputs.length).toBeGreaterThan(0);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]!.message).toBeTruthy();
  }, 30_000);

  it('розводить збіги імен замість того, щоб затирати', async () => {
    const r = await processBatch({
      pattern: 'alpha.*', cwd: inDir, outputDir: join(dir, 'o3'), format: 'webp',
    });
    const names = r.outputs.map((o) => o.path.split('/').at(-1));
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('alpha.webp');
    expect(names).toContain('alpha-2.webp');
  }, 30_000);

  it('порядок результатів детермінований', async () => {
    const opts = {
      pattern: '*.jpg', cwd: inDir, outputDir: join(dir, 'o4'), format: 'webp' as const,
    };
    const a = await processBatch(opts);
    const b = await processBatch({ ...opts, outputDir: join(dir, 'o5') });
    expect(a.outputs.map((o) => o.width)).toEqual(b.outputs.map((o) => o.width));
    expect(a.errors.map((e) => e.input.split('/').at(-1)))
      .toEqual(b.errors.map((e) => e.input.split('/').at(-1)));
  }, 30_000);

  it('ліміт відрізає явно, а не мовчки', async () => {
    const r = await processBatch({
      pattern: '*.jpg', cwd: inDir, outputDir: join(dir, 'o6'), format: 'webp', limit: 2,
    });
    expect(r.outputs.length + r.errors.length).toBe(2);
    expect(r.skipped).toBe(2);
  }, 30_000);

  it('застосовує орієнтацію EXIF — заради цього все й затівалось', async () => {
    const r = await processBatch({
      pattern: 'geotagged.jpg', cwd: inDir, outputDir: join(dir, 'o7'), format: 'png',
    });
    // Джерело 40×20 з теґом «повернути на 90°» має вийти 20×40.
    expect([r.outputs[0]!.width, r.outputs[0]!.height]).toEqual([20, 40]);
  }, 30_000);

  it('читає HEIC нарівні з рештою', async () => {
    const r = await processBatch({
      pattern: '*.heic', cwd: inDir, outputDir: join(dir, 'o8'), format: 'jpeg', quality: 80,
    });
    expect(r.errors).toHaveLength(0);
    expect([r.outputs[0]!.width, r.outputs[0]!.height]).toEqual([1280, 720]);
  }, 60_000);

  it('маска з підтеками знаходить вкладені файли', async () => {
    const r = await processBatch({
      pattern: '**/*.jpg', cwd: inDir, outputDir: join(dir, 'o9'), format: 'webp',
    });
    expect(r.outputs.map((o) => o.path.split('/').at(-1))).toContain('delta.webp');
  }, 30_000);

  it('приводить до розміру, коли задано обидві сторони', async () => {
    const r = await processBatch({
      pattern: 'alpha.jpg', cwd: inDir, outputDir: join(dir, 'o10'),
      format: 'webp', width: 10, height: 10, mode: 'contain',
    });
    expect([r.outputs[0]!.width, r.outputs[0]!.height]).toEqual([10, 10]);
  }, 30_000);

  it('порожня вибірка дає порожній результат, а не помилку', async () => {
    const r = await processBatch({
      pattern: '*.tiff', cwd: inDir, outputDir: join(dir, 'o11'), format: 'png',
    });
    expect(r).toEqual({ outputs: [], errors: [], skipped: 0 });
    // Теку все одно створено — агенту нема чого гадати, чи вона є.
    await expect(readdir(join(dir, 'o11'))).resolves.toEqual([]);
  });
});
