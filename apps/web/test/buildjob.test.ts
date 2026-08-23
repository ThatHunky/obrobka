import { describe, it, expect } from 'vitest';
import { buildJob, needsModel, type UiLayer, type WidgetState } from '../src/lib/worker-api.js';

const base: WidgetState = {
  width: 512, height: 512, mode: 'contain',
  padTransparent: true, padColor: '#ffffff', allowUpscale: false,
  format: 'png', quality: 80,
  removeBg: false, tier: 'fast', feather: 0, shrink: 1, despeckle: true,
  outlineOn: false, outlineWidth: 8, outlineColor: '#ffffff',
  position: 'center', framing: 'none', framingPadding: 0.08,
  upscale: 1,
  zoom: 1,
  layers: [],
};

const types = (s: WidgetState): string[] => buildJob(s).ops.map((o) => o.type);

describe('порядок операцій', () => {
  it('без кадрування — лише fit', () => {
    expect(types(base)).toEqual(['fit']);
  });

  it("кадр за суб'єктом іде перед fit", () => {
    expect(types({ ...base, framing: 'smart' })).toEqual(['smartCrop', 'fit']);
  });

  it('обрізка країв іде перед fit', () => {
    expect(types({ ...base, framing: 'trim' })).toEqual(['trim', 'fit']);
  });

  it('фон знімається до кадрування, а те — до fit', () => {
    expect(types({ ...base, removeBg: true, outlineOn: true, framing: 'smart' }))
      .toEqual(['removeBackground', 'outline', 'smartCrop', 'fit']);
  });
});

describe('збільшення', () => {
  it('за замовчуванням операції немає', () => {
    expect(types(base)).toEqual(['fit']);
  });

  it('іде після кадрування, але до fit', () => {
    // Інакше ми ганяли б модель по пікселях, які потім однаково обріжуться
    expect(types({ ...base, framing: 'smart', upscale: 2 }))
      .toEqual(['smartCrop', 'upscale', 'fit']);
  });

  it('множник доїжджає в операцію', () => {
    const job = buildJob({ ...base, upscale: 4 });
    expect(job.ops[0]).toEqual({ type: 'upscale', factor: 4 });
  });

  it('поєднується з видаленням фону в правильному порядку', () => {
    expect(types({ ...base, removeBg: true, upscale: 2 }))
      .toEqual(['removeBackground', 'upscale', 'fit']);
  });
});

describe('параметри', () => {
  it("співвідношення для кадру береться з розмірів", () => {
    const job = buildJob({ ...base, width: 1600, height: 900, framing: 'smart' });
    expect(job.ops[0]).toMatchObject({ type: 'smartCrop', aspectRatio: 1600 / 900 });
  });

  it("прив'язка доїжджає у fit", () => {
    const job = buildJob({ ...base, position: 'bottom-right' });
    expect(job.ops.at(-1)).toMatchObject({ type: 'fit', position: 'bottom-right' });
  });

  it('обрізка країв не нав’язує співвідношення', () => {
    const job = buildJob({ ...base, framing: 'trim', framingPadding: 0.2 });
    expect(job.ops[0]).toEqual({ type: 'trim', padding: 0.2, tier: 'fast' });
  });
});

describe('поля й формат', () => {
  it('прозорі поля за замовчуванням', () => {
    expect(buildJob(base).ops.at(-1)).toMatchObject({ pad: 'transparent' });
  });

  it('розбирає колір полів, коли прозорість вимкнено', () => {
    const job = buildJob({ ...base, padTransparent: false, padColor: '#ff8000' });
    expect(job.ops.at(-1)).toMatchObject({ pad: { r: 255, g: 128, b: 0, a: 255 } });
  });

  it('не передає quality для png', () => {
    expect(buildJob(base).output).toEqual({ format: 'png' });
  });

  it('передає quality для jpeg', () => {
    expect(buildJob({ ...base, format: 'jpeg', quality: 92 }).output)
      .toEqual({ format: 'jpeg', quality: 92 });
  });
});

describe('needsModel', () => {
  it('без фону й кадрування модель не потрібна', () => {
    expect(needsModel(base)).toBe(false);
  });

  it('кадрування потребує моделі навіть без видалення фону', () => {
    expect(needsModel({ ...base, framing: 'smart' })).toBe(true);
    expect(needsModel({ ...base, framing: 'trim' })).toBe(true);
  });

  it('видалення фону потребує моделі', () => {
    expect(needsModel({ ...base, removeBg: true })).toBe(true);
  });
});

describe('кадрування тягненням', () => {
  const fitOp = (s: WidgetState) =>
    buildJob(s).ops.find((o) => o.type === 'fit') as { zoom?: number; position?: unknown };

  it('одиничне наближення не потрапляє в Job', () => {
    expect(fitOp({ ...base, zoom: 1 }).zoom).toBeUndefined();
  });

  it('наближення передається в fit', () => {
    expect(fitOp({ ...base, zoom: 2.5 }).zoom).toBe(2.5);
  });

  it('зміщення часткою передається як є', () => {
    expect(fitOp({ ...base, position: { fx: 0.25, fy: 0.75 } }).position)
      .toEqual({ fx: 0.25, fy: 0.75 });
  });
});

/**
 * Стан віджета — реактивний проксі Svelte 5, і об'єкт, покладений у нього,
 * теж стає проксі. Job їде у воркер через structured clone, а проксі його
 * не переживає: перше ж тягнення падало з «could not be cloned».
 */
describe('Job переживає structured clone', () => {
  it("прив'язка їде звичайним об'єктом, а не проксі", () => {
    const proxied = new Proxy({ fx: 0.25, fy: 0.75 }, {});
    const job = buildJob({ ...base, position: proxied });
    expect(() => structuredClone(job)).not.toThrow();
    expect(structuredClone(job).ops.at(-1)).toMatchObject({
      type: 'fit', position: { fx: 0.25, fy: 0.75 },
    });
  });

  it('іменована прив’язка лишається рядком', () => {
    const job = buildJob({ ...base, position: 'top-left' });
    expect(() => structuredClone(job)).not.toThrow();
    expect((job.ops.at(-1) as { position: unknown }).position).toBe('top-left');
  });
});

const px = (w: number, h: number) => ({
  data: new Uint8ClampedArray(w * h * 4), width: w, height: h,
});

const uiLayer = (over: Partial<UiLayer> = {}): UiLayer => ({
  id: 1, name: 'a.png', hidden: false, thumb: '',
  image: px(4, 4), x: 0.5, y: 0.5, scale: 0.3, ...over,
});

describe('шари', () => {
  it('без шарів операції немає', () => {
    expect(types(base)).toEqual(['fit']);
  });

  it('шари йдуть останніми, після fit', () => {
    expect(types({ ...base, layers: [uiLayer()] })).toEqual(['fit', 'composite']);
  });

  it('після збільшення й кадрування теж останні', () => {
    expect(types({ ...base, framing: 'smart', upscale: 2, layers: [uiLayer()] }))
      .toEqual(['smartCrop', 'upscale', 'fit', 'composite']);
  });

  it('приховані шари не потрапляють у Job', () => {
    expect(types({ ...base, layers: [uiLayer({ hidden: true })] })).toEqual(['fit']);
  });

  it('у Job не їдуть поля інтерфейсу', () => {
    const op = buildJob({ ...base, layers: [uiLayer()] }).ops
      .find((o) => o.type === 'composite') as { layers: readonly object[] };
    expect(Object.keys(op.layers[0]!).sort()).toEqual(['image', 'scale', 'x', 'y']);
  });

  it('необовʼязкові поля їдуть, коли задані', () => {
    const op = buildJob({
      ...base,
      layers: [uiLayer({ rotation: 30, opacity: 0.4, blend: 'multiply' })],
    }).ops.find((o) => o.type === 'composite') as { layers: readonly object[] };
    expect(op.layers[0]).toMatchObject({ rotation: 30, opacity: 0.4, blend: 'multiply' });
  });

  it('шари переживають structured clone', () => {
    // Той самий проксі Svelte, що ламав прив'язку: шар лежить у стані,
    // тож і він, і його піксельний масив приїжджають сюди проксями.
    const proxied = new Proxy(uiLayer({
      image: new Proxy(px(4, 4), {}),
    }), {});
    const job = buildJob({ ...base, layers: [proxied] });
    expect(() => structuredClone(job)).not.toThrow();
  });
});
