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

  it('стискає й від краю кадру — інакше ореол лишався б по межі', () => {
    const m = rect(blank(20, 20), 0, 0, 20, 20);
    expect(maskBBox(erodeMask(m, 2))).toEqual({ x: 2, y: 2, width: 16, height: 16 });
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
