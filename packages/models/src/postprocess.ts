import type { Mask } from '@obrobka/core';

/**
 * Вихід моделі → маска.
 *
 * Усі три моделі мають сигмоїду в графі й віддають значення в [0, 1],
 * що перевірено прогоном: діапазони склали рівно 0.000 … 1.000.
 * Додаткова нормалізація зіпсувала б результат, тож її тут немає —
 * лише перерахунок у байти з відсіканням.
 */
export function postprocess(raw: Float32Array, width: number, height: number): Mask {
  if (raw.length < width * height) {
    throw new RangeError(
      `Вихід моделі закороткий: ${raw.length} значень для маски ${width}×${height}`,
    );
  }
  const data = new Uint8ClampedArray(width * height);
  for (let i = 0; i < data.length; i++) data[i] = raw[i]! * 255;
  return { data, width, height };
}
