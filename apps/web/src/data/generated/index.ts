import type { ToolEntry } from '../page.js';
import { formatPairPages } from './format-pairs.js';
import { presetPages } from './presets.js';
import { taskPages } from './tasks.js';

/**
 * Усі породжені сторінки.
 *
 * Породжені, але не порожні. Матриця форматів несе виміряні розміри
 * й локальну похибку для кожної пари, сторінки платформ — причину саме
 * такого кадру, задачі написані поодинці. Сторінка, яку можна отримати
 * підстановкою назви формату в один шаблон, не варта того, щоб існувати.
 */
export function generatedPages(): ToolEntry[] {
  const all = [...formatPairPages(), ...presetPages(), ...taskPages()];

  // Слаг — це URL. Дублікат означав би, що одна сторінка мовчки затре іншу.
  const bySlug = new Map<string, string>();
  for (const p of all) {
    const key = `${p.locale}/${p.slug}`;
    const clash = bySlug.get(key);
    if (clash !== undefined) {
      throw new Error(`Слаг ${key} зайнятий двічі: ${clash} і ${p.id}`);
    }
    bySlug.set(key, p.id);
  }
  return all;
}
