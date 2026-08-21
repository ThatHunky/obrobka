import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Mask, Segmenter } from '@obrobka/core';
import { sphereImage, SPHERE_AREA_FRACTION } from './fixture.js';

function centerOf(m: Mask): number {
  return m.data[Math.round(m.height * 0.48) * m.width + Math.round(m.width * 0.5)]!;
}

/** Частка пікселів, впевнено віднесених до суб'єкта. */
function areaFraction(m: Mask): number {
  let above = 0;
  for (const v of m.data) if (v > 128) above++;
  return above / m.data.length;
}

export interface SegmenterCase {
  readonly label: string;
  readonly make: () => Segmenter;
  /**
   * Чи призначена модель для будь-яких сюжетів.
   *
   * MODNet — портретна: на неживих об'єктах він дає рвану маску з клаптів.
   * Вимагати від нього точної площі означало б писати крихкий тест, тож
   * для нього перевіряється лише те, що маска не вироджена.
   */
  readonly general: boolean;
}

/** Контракт сегментатора. Виконується проти будь-якої реалізації порту. */
export function testSegmenterContract(suite: string, cases: readonly SegmenterCase[]): void {
  for (const c of cases) {
    describe(`Segmenter contract: ${suite} / ${c.label}`, () => {
      const seg = c.make();
      beforeAll(async () => { await seg.load(); }, 300_000);
      afterAll(async () => { await seg.dispose(); });

      it('маска має роздільність входу моделі', async () => {
        const m = await seg.segment(sphereImage(512));
        expect(m.width).toBeGreaterThan(0);
        expect(m.data.length).toBe(m.width * m.height);
      }, 120_000);

      it('значення лежать у 0..255', async () => {
        const m = await seg.segment(sphereImage(512));
        let min = 255, max = 0;
        for (const v of m.data) { if (v < min) min = v; if (v > max) max = v; }
        expect(min).toBeGreaterThanOrEqual(0);
        expect(max).toBeLessThanOrEqual(255);
      }, 120_000);

      it('розмір джерела не впливає на форму виходу', async () => {
        const a = await seg.segment(sphereImage(256));
        const b = await seg.segment(sphereImage(1024));
        expect({ w: a.width, h: a.height }).toEqual({ w: b.width, h: b.height });
      }, 180_000);

      it('результат детермінований', async () => {
        const a = await seg.segment(sphereImage(512));
        const b = await seg.segment(sphereImage(512));
        expect(Array.from(a.data.slice(0, 4096)))
          .toEqual(Array.from(b.data.slice(0, 4096)));
      }, 180_000);

      if (c.general) {
        it('знаходить кулю з правильною площею', async () => {
          const m = await seg.segment(sphereImage(512));
          expect(centerOf(m)).toBeGreaterThan(200);
          // Куля займає π·0.26² ≈ 21.2 % кадру
          expect(areaFraction(m)).toBeGreaterThan(SPHERE_AREA_FRACTION - 0.05);
          expect(areaFraction(m)).toBeLessThan(SPHERE_AREA_FRACTION + 0.05);
        }, 120_000);

        it('масштаб джерела не змінює площу маски', async () => {
          const small = areaFraction(await seg.segment(sphereImage(256)));
          const large = areaFraction(await seg.segment(sphereImage(2048)));
          expect(Math.abs(small - large)).toBeLessThan(0.03);
        }, 300_000);
      } else {
        it('портретна модель дає невироджену маску', async () => {
          const m = await seg.segment(sphereImage(512));
          const area = areaFraction(m);
          // Ні порожньо, ні суцільно: модель щось знайшла, але точність
          // на неживому сюжеті не гарантується й не перевіряється.
          expect(area).toBeGreaterThan(0.01);
          expect(area).toBeLessThan(0.9);
        }, 120_000);
      }
    });
  }
}
