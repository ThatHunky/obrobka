import * as ort from 'onnxruntime-web/webgpu';
import type { RasterImage, Upscaler } from '@obrobka/core';
import {
  upscalerFor, padForModel, toUpscaleTensor, fromUpscaleTensor, cropPadding,
  type UpscaleFactor, type UpscalerDescriptor,
} from '@obrobka/models';
import { fetchModel } from './cache.js';

const BASE = 'https://models.obrobka.dobrovolskyi.com.ua';

/** Ті самі провайдери, що й у сегментатора: спершу відеокарта. */
export type Provider = 'webgpu' | 'wasm';

export interface WebUpscalerApi extends Upscaler {
  /** Який провайдер зрештою запрацював. */
  readonly provider: Provider | null;
}

class WebUpscaler implements WebUpscalerApi {
  readonly id: string;
  readonly factor: UpscaleFactor;
  readonly tileSize: number;
  readonly #d: UpscalerDescriptor;
  #session: ort.InferenceSession | null = null;

  constructor(d: UpscalerDescriptor) {
    this.#d = d;
    this.id = `x${d.factor}`;
    this.factor = d.factor;
    this.tileSize = d.tileSize;
  }

  #loading: Promise<void> | null = null;
  provider: Provider | null = null;

  async load(onProgress?: (fraction: number) => void): Promise<void> {
    if (this.#session !== null) { onProgress?.(1); return; }
    if (this.#loading !== null) { await this.#loading; onProgress?.(1); return; }
    this.#loading = this.#doLoad(onProgress).finally(() => { this.#loading = null; });
    return this.#loading;
  }

  async #doLoad(onProgress?: (fraction: number) => void): Promise<void> {
    const bytes = await fetchModel(`${BASE}/${this.#d.file}`, onProgress);
    const order: Provider[] = 'gpu' in navigator ? ['webgpu', 'wasm'] : ['wasm'];
    let last: unknown;
    for (const ep of order) {
      try {
        this.#session = await ort.InferenceSession.create(bytes, { executionProviders: [ep] });
        this.provider = ep;
        return;
      } catch (e) { last = e; }
    }
    throw new Error(`Не вдалося запустити апскейлер: ${String(last)}`);
  }

  async upscale(img: RasterImage): Promise<RasterImage> {
    if (this.#session === null) {
      throw new Error(`Апскейлер ${this.id} не завантажений — спершу викличте load()`);
    }
    const { padded } = padForModel(img, this.#d);
    const out = await this.#session.run({
      [this.#session.inputNames[0]!]: new ort.Tensor(
        'float32', toUpscaleTensor(padded), [1, 3, padded.height, padded.width],
      ),
    });
    const tensor = out[this.#session.outputNames[0]!]!;
    const [, , h, w] = tensor.dims as number[];
    const big = fromUpscaleTensor(tensor.data as Float32Array, w!, h!, padded, this.factor);
    return cropPadding(big, img.width * this.factor, img.height * this.factor);
  }

  async dispose(): Promise<void> {
    await this.#session?.release();
    this.#session = null;
    this.provider = null;
  }
}

export function createUpscaler(factor: UpscaleFactor): WebUpscalerApi {
  return new WebUpscaler(upscalerFor(factor));
}
