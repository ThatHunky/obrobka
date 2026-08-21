import type { Codec, RasterImage } from '@obrobka/core';
import { describe, expect, it, vi } from 'vitest';
import { withDecoder } from '../src/compose.js';

const IMG: RasterImage = { data: new Uint8ClampedArray(4), width: 1, height: 1 };

function fakeCodec(): Codec {
  return {
    canDecode: (m) => m === 'image/png',
    canEncode: (f) => f === 'png',
    decode: vi.fn(async () => IMG),
    encode: vi.fn(async () => Uint8Array.of(1, 2, 3)),
  };
}

describe('withDecoder', () => {
  it('бере на себе свій mime', async () => {
    const base = fakeCodec();
    const extra = vi.fn(async () => IMG);
    const codec = withDecoder(base, 'image/heic', extra);

    await codec.decode(Uint8Array.of(0), 'image/heic');
    expect(extra).toHaveBeenCalledOnce();
    expect(base.decode).not.toHaveBeenCalled();
  });

  it('решту віддає базовому кодеку без змін', async () => {
    const base = fakeCodec();
    const extra = vi.fn(async () => IMG);
    const codec = withDecoder(base, 'image/heic', extra);

    await codec.decode(Uint8Array.of(0), 'image/png');
    expect(base.decode).toHaveBeenCalledOnce();
    expect(extra).not.toHaveBeenCalled();
  });

  it('розширює canDecode рівно на один формат', () => {
    const codec = withDecoder(fakeCodec(), 'image/heic', async () => IMG);
    expect(codec.canDecode('image/heic')).toBe(true);
    expect(codec.canDecode('image/png')).toBe(true);
    expect(codec.canDecode('image/gif')).toBe(false);
  });

  it('кодування не змінюється — libheif уміє лише читати', async () => {
    const base = fakeCodec();
    const codec = withDecoder(base, 'image/heic', async () => IMG);
    expect(codec.canEncode('png')).toBe(true);
    expect(codec.canEncode('avif')).toBe(false);
    await codec.encode(IMG, { format: 'png' });
    expect(base.encode).toHaveBeenCalledOnce();
  });

  it('помилка стороннього декодера доходить до викликача', async () => {
    const codec = withDecoder(fakeCodec(), 'image/heic', () => {
      throw new Error('libheif спіткнулась');
    });
    await expect(codec.decode(Uint8Array.of(0), 'image/heic'))
      .rejects.toThrow('libheif спіткнулась');
  });
});
