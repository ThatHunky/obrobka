import type { RasterImage, RGBA } from '../src/types.js';

export function solidImage(width: number, height: number, color: RGBA): RasterImage {
  if (width < 1 || height < 1) {
    throw new RangeError(`Розмір має бути додатним, отримано ${width}×${height}`);
  }
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = color.r; data[i + 1] = color.g; data[i + 2] = color.b; data[i + 3] = color.a;
  }
  return { data, width, height };
}

export function checkerImage(
  width: number, height: number, cell: number, a: RGBA, b: RGBA,
): RasterImage {
  const img = solidImage(width, height, a);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const odd = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 1;
      if (!odd) continue;
      const i = (y * width + x) * 4;
      img.data[i] = b.r; img.data[i + 1] = b.g; img.data[i + 2] = b.b; img.data[i + 3] = b.a;
    }
  }
  return img;
}

export function pixelAt(img: RasterImage, x: number, y: number): RGBA {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) {
    throw new RangeError(`Піксель (${x}, ${y}) поза межами ${img.width}×${img.height}`);
  }
  const i = (y * img.width + x) * 4;
  return { r: img.data[i]!, g: img.data[i + 1]!, b: img.data[i + 2]!, a: img.data[i + 3]! };
}

/** Порівняння з допуском — ресемплінг дає похибку округлення. */
export function expectPixel(
  img: RasterImage, x: number, y: number, expected: RGBA, tolerance = 0,
): void {
  const got = pixelAt(img, x, y);
  for (const k of ['r', 'g', 'b', 'a'] as const) {
    if (Math.abs(got[k] - expected[k]) > tolerance) {
      throw new Error(
        `Піксель (${x}, ${y}) канал ${k}: очікувалось ${expected[k]}±${tolerance}, ` +
        `отримано ${got[k]}. Повний піксель: ${JSON.stringify(got)}`,
      );
    }
  }
}
