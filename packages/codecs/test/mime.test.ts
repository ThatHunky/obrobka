import { describe, it, expect } from 'vitest';
import { sniffMime } from '../src/mime.js';

const PNG = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0);
const JPEG = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0);
const WEBP = Uint8Array.of(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);
const AVIF = Uint8Array.of(0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66);

describe('sniffMime', () => {
  it('визначає PNG', () => expect(sniffMime(PNG)).toBe('image/png'));
  it('визначає JPEG', () => expect(sniffMime(JPEG)).toBe('image/jpeg'));
  it('визначає WebP', () => expect(sniffMime(WEBP)).toBe('image/webp'));
  it('визначає AVIF', () => expect(sniffMime(AVIF)).toBe('image/avif'));

  it('повертає null для невідомого вмісту', () => {
    expect(sniffMime(Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12))).toBeNull();
  });

  it('повертає null для закороткого буфера', () => {
    expect(sniffMime(Uint8Array.of(0x89, 0x50))).toBeNull();
  });
});
