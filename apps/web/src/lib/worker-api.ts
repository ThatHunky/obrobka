import * as Comlink from 'comlink';
import type { FitMode, Job, Op, OutputFormat, RGBA, Tier } from '@obrobka/core';

export type Provider = 'webgpu' | 'wasm';

export interface WidgetState {
  readonly width: number;
  readonly height: number;
  readonly mode: FitMode;
  readonly padTransparent: boolean;
  readonly padColor: string;
  readonly allowUpscale: boolean;
  readonly format: OutputFormat;
  readonly quality: number;
  readonly removeBg: boolean;
  readonly tier: Tier;
  readonly feather: number;
  readonly shrink: number;
  readonly despeckle: boolean;
  readonly outlineOn: boolean;
  readonly outlineWidth: number;
  readonly outlineColor: string;
}

export function parseHexColor(hex: string): RGBA {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (m === null) return { r: 255, g: 255, b: 255, a: 255 };
  const h = m[1]!;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    a: 255,
  };
}

/**
 * Перетворює стан інтерфейсу на серіалізований Job.
 *
 * Порядок навмисний: фон знімається з оригіналу, а вписування в кадр
 * відбувається вже з готовою прозорістю. Навпаки поля рамки з'їли б
 * частину суб'єкта ще до сегментації.
 */
export function buildJob(s: WidgetState): Job {
  const ops: Op[] = [];
  if (s.removeBg) {
    ops.push({
      type: 'removeBackground',
      tier: s.tier,
      feather: s.feather,
      shrink: s.shrink,
      despeckle: s.despeckle,
    });
    if (s.outlineOn && s.outlineWidth > 0) {
      ops.push({
        type: 'outline',
        width: s.outlineWidth,
        color: parseHexColor(s.outlineColor),
      });
    }
  }
  ops.push({
    type: 'fit',
    width: s.width,
    height: s.height,
    mode: s.mode,
    pad: s.padTransparent ? 'transparent' : parseHexColor(s.padColor),
    allowUpscale: s.allowUpscale,
  });
  return {
    ops,
    output: s.format === 'png' ? { format: 'png' } : { format: s.format, quality: s.quality },
  };
}

export interface WorkerApi {
  process(bytes: ArrayBuffer, mime: string, job: Job): Promise<ArrayBuffer>;
  warmUp(tier: Tier, onProgress: (fraction: number) => void): Promise<Provider | null>;
}

let cached: Comlink.Remote<WorkerApi> | null = null;

/** Створює воркер один раз і перевикористовує його. */
export function getWorker(): Comlink.Remote<WorkerApi> {
  if (cached === null) {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    cached = Comlink.wrap<WorkerApi>(worker);
  }
  return cached;
}
