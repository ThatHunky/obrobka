import type { Mask, OutlineOptions, RasterImage } from '../types.js';
import { dilateMask, featherMask, resampleMask } from './mask.js';

/**
 * Малює кольорове обведення під суб'єктом.
 *
 * Порядок важливий: спершу на полотно кладеться розширена маска, залита
 * кольором, і лише зверху — саме зображення. Якби робили навпаки,
 * обведення з'їло б край суб'єкта.
 */
export function outline(img: RasterImage, mask: Mask, opts: OutlineOptions): RasterImage {
  const width = Math.max(0, Math.round(opts.width));
  if (width === 0) {
    return { data: new Uint8ClampedArray(img.data), width: img.width, height: img.height };
  }

  const expand = opts.expand ?? true;
  const pad = expand ? width : 0;
  const outW = img.width + pad * 2;
  const outH = img.height + pad * 2;

  const base = mask.width === img.width && mask.height === img.height
    ? mask
    : resampleMask(mask, img.width, img.height);

  // Маска обведення на розширеному полотні
  const padded = new Uint8ClampedArray(outW * outH);
  for (let y = 0; y < img.height; y++) {
    padded.set(
      base.data.subarray(y * img.width, (y + 1) * img.width),
      (y + pad) * outW + pad,
    );
  }
  let ring = dilateMask({ data: padded, width: outW, height: outH }, width);
  if (opts.feather !== undefined && opts.feather > 0) {
    ring = featherMask(ring, opts.feather);
  }

  // Полотно: обведення знизу
  const out = new Uint8ClampedArray(outW * outH * 4);
  const { r, g, b, a } = opts.color;
  for (let i = 0, p = 0; i < ring.data.length; i++, p += 4) {
    const cover = (ring.data[i]! * a) / 255;
    if (cover === 0) continue;
    out[p] = r; out[p + 1] = g; out[p + 2] = b; out[p + 3] = cover;
  }

  // Зображення зверху, звичайне source-over
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const s = (y * img.width + x) * 4;
      const sa = img.data[s + 3]!;
      if (sa === 0) continue;
      const d = ((y + pad) * outW + (x + pad)) * 4;
      const da = out[d + 3]!;
      const outA = sa + (da * (255 - sa)) / 255;
      for (let c = 0; c < 3; c++) {
        const sc = img.data[s + c]!;
        const dc = out[d + c]!;
        out[d + c] = outA === 0 ? 0 : (sc * sa + (dc * da * (255 - sa)) / 255) / outA;
      }
      out[d + 3] = outA;
    }
  }

  return { data: out, width: outW, height: outH };
}
