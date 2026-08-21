import { readFile } from 'node:fs/promises';
import { describe, it, expect } from 'vitest';
import { ensureFixture } from '../../../scripts/fixtures.mjs';
import { sniffMime } from '../src/mime.js';

const PNG = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0);
const JPEG = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0);
const WEBP = Uint8Array.of(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);

/** Збирає бокс ftyp із головним брендом і списком сумісних. */
function ftyp(major: string, compatible: readonly string[]): Uint8Array {
  const chars = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));
  const size = 16 + compatible.length * 4;
  return Uint8Array.of(
    (size >> 24) & 255, (size >> 16) & 255, (size >> 8) & 255, size & 255,
    ...chars('ftyp'), ...chars(major), 0, 0, 0, 0,
    ...compatible.flatMap(chars),
  );
}

describe('sniffMime', () => {
  it('визначає PNG', () => expect(sniffMime(PNG)).toBe('image/png'));
  it('визначає JPEG', () => expect(sniffMime(JPEG)).toBe('image/jpeg'));
  it('визначає WebP', () => expect(sniffMime(WEBP)).toBe('image/webp'));

  it('визначає AVIF за головним брендом', () => {
    expect(sniffMime(ftyp('avif', ['mif1', 'miaf']))).toBe('image/avif');
  });

  it('визначає AVIF-послідовність', () => {
    expect(sniffMime(ftyp('avis', ['msf1']))).toBe('image/avif');
  });

  it('визначає HEIC за головним брендом', () => {
    expect(sniffMime(ftyp('heic', ['mif1']))).toBe('image/heic');
  });

  it('знаходить heic серед сумісних брендів, коли головний — mif1', () => {
    // Саме так виглядає перевірений файл із набору conformance.
    expect(sniffMime(ftyp('mif1', ['heic', 'mif1']))).toBe('image/heic');
  });

  it('не приймає AVIF за HEIC через спільний бренд mif1', () => {
    // У AVIF `mif1` майже завжди є серед сумісних. Якби HEIF перевірявся
    // першим, кожен AVIF читався б через libheif замість власного кодека.
    expect(sniffMime(ftyp('avif', ['mif1', 'miaf', 'MA1B']))).toBe('image/avif');
  });

  it('впізнає справжній файл HEIC', async () => {
    const bytes = new Uint8Array(await readFile(await ensureFixture('sample.heic')));
    expect(sniffMime(bytes)).toBe('image/heic');
  }, 30_000);

  it('ISO-контейнер із чужим брендом лишається невідомим', () => {
    expect(sniffMime(ftyp('mp42', ['isom']))).toBeNull();
  });

  it('повертає null для невідомого вмісту', () => {
    expect(sniffMime(Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12))).toBeNull();
  });

  it('повертає null для закороткого буфера', () => {
    expect(sniffMime(Uint8Array.of(0x89, 0x50))).toBeNull();
  });

  it('не виходить за межі буфера на брехливому розмірі боксу', () => {
    const lying = ftyp('heic', []);
    lying[3] = 0xff; // бокс оголошує 255 байтів, а їх шістнадцять
    expect(() => sniffMime(lying)).not.toThrow();
  });
});
