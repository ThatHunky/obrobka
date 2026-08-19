import * as Comlink from 'comlink';
import type { FitMode, Job, OutputFormat, RGBA } from '@obrobka/core';

export interface WidgetState {
  readonly width: number;
  readonly height: number;
  readonly mode: FitMode;
  readonly padTransparent: boolean;
  readonly padColor: string;
  readonly allowUpscale: boolean;
  readonly format: OutputFormat;
  readonly quality: number;
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

/** Перетворює стан інтерфейсу на серіалізований Job. */
export function buildJob(s: WidgetState): Job {
  return {
    ops: [{
      type: 'fit',
      width: s.width,
      height: s.height,
      mode: s.mode,
      pad: s.padTransparent ? 'transparent' : parseHexColor(s.padColor),
      allowUpscale: s.allowUpscale,
    }],
    output: s.format === 'png' ? { format: 'png' } : { format: s.format, quality: s.quality },
  };
}

export interface WorkerApi {
  process(bytes: ArrayBuffer, mime: string, job: Job): Promise<ArrayBuffer>;
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
