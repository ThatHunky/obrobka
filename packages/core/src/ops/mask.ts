import type { Mask, Rect } from '../types.js';

const DEFAULT_THRESHOLD = 128;

/**
 * Прямокутник, що охоплює всі пікселі маски вище порогу.
 *
 * Це і є «визначення суб'єкта»: окрема модель детекції не потрібна,
 * бо маска сегментації вже містить потрібну інформацію.
 */
export function maskBBox(mask: Mask, threshold = DEFAULT_THRESHOLD): Rect {
  let minX = mask.width, minY = mask.height, maxX = -1, maxY = -1;
  for (let y = 0; y < mask.height; y++) {
    const row = y * mask.width;
    for (let x = 0; x < mask.width; x++) {
      if (mask.data[row + x]! < threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) {
    throw new RangeError(
      `Не вдалося знайти суб'єкт: жоден піксель маски не перевищує поріг ${threshold}`,
    );
  }
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Змінює роздільність маски білінійно.
 *
 * На відміну від resample для RGBA, premultiply тут не потрібен:
 * маска — це і є альфа, множити її нема на що.
 */
export function resampleMask(mask: Mask, width: number, height: number): Mask {
  if (width < 1 || height < 1) {
    throw new RangeError(`Цільовий розмір має бути додатним, отримано ${width}×${height}`);
  }
  if (width === mask.width && height === mask.height) {
    return { data: new Uint8ClampedArray(mask.data), width, height };
  }

  const out = new Uint8ClampedArray(width * height);
  const sx = mask.width / width;
  const sy = mask.height / height;

  for (let y = 0; y < height; y++) {
    const fy = Math.min(mask.height - 1, Math.max(0, (y + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(mask.height - 1, y0 + 1);
    const ty = fy - y0;

    for (let x = 0; x < width; x++) {
      const fx = Math.min(mask.width - 1, Math.max(0, (x + 0.5) * sx - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(mask.width - 1, x0 + 1);
      const tx = fx - x0;

      const a = mask.data[y0 * mask.width + x0]!;
      const b = mask.data[y0 * mask.width + x1]!;
      const c = mask.data[y1 * mask.width + x0]!;
      const d = mask.data[y1 * mask.width + x1]!;

      out[y * width + x] =
        (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    }
  }
  return { data: out, width, height };
}

/** Максимум у круговому околі радіуса r — класична морфологічна дилатація. */
export function dilateMask(mask: Mask, radius: number): Mask {
  const r = Math.round(radius);
  if (r <= 0) {
    return { data: new Uint8ClampedArray(mask.data), width: mask.width, height: mask.height };
  }

  const out = new Uint8ClampedArray(mask.data.length);
  const r2 = r * r;
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      let best = 0;
      for (let dy = -r; dy <= r && best < 255; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= mask.height) continue;
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r2) continue;
          const xx = x + dx;
          if (xx < 0 || xx >= mask.width) continue;
          const v = mask.data[yy * mask.width + xx]!;
          if (v > best) { best = v; if (best === 255) break; }
        }
      }
      out[y * mask.width + x] = best;
    }
  }
  return { data: out, width: mask.width, height: mask.height };
}

/**
 * Пом'якшення краю коробковим розмиттям у два проходи.
 *
 * Коробкове, а не гаусове: центр краю не зсувається, а різниця на око
 * непомітна при радіусах, які тут використовуються.
 */
export function featherMask(mask: Mask, radius: number): Mask {
  const r = Math.round(radius);
  if (r <= 0) {
    return { data: new Uint8ClampedArray(mask.data), width: mask.width, height: mask.height };
  }

  const tmp = new Float32Array(mask.data.length);
  const out = new Uint8ClampedArray(mask.data.length);
  const span = r * 2 + 1;

  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) {
        const xx = Math.min(mask.width - 1, Math.max(0, x + k));
        sum += mask.data[y * mask.width + xx]!;
      }
      tmp[y * mask.width + x] = sum / span;
    }
  }
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) {
        const yy = Math.min(mask.height - 1, Math.max(0, y + k));
        sum += tmp[yy * mask.width + x]!;
      }
      out[y * mask.width + x] = sum / span;
    }
  }
  return { data: out, width: mask.width, height: mask.height };
}

/** Різкий поріг: усе вище стає 255, решта 0. */
export function thresholdMask(mask: Mask, threshold = DEFAULT_THRESHOLD): Mask {
  const out = new Uint8ClampedArray(mask.data.length);
  for (let i = 0; i < mask.data.length; i++) {
    out[i] = mask.data[i]! >= threshold ? 255 : 0;
  }
  return { data: out, width: mask.width, height: mask.height };
}
