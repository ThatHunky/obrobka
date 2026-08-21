import ort from 'onnxruntime-node';
import type { RasterImage, Upscaler } from '@obrobka/core';
import {
  upscalerFor, padForModel, toUpscaleTensor, fromUpscaleTensor, cropPadding,
  type UpscaleFactor, type UpscalerDescriptor,
} from '@obrobka/models';
import { ensureModel } from './cache.js';

const BASE = process.env['OBROBKA_MODELS_URL']
  ?? 'https://models.obrobka.dobrovolskyi.com.ua';

class NodeUpscaler implements Upscaler {
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

  async load(onProgress?: (fraction: number) => void): Promise<void> {
    if (this.#session !== null) { onProgress?.(1); return; }
    const path = await ensureModel(this.#d.file, `${BASE}/${this.#d.file}`, onProgress);
    this.#session = await ort.InferenceSession.create(path);
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
  }
}

export function createUpscaler(factor: UpscaleFactor): Upscaler {
  return new NodeUpscaler(upscalerFor(factor));
}
