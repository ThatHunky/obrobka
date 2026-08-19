import * as ort from 'onnxruntime-web/webgpu';
import type { Mask, RasterImage, Segmenter, Tier } from '@obrobka/core';
import { modelById, preprocess, postprocess, type ModelDescriptor } from '@obrobka/models';
import { fetchModel } from './cache.js';

export { cachedModels, clearModels } from './cache.js';

const BASE = 'https://models.obrobka.dobrovolskyi.com.ua';

/**
 * Проксі-воркер ORT несумісний з WebGPU: буфери відеокарти не можна
 * передати між потоками. Ми й так виконуємось у власному воркері,
 * тож вимикаємо його явно.
 */
ort.env.wasm.proxy = false;

export type Provider = 'webgpu' | 'wasm';

export interface WebSegmenterApi extends Segmenter {
  /** Який провайдер зрештою запрацював — інтерфейс має сказати це чесно. */
  readonly provider: Provider | null;
}

class WebSegmenter implements WebSegmenterApi {
  readonly id: string;
  readonly inputSize: number;
  provider: Provider | null = null;

  readonly #d: ModelDescriptor;
  #session: ort.InferenceSession | null = null;

  constructor(d: ModelDescriptor) {
    this.#d = d;
    this.id = d.id;
    this.inputSize = d.sizing.size;
  }

  async load(onProgress?: (fraction: number) => void): Promise<void> {
    if (this.#session !== null) { onProgress?.(1); return; }
    const bytes = await fetchModel(`${BASE}/${this.#d.file}`, onProgress);

    const order: Provider[] = 'gpu' in navigator ? ['webgpu', 'wasm'] : ['wasm'];
    let last: unknown;
    for (const ep of order) {
      try {
        this.#session = await ort.InferenceSession.create(bytes, { executionProviders: [ep] });
        this.provider = ep;
        return;
      } catch (e) {
        last = e;
      }
    }
    throw new Error(
      `Не вдалося запустити модель ${this.id} на жодному провайдері: ${String(last)}`,
    );
  }

  async segment(img: RasterImage): Promise<Mask> {
    if (this.#session === null) {
      throw new Error(`Модель ${this.id} не завантажена — спершу викличте load()`);
    }
    const t = preprocess(img, this.#d);
    const feeds = {
      [this.#session.inputNames[0]!]:
        new ort.Tensor('float32', t.data, [1, 3, t.height, t.width]),
    };
    const out = await this.#session.run(feeds);
    const name = this.#session.outputNames[this.#d.outputIndex]!;
    return postprocess(out[name]!.data as Float32Array, t.width, t.height);
  }

  async dispose(): Promise<void> {
    await this.#session?.release();
    this.#session = null;
    this.provider = null;
  }
}

export function createSegmenter(tier: Tier): WebSegmenterApi {
  return new WebSegmenter(modelById(tier));
}
