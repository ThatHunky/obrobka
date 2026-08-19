import { describe, it, expect } from 'vitest';
import type { Codec, RasterImage, RGBA } from '@obrobka/core';

function solid(width: number, height: number, c: RGBA): RasterImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = c.r; data[i + 1] = c.g; data[i + 2] = c.b; data[i + 3] = c.a;
  }
  return { data, width, height };
}

function pixel(img: RasterImage, x: number, y: number): RGBA {
  const i = (y * img.width + x) * 4;
  return { r: img.data[i]!, g: img.data[i + 1]!, b: img.data[i + 2]!, a: img.data[i + 3]! };
}

/**
 * Контракт кодека. Виконується проти будь-якої реалізації Codec.
 * Якщо браузерний і Node-адаптери розходяться, це видно тут.
 */
export function testCodecContract(name: string, codec: Codec): void {
  describe(`Codec contract: ${name}`, () => {
    const RED: RGBA = { r: 220, g: 30, b: 40, a: 255 };

    it('оголошує підтримку основних форматів', () => {
      for (const m of ['image/png', 'image/jpeg', 'image/webp', 'image/avif']) {
        expect(codec.canDecode(m), m).toBe(true);
      }
      for (const f of ['png', 'jpeg', 'webp', 'avif'] as const) {
        expect(codec.canEncode(f), f).toBe(true);
      }
    });

    it('PNG робить обіг без втрат', async () => {
      const src = solid(8, 8, RED);
      const bytes = await codec.encode(src, { format: 'png' });
      const back = await codec.decode(bytes, 'image/png');
      expect(back.width).toBe(8);
      expect(back.height).toBe(8);
      expect(pixel(back, 4, 4)).toEqual(RED);
    });

    it('PNG зберігає прозорість', async () => {
      const src = solid(8, 8, { r: 10, g: 20, b: 30, a: 0 });
      const bytes = await codec.encode(src, { format: 'png' });
      const back = await codec.decode(bytes, 'image/png');
      expect(pixel(back, 0, 0).a).toBe(0);
    });

    it('JPEG зберігає розмір і приблизний колір', async () => {
      const src = solid(16, 16, RED);
      const bytes = await codec.encode(src, { format: 'jpeg', quality: 90 });
      const back = await codec.decode(bytes, 'image/jpeg');
      expect(back.width).toBe(16);
      const p = pixel(back, 8, 8);
      expect(Math.abs(p.r - RED.r)).toBeLessThan(12);
      expect(p.a).toBe(255);
    });

    it('WebP робить обіг зі збереженням розміру', async () => {
      const src = solid(16, 16, RED);
      const bytes = await codec.encode(src, { format: 'webp', quality: 90 });
      const back = await codec.decode(bytes, 'image/webp');
      expect(back.width).toBe(16);
      expect(back.height).toBe(16);
    });

    it('AVIF робить обіг зі збереженням розміру', async () => {
      const src = solid(16, 16, RED);
      const bytes = await codec.encode(src, { format: 'avif', quality: 70 });
      const back = await codec.decode(bytes, 'image/avif');
      expect(back.width).toBe(16);
      expect(back.height).toBe(16);
    }, 30_000);
  });
}
