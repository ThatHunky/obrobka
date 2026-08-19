import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nodeCodec } from '@obrobka/codecs/node';
import { convertImage, resizeImage } from '../src/tools.js';

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
