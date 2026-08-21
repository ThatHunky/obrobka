import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { ensureFixture } from '../../../scripts/fixtures.mjs';
import { decodeHeic } from '../src/index.js';

let bytes: Uint8Array;

beforeAll(async () => {
  bytes = new Uint8Array(await readFile(await ensureFixture('sample.heic')));
}, 30_000);

/** Проста контрольна сума — щоб відрізнити два зображення одне від одного. */
function checksum(data: Uint8ClampedArray): number {
  let s = 0;
  for (let i = 0; i < data.length; i += 4001) s += data[i]!;
  return s;
}

describe('decodeHeic', () => {
  it('віддає RGBA потрібного розміру', async () => {
    const img = await decodeHeic(bytes);
    expect([img.width, img.height]).toEqual([1280, 720]);
    expect(img.data.length).toBe(1280 * 720 * 4);
  });

  it('канал альфи заповнено, а не лишено нулями', async () => {
    const img = await decodeHeic(bytes);
    // Порожня альфа дала б повністю прозоре зображення — помилка,
    // яку легко не помітити на прев'ю з білим тлом.
    expect(img.data[3]).toBe(255);
    expect(img.data.at(-1)).toBe(255);
  });

  it('картинка не порожня', async () => {
    const img = await decodeHeic(bytes);
    const unique = new Set<number>();
    for (let i = 0; i < img.data.length; i += 4 * 997) unique.add(img.data[i]!);
    expect(unique.size).toBeGreaterThan(10);
  });

  it('бере головне зображення, а не перше-ліпше', async () => {
    // У цьому файлі два зображення верхнього рівня з різним вмістом.
    // Головне має контрольну суму 170530; друге — 171454.
    const img = await decodeHeic(bytes);
    expect(checksum(img.data)).toBe(170530);
  });

  it('повторний виклик дає той самий результат — модуль перевикористовується', async () => {
    const a = await decodeHeic(bytes);
    const b = await decodeHeic(bytes);
    expect(checksum(b.data)).toBe(checksum(a.data));
  });

  it('два паралельні виклики не заважають один одному', async () => {
    const [a, b] = await Promise.all([decodeHeic(bytes), decodeHeic(bytes)]);
    expect(checksum(a.data)).toBe(checksum(b.data));
  });

  it('чужі байти дають зрозумілу помилку, а не мовчазний збій', async () => {
    await expect(decodeHeic(new Uint8Array(256).fill(0x41)))
      .rejects.toThrow(/HEIC/);
  });

  it('обірваний файл не лишає по собі зависання', async () => {
    await expect(decodeHeic(bytes.subarray(0, 400))).rejects.toThrow();
  });
});
