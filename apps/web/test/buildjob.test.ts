import { describe, it, expect } from 'vitest';
import { buildJob, needsModel, type WidgetState } from '../src/lib/worker-api.js';

const base: WidgetState = {
  width: 512, height: 512, mode: 'contain',
  padTransparent: true, padColor: '#ffffff', allowUpscale: false,
  format: 'png', quality: 80,
  removeBg: false, tier: 'fast', feather: 0, shrink: 1, despeckle: true,
  outlineOn: false, outlineWidth: 8, outlineColor: '#ffffff',
  position: 'center', framing: 'none', framingPadding: 0.08,
  upscale: 1,
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
