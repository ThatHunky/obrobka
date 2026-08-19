import type { RasterImage } from '@obrobka/core';

/**
 * Фотореалістична фікстура: освітлена куля з м'якою тінню на градієнтному
 * тлі із зерном.
 *
 * Плаский круг із різким краєм для цих моделей — вхід поза розподілом:
 * результат стрибав від 0.97 до 0.03 лише від того, збільшували ми
 * зображення чи ні. Куля з градієнтом, відблиском і згладженим краєм
 * дає стабільну маску на будь-якому масштабі джерела.
 *
 * Куля займає π · 0.26² ≈ 21.2 % кадру — це і є очікувана площа маски.
 */
export const SPHERE_AREA_FRACTION = Math.PI * 0.26 * 0.26;

export function sphereImage(size: number): RasterImage {
  const data = new Uint8ClampedArray(size * size * 4);
  const cx = size * 0.5, cy = size * 0.48, R = size * 0.26;
  let seed = 12345;
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const t = y / size;
      const n = (rnd() - 0.5) * 14;
      let r = 118 + t * 44 + n, g = 126 + t * 40 + n, b = 138 + t * 34 + n;

      // м'яка тінь під кулею
      const sd = Math.hypot((x - cx) / (R * 1.25), (y - (cy + R * 0.92)) / (R * 0.32));
      if (sd < 1) { const k = (1 - sd) * 0.42; r *= 1 - k; g *= 1 - k; b *= 1 - k; }

      // куля: розсіяне світло, відблиск, згладжений край
      const dx = (x - cx) / R, dy = (y - cy) / R, d2 = dx * dx + dy * dy;
      if (d2 < 1) {
        const z = Math.sqrt(1 - d2);
        const lambert = Math.max(0, -dx * 0.45 - dy * 0.55 + z * 0.7);
        const spec = Math.pow(Math.max(0, -dx * 0.5 - dy * 0.62 + z * 0.6), 28) * 205;
        r = 34 + lambert * 196 + spec;
        g = 78 + lambert * 120 + spec;
        b = 182 + lambert * 66 + spec;
        const edge = Math.min(1, (1 - Math.sqrt(d2)) * size * 0.1);
        r = r * edge + (118 + t * 44) * (1 - edge);
        g = g * edge + (126 + t * 40) * (1 - edge);
        b = b * edge + (138 + t * 34) * (1 - edge);
      }
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  }
  return { data, width: size, height: size };
}
