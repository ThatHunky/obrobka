import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, readFile, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nodeCodec } from '@obrobka/codecs/node';
import { buildExifApp1, withExif } from '@obrobka/metadata';
import { compositeImages, convertImage, resizeImage } from '../src/tools.js';

let dir = '';
let srcPath = '';

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'obrobka-'));
  srcPath = join(dir, 'source.png');
  const data = new Uint8ClampedArray(200 * 100 * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 200; data[i + 1] = 30; data[i + 2] = 40; data[i + 3] = 255;
  }
  const bytes = await nodeCodec.encode({ data, width: 200, height: 100 }, { format: 'png' });
  await writeFile(srcPath, bytes);
}, 30_000);

afterAll(async () => { await rm(dir, { recursive: true, force: true }); });

describe('convertImage', () => {
  it('змінює формат', async () => {
    const out = join(dir, 'out.webp');
    const res = await convertImage({ input: srcPath, output: out, format: 'webp', quality: 80 });
    expect(res.width).toBe(200);
    expect(res.height).toBe(100);
    expect(res.format).toBe('webp');
    expect((await stat(out)).size).toBeGreaterThan(0);
  });

  it('повідомляє зрозумілу помилку для відсутнього файлу', async () => {
    await expect(convertImage({
      input: join(dir, 'ghost.png'), output: join(dir, 'x.png'), format: 'png',
    })).rejects.toThrow(/не знайдено/);
  });
});

describe('resizeImage', () => {
  it('contain дає точний розмір', async () => {
    const res = await resizeImage({
      input: srcPath, output: join(dir, 'contain.png'),
      width: 512, height: 512, mode: 'contain', format: 'png',
    });
    expect(res.width).toBe(512);
    expect(res.height).toBe(512);
  });

  it('cover дає точний розмір', async () => {
    const res = await resizeImage({
      input: srcPath, output: join(dir, 'cover.png'),
      width: 300, height: 300, mode: 'cover', format: 'png',
    });
    expect(res.width).toBe(300);
    expect(res.height).toBe(300);
  });

  it('inside повертає масштабований розмір', async () => {
    const res = await resizeImage({
      input: srcPath, output: join(dir, 'inside.png'),
      width: 50, height: 50, mode: 'inside', format: 'png',
    });
    expect(res.width).toBe(50);
    expect(res.height).toBe(25);
  });

  it('приймає колір полів', async () => {
    const res = await resizeImage({
      input: srcPath, output: join(dir, 'padded.png'),
      width: 300, height: 300, mode: 'contain', pad: '#0000ff', format: 'png',
    });
    expect(res.width).toBe(300);
  });
});

/** Однотонний PNG у тимчасовій теці — накладене зображення для перевірок. */
async function solidPng(
  name: string, w: number, h: number, r: number, g: number, b: number,
): Promise<string> {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
  }
  const path = join(dir, name);
  await writeFile(path, await nodeCodec.encode({ data, width: w, height: h }, { format: 'png' }));
  return path;
}

describe('compositeImages', () => {
  it('кладе накладене в центр і не чіпає кути', async () => {
    const over = await solidPng('over.png', 20, 20, 0, 0, 255);
    const out = join(dir, 'composited.png');
    const res = await compositeImages({
      input: srcPath, output: out,
      overlays: [{ path: over, x: 0.5, y: 0.5, scale: 0.4 }],
    });
    expect(res.width).toBe(200);
    expect(res.height).toBe(100);

    const img = await nodeCodec.decode(await readFile(out), 'image/png');
    const at = (x: number, y: number): number[] => {
      const i = (y * img.width + x) * 4;
      return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!];
    };
    expect(at(100, 50)[2]).toBeGreaterThan(200);
    expect(at(2, 2)[0]).toBeGreaterThan(180);
  });

  it('прозорість домішує основу', async () => {
    const over = await solidPng('over-half.png', 20, 20, 0, 0, 255);
    const out = join(dir, 'half.png');
    await compositeImages({
      input: srcPath, output: out,
      overlays: [{ path: over, x: 0.5, y: 0.5, scale: 0.4, opacity: 0.5 }],
    });
    const img = await nodeCodec.decode(await readFile(out), 'image/png');
    const i = (50 * img.width + 100) * 4;
    // Половина синього поверх rgb(200,30,40): синій десь посередині
    expect(img.data[i + 2]!).toBeGreaterThan(100);
    expect(img.data[i + 2]!).toBeLessThan(190);
  });

  it('накладене повертається за теґом EXIF', async () => {
    // 40×20, ліва половина синя. З Orientation 6 воно має стати 20×40,
    // тобто після повороту синя половина опиниться згори.
    const w = 40; const h = 20;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        data[i + 2] = x < w / 2 ? 255 : 0;
        data[i] = x < w / 2 ? 0 : 255;
        data[i + 3] = 255;
      }
    }
    const plain = await nodeCodec.encode({ data, width: w, height: h }, { format: 'jpeg', quality: 95 });
    const path = join(dir, 'over-rotated.jpg');
    await writeFile(path, withExif(plain, buildExifApp1({ orientation: 6 })));

    const out = join(dir, 'oriented.png');
    await compositeImages({
      input: srcPath, output: out, overlays: [{ path, x: 0.5, y: 0.5, scale: 0.5 }],
    });
    const img = await nodeCodec.decode(await readFile(out), 'image/png');
    const at = (x: number, y: number): number[] => {
      const i = (y * img.width + x) * 4;
      return [img.data[i]!, img.data[i + 2]!];
    };
    // Шар 100 px завширшки → після повороту 50×100, центр основи 100,50.
    // Верхня половина шару має бути синьою, нижня — червоною.
    expect(at(100, 20)[1]).toBeGreaterThan(150);
    expect(at(100, 78)[0]).toBeGreaterThan(150);
  });

  it('завелике накладене зводиться до межі', async () => {
    const side = 3000;
    const big = await solidPng('huge.png', side, 10, 0, 0, 255);
    const out = join(dir, 'capped.png');
    // Без межі це був би буфер на десятки мегабайтів; перевіряємо, що
    // виклик проходить і шар лягає, а не те, скільки він важив усередині.
    const res = await compositeImages({
      input: srcPath, output: out, overlays: [{ path: big, x: 0.5, y: 0.5, scale: 0.5 }],
    });
    expect(res.width).toBe(200);
    const img = await nodeCodec.decode(await readFile(out), 'image/png');
    expect(img.data[(50 * img.width + 100) * 4 + 2]!).toBeGreaterThan(200);
  }, 60_000);

  it('порожній список — помилка, а не тихий прохід', async () => {
    await expect(compositeImages({
      input: srcPath, output: join(dir, 'never.png'), overlays: [],
    })).rejects.toThrow(/хоча б одне/);
  });
});
