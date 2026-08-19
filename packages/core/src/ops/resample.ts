import type { RasterImage } from '../types.js';

/** Внесок одного вихідного відліку: з якого індексу і з якими вагами. */
interface Contribution {
  readonly start: number;
  readonly weights: Float32Array;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Ваги для однієї осі.
 * Збільшення — білінійна інтерполяція (2 відліки).
 * Зменшення — усереднення по площі (стільки відліків, скільки накриває піксель).
 */
function buildContributions(srcLen: number, dstLen: number): Contribution[] {
  const out: Contribution[] = [];
  const ratio = srcLen / dstLen;

  if (dstLen >= srcLen) {
    for (let i = 0; i < dstLen; i++) {
      const center = (i + 0.5) * ratio - 0.5;
      const x0 = Math.floor(center);
      const t = center - x0;
      const a = clamp(x0, 0, srcLen - 1);
      const b = clamp(x0 + 1, 0, srcLen - 1);
      out.push(a === b
        ? { start: a, weights: Float32Array.of(1) }
        : { start: a, weights: Float32Array.of(1 - t, t) });
    }
    return out;
  }

  for (let i = 0; i < dstLen; i++) {
    const left = i * ratio;
    const right = (i + 1) * ratio;
    const first = Math.floor(left);
    const last = clamp(Math.ceil(right) - 1, first, srcLen - 1);
    const n = last - first + 1;
    const weights = new Float32Array(n);
    let sum = 0;
    for (let k = 0; k < n; k++) {
      const overlap = Math.min(right, first + k + 1) - Math.max(left, first + k);
      const w = overlap > 0 ? overlap : 0;
      weights[k] = w;
      sum += w;
    }
    for (let k = 0; k < n; k++) weights[k]! /= sum;
    out.push({ start: first, weights });
  }
  return out;
}

/**
 * Змінює роздільність зображення.
 *
 * Працює з premultiplied alpha: перед згорткою канали кольору множаться на
 * альфу, після — діляться назад. Без цього колір повністю прозорих пікселів
 * (зазвичай чорний) затікає в сусідні непрозорі й дає темний контур —
 * найпомітніше на PNG зі знятим фоном.
 */
export function resample(img: RasterImage, width: number, height: number): RasterImage {
  if (width < 1 || height < 1) {
    throw new RangeError(`Цільовий розмір має бути додатним, отримано ${width}×${height}`);
  }
  if (width === img.width && height === img.height) {
    return { data: new Uint8ClampedArray(img.data), width, height };
  }

  const src = img.data;
  const horizontal = buildContributions(img.width, width);

  // Горизонтальний прохід: читаємо Uint8, домножуємо на альфу, пишемо у Float32.
  const tmp = new Float32Array(width * img.height * 4);
  for (let y = 0; y < img.height; y++) {
    const srcRow = y * img.width * 4;
    const dstRow = y * width * 4;
    for (let x = 0; x < width; x++) {
      const c = horizontal[x]!;
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = 0; k < c.weights.length; k++) {
        const si = srcRow + (c.start + k) * 4;
        const w = c.weights[k]!;
        const sa = src[si + 3]!;
        const pm = (sa / 255) * w;
        r += src[si]! * pm;
        g += src[si + 1]! * pm;
        b += src[si + 2]! * pm;
        a += sa * w;
      }
      const di = dstRow + x * 4;
      tmp[di] = r; tmp[di + 1] = g; tmp[di + 2] = b; tmp[di + 3] = a;
    }
  }

  // Вертикальний прохід: згортаємо, ділимо назад на альфу, пишемо Uint8.
  const vertical = buildContributions(img.height, height);
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const c = vertical[y]!;
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = 0; k < c.weights.length; k++) {
        const si = ((c.start + k) * width + x) * 4;
        const w = c.weights[k]!;
        r += tmp[si]! * w;
        g += tmp[si + 1]! * w;
        b += tmp[si + 2]! * w;
        a += tmp[si + 3]! * w;
      }
      const di = (y * width + x) * 4;
      if (a > 0) {
        const inv = 255 / a;
        out[di] = r * inv; out[di + 1] = g * inv; out[di + 2] = b * inv;
      }
      out[di + 3] = a;
    }
  }

  return { data: out, width, height };
}
