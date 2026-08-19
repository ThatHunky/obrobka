import type { FitOptions, Position, RasterImage, RGBA } from '../types.js';
import { TRANSPARENT } from '../types.js';
import { resample } from './resample.js';
import { crop } from './crop.js';

function solid(width: number, height: number, color: RGBA): RasterImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = color.r; data[i + 1] = color.g; data[i + 2] = color.b; data[i + 3] = color.a;
  }
  return { data, width, height };
}

/** Зміщення внутрішнього прямокутника всередині зовнішнього. */
function place(
  outerW: number, outerH: number, innerW: number, innerH: number, position: Position,
): readonly [number, number] {
  if (typeof position === 'object') return [Math.round(position.x), Math.round(position.y)];
  const cx = Math.round((outerW - innerW) / 2);
  const cy = Math.round((outerH - innerH) / 2);
  switch (position) {
    case 'top': return [cx, 0];
    case 'bottom': return [cx, outerH - innerH];
    case 'left': return [0, cy];
    case 'right': return [outerW - innerW, cy];
    default: return [cx, cy];
  }
}

/** Копіює src у dst зі зміщенням, обрізаючи те, що не влазить. */
function blit(dst: RasterImage, src: RasterImage, ox: number, oy: number): void {
  const x0 = Math.max(0, ox);
  const y0 = Math.max(0, oy);
  const x1 = Math.min(dst.width, ox + src.width);
  const y1 = Math.min(dst.height, oy + src.height);
  if (x1 <= x0 || y1 <= y0) return;

  const rowBytes = (x1 - x0) * 4;
  for (let y = y0; y < y1; y++) {
    const srcStart = ((y - oy) * src.width + (x0 - ox)) * 4;
    dst.data.set(src.data.subarray(srcStart, srcStart + rowBytes), (y * dst.width + x0) * 4);
  }
}

/**
 * Приводить зображення до цільового розміру за одним із п'яти режимів.
 *
 * allowUpscale діє лише для contain та inside. Режими cover, outside і fill
 * зобов'язані досягти свого розміру, тож збільшують незалежно від прапорця.
 */
export function fit(img: RasterImage, opts: FitOptions): RasterImage {
  const { width: tw, height: th, mode } = opts;
  if (tw < 1 || th < 1) {
    throw new RangeError(`Цільовий розмір має бути додатним, отримано ${tw}×${th}`);
  }

  if (mode === 'fill') return resample(img, tw, th);

  const fitsInside = mode === 'contain' || mode === 'inside';
  const byWidth = tw / img.width;
  const byHeight = th / img.height;
  let scale = fitsInside ? Math.min(byWidth, byHeight) : Math.max(byWidth, byHeight);
  if (fitsInside && scale > 1 && opts.allowUpscale !== true) scale = 1;

  const rw = Math.max(1, Math.round(img.width * scale));
  const rh = Math.max(1, Math.round(img.height * scale));
  const scaled = resample(img, rw, rh);

  if (mode === 'inside' || mode === 'outside') return scaled;

  const position = opts.position ?? 'center';

  if (mode === 'contain') {
    const padColor = opts.pad === undefined || opts.pad === 'transparent'
      ? TRANSPARENT
      : opts.pad;
    const canvas = solid(tw, th, padColor);
    const [ox, oy] = place(tw, th, rw, rh, position);
    blit(canvas, scaled, ox, oy);
    return canvas;
  }

  // cover: масштабоване зображення не менше за ціль, лишається вирізати кадр
  const [rawX, rawY] = place(rw, rh, tw, th, position);
  const x = Math.min(Math.max(rawX, 0), rw - tw);
  const y = Math.min(Math.max(rawY, 0), rh - th);
  return crop(scaled, { x, y, width: tw, height: th });
}
