import { describe, it, expect } from 'vitest';
import { erodeMask, despeckleMask, fillMaskHoles, maskBBox } from '../src/ops/mask.js';
import type { Mask } from '../src/types.js';

function blank(w: number, h: number): Mask {
  return { data: new Uint8ClampedArray(w * h), width: w, height: h };
}
function rect(m: Mask, x0: number, y0: number, x1: number, y1: number, v = 255): Mask {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m.data[y * m.width + x] = v;
  return m;
}
function count(m: Mask, min = 128): number {
  let n = 0; for (const v of m.data) if (v >= min) n++; return n;
}

describe('erodeMask', () => {
  it('стискає область на заданий радіус', () => {
    const m = rect(blank(40, 40), 10, 10, 30, 30);
    expect(maskBBox(erodeMask(m, 3))).toEqual({ x: 13, y: 13, width: 14, height: 14 });
  });

  it('нульовий радіус нічого не змінює', () => {
    const m = rect(blank(20, 20), 5, 5, 15, 15);
    expect(Array.from(erodeMask(m, 0).data)).toEqual(Array.from(m.data));
  });

  it('не прорізає смугу там, де суб\'єкт обрізано рамкою', () => {
    // Людина по пояс: під нижнім краєм — вона сама, а не фон
    const m = rect(blank(20, 20), 5, 5, 15, 20);
    const out = erodeMask(m, 2);
    expect(out.data[19 * 20 + 10]).toBe(255);
    expect(maskBBox(out)).toEqual({ x: 7, y: 7, width: 6, height: 13 });
  });

  it('збігається з наївним мінімумом по кругу', () => {
    let seed = 7;
    const rnd = (): number => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % 256; };
    const m = blank(23, 17);
    for (let i = 0; i < m.data.length; i++) m.data[i] = rnd();
    for (const r of [1, 2, 3, 5]) {
      const got = erodeMask(m, r);
      for (let y = 0; y < m.height; y++) {
        for (let x = 0; x < m.width; x++) {
          let worst = 255;
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              const xx = x + dx, yy = y + dy;
              if (dx * dx + dy * dy > r * r) continue;
              if (xx < 0 || yy < 0 || xx >= m.width || yy >= m.height) continue;
              worst = Math.min(worst, m.data[yy * m.width + xx]!);
            }
          }
          expect(got.data[y * m.width + x]).toBe(worst);
        }
      }
    }
  });

  it('ерозія скасовує дилатацію за площею', () => {
    const m = rect(blank(60, 60), 20, 20, 40, 40);
    const back = erodeMask(m, 2);
    expect(count(back)).toBeLessThan(count(m));
  });
});

describe('despeckleMask', () => {
  it("прибирає дрібний острівець, лишаючи головний суб'єкт", () => {
    const m = rect(blank(80, 80), 10, 10, 60, 60);   // головна область 2500 px
    rect(m, 70, 70, 74, 74);                          // острівець 16 px
    const out = despeckleMask(m);
    expect(count(out)).toBe(2500);
    expect(out.data[71 * 80 + 71]).toBe(0);
  });

  it('лишає велику окрему частину — це може бути друга рука', () => {
    const m = rect(blank(80, 80), 5, 5, 45, 45);      // 1600
    rect(m, 55, 55, 75, 75);                           // 400 = 25 % від головної
    expect(count(despeckleMask(m))).toBe(2000);
  });

  it('єдина область лишається недоторканою', () => {
    const m = rect(blank(40, 40), 5, 5, 35, 35);
    expect(count(despeckleMask(m))).toBe(count(m));
  });
});

describe('fillMaskHoles', () => {
  it("заповнює дірку всередині суб'єкта", () => {
    const m = rect(blank(60, 60), 10, 10, 50, 50);
    rect(m, 25, 25, 30, 30, 0);                        // дірка 25 px
    const out = fillMaskHoles(m);
    expect(out.data[27 * 60 + 27]).toBe(255);
  });

  it('не заливає справжній фон — він торкається краю кадру', () => {
    const m = rect(blank(60, 60), 10, 10, 50, 50);
    const out = fillMaskHoles(m);
    expect(out.data[0]).toBe(0);
    expect(out.data[59 * 60 + 59]).toBe(0);
  });

  it('завелику порожнину не чіпає', () => {
    const m = rect(blank(100, 100), 5, 5, 95, 95);
    rect(m, 20, 20, 80, 80, 0);                        // 3600 px = 36 % кадру
    expect(fillMaskHoles(m).data[50 * 100 + 50]).toBe(0);
  });
});
