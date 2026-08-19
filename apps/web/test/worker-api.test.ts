import { describe, it, expect } from 'vitest';
import { buildJob, type WidgetState } from '../src/lib/worker-api.js';

const base: WidgetState = {
  width: 512, height: 512, mode: 'contain',
  padTransparent: true, padColor: '#ffffff',
  allowUpscale: false, format: 'png', quality: 80,
};

describe('buildJob', () => {
  it('створює одну операцію fit', () => {
    const job = buildJob(base);
    expect(job.ops).toHaveLength(1);
    expect(job.ops[0]).toMatchObject({ type: 'fit', width: 512, height: 512, mode: 'contain' });
  });

  it('прозорі поля за замовчуванням', () => {
    expect(buildJob(base).ops[0]).toMatchObject({ pad: 'transparent' });
  });

  it('розбирає колір полів, коли прозорість вимкнено', () => {
    const job = buildJob({ ...base, padTransparent: false, padColor: '#ff8000' });
    expect(job.ops[0]).toMatchObject({ pad: { r: 255, g: 128, b: 0, a: 255 } });
  });

  it('не передає quality для png', () => {
    expect(buildJob({ ...base, format: 'png' }).output).toEqual({ format: 'png' });
  });

  it('передає quality для jpeg', () => {
    expect(buildJob({ ...base, format: 'jpeg', quality: 92 }).output)
      .toEqual({ format: 'jpeg', quality: 92 });
  });
});
