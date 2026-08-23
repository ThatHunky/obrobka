import type { BlendMode, Layer, RasterImage } from '../types.js';
import { resample } from './resample.js';

/**
 * Формули змішування, канали 0..1.
 *
 * Набір навмисно малий: це ті режими, які людина справді розрізняє на око
 * й уміє назвати. Решта з PDF-специфікації відрізняється так, що пояснити
 * її в підказці на два рядки неможливо.
 */
const BLEND: Record<BlendMode, (b: number, s: number) => number> = {
  normal: (_b, s) => s,
  multiply: (b, s) => b * s,
  screen: (b, s) => b + s - b * s,
  overlay: (b, s) => (b <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s)),
  darken: (b, s) => Math.min(b, s),
  lighten: (b, s) => Math.max(b, s),
};

/** Білінійна вибірка з premultiplied-буфера. Поза межами — прозорість. */
function sample(
  src: Float32Array, w: number, h: number, x: number, y: number, out: Float32Array,
): void {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 0;
  for (let dy = 0; dy < 2; dy++) {
    const sy = y0 + dy;
    if (sy < 0 || sy >= h) continue;
    const wy = dy === 0 ? 1 - ty : ty;
    if (wy === 0) continue;
    for (let dx = 0; dx < 2; dx++) {
      const sx = x0 + dx;
      if (sx < 0 || sx >= w) continue;
      const weight = wy * (dx === 0 ? 1 - tx : tx);
      if (weight === 0) continue;
      const i = (sy * w + sx) * 4;
      out[0]! += src[i]! * weight;
      out[1]! += src[i + 1]! * weight;
      out[2]! += src[i + 2]! * weight;
      out[3]! += src[i + 3]! * weight;
    }
  }
}

/** Переводить RGBA 0..255 зі звичайною альфою в premultiplied 0..1. */
function premultiply(img: RasterImage): Float32Array {
  const out = new Float32Array(img.width * img.height * 4);
  for (let i = 0; i < out.length; i += 4) {
    const a = img.data[i + 3]! / 255;
    out[i] = (img.data[i]! / 255) * a;
    out[i + 1] = (img.data[i + 1]! / 255) * a;
    out[i + 2] = (img.data[i + 2]! / 255) * a;
    out[i + 3] = a;
  }
  return out;
}

/**
 * Кладе один шар на полотно.
 *
 * Спершу масштаб наявним resample, і лише потім поворот. Спокуса зробити
 * одним зворотним афінним перетвором дає гірший результат: resample при
 * зменшенні усереднює по площі, а білінійна вибірка бере два відліки
 * незалежно від того, скільки пікселів накриває один вихідний. Логотип
 * 2000 px, зведений до 200 px, розсипався б на аліасинг. Поворот уже
 * правильно розміреного шару — приблизно 1:1, там вибірки досить.
 */
function drawLayer(dst: Uint8ClampedArray, dw: number, dh: number, layer: Layer): void {
  const renderW = Math.max(1, Math.round(layer.scale * dw));
  const renderH = Math.max(1, Math.round(renderW * (layer.image.height / layer.image.width)));
  const src = premultiply(resample(layer.image, renderW, renderH));

  const cx = layer.x * dw;
  const cy = layer.y * dh;
  const rad = ((layer.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(-rad);
  const sin = Math.sin(-rad);

  /**
   * Без повороту шар кладеться просто на сітку пікселів.
   *
   * Загальний шлях відображає кожну точку через тригонометрію, і при
   * непарній ширині halfW ставав дробовим: шар з'їжджав на пів пікселя,
   * вибірка змішувала двох сусідів, і в непрозорого логотипа з'являлась
   * напівпрозора облямівка. Виміряно на шарі 51×51: 204 змішані пікселі
   * проти нуля при ширині 50. Повзунок розміру ходить відсотками, тож
   * під це підпадала приблизно половина його положень.
   */
  const upright = Math.abs(rad) < 1e-6;
  const ox = Math.round(cx - renderW / 2);
  const oy = Math.round(cy - renderH / 2);

  // Габарит повернутого шару: інакше довелось би обходити все полотно.
  const halfW = renderW / 2;
  const halfH = renderH / 2;
  const spanX = Math.abs(halfW * Math.cos(rad)) + Math.abs(halfH * Math.sin(rad));
  const spanY = Math.abs(halfW * Math.sin(rad)) + Math.abs(halfH * Math.cos(rad));
  const x0 = Math.max(0, Math.floor(cx - spanX));
  const y0 = Math.max(0, Math.floor(cy - spanY));
  const x1 = Math.min(dw, Math.ceil(cx + spanX));
  const y1 = Math.min(dh, Math.ceil(cy + spanY));
  if (x1 <= x0 || y1 <= y0) return;

  const opacity = layer.opacity ?? 1;
  const blend = BLEND[layer.blend ?? 'normal'];
  const px = new Float32Array(4);

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      let sx: number;
      let sy: number;
      if (upright) {
        // Цілі координати — і та сама вибірка дає точний відлік,
        // бо вага другого сусіда виходить нульова.
        sx = x - ox;
        sy = y - oy;
      } else {
        const ux = x + 0.5 - cx;
        const uy = y + 0.5 - cy;
        sx = ux * cos - uy * sin + halfW - 0.5;
        sy = ux * sin + uy * cos + halfH - 0.5;
      }
      sample(src, renderW, renderH, sx, sy, px);

      const sa = px[3]! * opacity;
      if (sa <= 0) continue;

      const i = (y * dw + x) * 4;
      const ba = dst[i + 3]! / 255;
      const outA = sa + ba * (1 - sa);
      if (outA <= 0) { dst[i + 3] = 0; continue; }

      for (let c = 0; c < 3; c++) {
        // Шар лежить у premultiplied, основа — у звичайній альфі.
        const sc = px[c]! / px[3]!;
        const bc = dst[i + c]! / 255;
        // Змішування діє лише там, де під шаром щось є: над порожнечею
        // multiply дав би чорноту замість самого шару.
        const mixed = (1 - ba) * sc + ba * blend(bc, sc);
        const out = mixed * sa + bc * ba * (1 - sa);
        dst[i + c] = Math.round((out / outA) * 255);
      }
      dst[i + 3] = Math.round(outA * 255);
    }
  }
}

/** Накладає шари на основу в порядку масиву: перший — найнижче. */
export function composite(base: RasterImage, layers: readonly Layer[]): RasterImage {
  const data = new Uint8ClampedArray(base.data);
  for (const layer of layers) {
    if (layer.image.width < 1 || layer.image.height < 1) continue;
    if (!(layer.scale > 0)) continue;
    drawLayer(data, base.width, base.height, layer);
  }
  return { data, width: base.width, height: base.height };
}
