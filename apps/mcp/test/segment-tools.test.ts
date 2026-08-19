import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nodeCodec } from '@obrobka/codecs/node';
import { sphereImage } from '@obrobka/contract-tests';
import { removeBackground, smartCropImage } from '../src/tools.js';

let dir = '';
let src = '';

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'obrobka-seg-'));
  src = join(dir, 'sphere.png');
  await writeFile(src, await nodeCodec.encode(sphereImage(512), { format: 'png' }));
}, 300_000);

afterAll(async () => { await rm(dir, { recursive: true, force: true }); });

describe('remove_background', () => {
  it('зберігає розмір і робить фон прозорим', async () => {
    const out = join(dir, 'nobg.png');
    const res = await removeBackground({ input: src, output: out });
    expect(res.width).toBe(512);
    const back = await nodeCodec.decode(new Uint8Array(await readFile(out)), 'image/png');
    expect(back.data[3]).toBeLessThan(60);
    const c = (Math.round(512 * 0.48) * 512 + 256) * 4;
    expect(back.data[c + 3]).toBeGreaterThan(190);
  }, 300_000);

  it('додає обведення й розширює полотно', async () => {
    const res = await removeBackground({
      input: src, output: join(dir, 'outlined.png'),
      outlineWidth: 6, outlineColor: '#0000ff',
    });
    expect(res.width).toBe(512 + 12);
  }, 300_000);

  it('відхиляє jpeg — він не має альфи', async () => {
    await expect(removeBackground({
      input: src, output: join(dir, 'bad.jpg'), format: 'jpeg' as never,
    })).rejects.toThrow(/прозор/);
  });
});

describe('smart_crop', () => {
  it('дає квадратний кадр', async () => {
    const res = await smartCropImage({
      input: src, output: join(dir, 'square.png'), aspectRatio: 1, format: 'png',
    });
    expect(res.width).toBe(res.height);
    expect(res.width).toBeLessThan(512);
  }, 300_000);

  it('дає широкий кадр для 16:9', async () => {
    const res = await smartCropImage({
      input: src, output: join(dir, 'wide.png'), aspectRatio: 16 / 9, format: 'png',
    });
    expect(res.width / res.height).toBeCloseTo(16 / 9, 1);
  }, 300_000);

  it('зберігає фон — кадр вирізано з оригіналу', async () => {
    const out = join(dir, 'kept-bg.png');
    await smartCropImage({ input: src, output: out, aspectRatio: 1, format: 'png' });
    const back = await nodeCodec.decode(new Uint8Array(await readFile(out)), 'image/png');
    // Кут кадру має лишитись непрозорим: фон не знімався
    expect(back.data[3]).toBe(255);
  }, 300_000);
});
