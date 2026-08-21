import type { RasterImage } from '../types.js';
import type { Upscaler } from '../ports/index.js';

export interface UpscaleProgress {
  (done: number, total: number): void;
}

/**
 * Збільшує зображення тайлами.
 *
 * Цілим кадром модель подати не можна: пам'ять росте з площею входу, і
 * вже на 512×512 пік сягає 1,7 ГБ — стеля wasm32 у вкладці нижча. Тайл
 * 256 для ×2 тримається в межах 561 МБ, тайл 128 для ×4 — 578 МБ.
 *
 * Тайли беруться з перекриттям і зшиваються лінійним переходом: без
 * нього на стиках лишалися б помітні шви, бо модель бачить кожен тайл
 * окремо й по-різному трактує його краї.
 */
export async function upscaleTiled(
  img: RasterImage,
  up: Upscaler,
  onProgress?: UpscaleProgress,
): Promise<RasterImage> {
  const f = up.factor;
  const tile = Math.max(32, up.tileSize);
  // Перекриття у вхідних пікселях. Чверть тайла — з запасом на плавний
  // перехід, але не настільки, щоб суттєво додати роботи.
  const overlap = Math.min(24, Math.floor(tile / 4));
  const step = tile - overlap;

  const outW = img.width * f;
  const outH = img.height * f;
  const acc = new Float32Array(outW * outH * 4);
  const weight = new Float32Array(outW * outH);

  const cols = Math.max(1, Math.ceil((img.width - overlap) / step));
  const rows = Math.max(1, Math.ceil((img.height - overlap) / step));
  const total = cols * rows;
  let done = 0;

  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      // Останній тайл притискаємо до краю, щоб не подавати моделі
      // вузьку смужку — на ній вона поводиться помітно гірше.
      const sx = Math.min(tx * step, Math.max(0, img.width - tile));
      const sy = Math.min(ty * step, Math.max(0, img.height - tile));
      const sw = Math.min(tile, img.width - sx);
      const sh = Math.min(tile, img.height - sy);

      const piece = new Uint8ClampedArray(sw * sh * 4);
      for (let y = 0; y < sh; y++) {
        const from = ((sy + y) * img.width + sx) * 4;
        piece.set(img.data.subarray(from, from + sw * 4), y * sw * 4);
      }

      const big = await up.upscale({ data: piece, width: sw, height: sh });
      blend(acc, weight, outW, outH, big, sx * f, sy * f, overlap * f);

      done++;
      onProgress?.(done, total);
    }
  }

  const data = new Uint8ClampedArray(outW * outH * 4);
  for (let i = 0, p = 0; i < weight.length; i++, p += 4) {
    const w = weight[i]!;
    if (w === 0) continue;
    data[p] = acc[p]! / w;
    data[p + 1] = acc[p + 1]! / w;
    data[p + 2] = acc[p + 2]! / w;
    data[p + 3] = acc[p + 3]! / w;
  }
  return { data, width: outW, height: outH };
}

/**
 * Домішує тайл у накопичувач із вагою, що спадає до країв.
 *
 * Вага тримається одиницею в серцевині й лінійно падає до нуля на
 * ширині перекриття. Там, де тайли накладаються, сума ваг дає рівний
 * перехід замість видимого стику.
 */
function blend(
  acc: Float32Array, weight: Float32Array, outW: number, outH: number,
  tile: RasterImage, ox: number, oy: number, fade: number,
): void {
  const ramp = (v: number, len: number): number => {
    if (fade <= 0) return 1;
    const d = Math.min(v, len - 1 - v);
    return d >= fade ? 1 : (d + 1) / (fade + 1);
  };

  for (let y = 0; y < tile.height; y++) {
    const gy = oy + y;
    if (gy < 0 || gy >= outH) continue;
    const wy = ramp(y, tile.height);
    for (let x = 0; x < tile.width; x++) {
      const gx = ox + x;
      if (gx < 0 || gx >= outW) continue;
      const w = wy * ramp(x, tile.width);
      const s = (y * tile.width + x) * 4;
      const d = (gy * outW + gx) * 4;
      acc[d] = acc[d]! + tile.data[s]! * w;
      acc[d + 1] = acc[d + 1]! + tile.data[s + 1]! * w;
      acc[d + 2] = acc[d + 2]! + tile.data[s + 2]! * w;
      acc[d + 3] = acc[d + 3]! + tile.data[s + 3]! * w;
      const wi = gy * outW + gx;
      weight[wi] = weight[wi]! + w;
    }
  }
}
