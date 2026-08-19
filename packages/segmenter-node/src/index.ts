import ort from 'onnxruntime-node';
import type { Mask, RasterImage, Segmenter, Tier } from '@obrobka/core';
import { modelById, preprocess, postprocess, type ModelDescriptor } from '@obrobka/models';
import { ensureModel } from './cache.js';

/** База, звідки беруться моделі. Перевизначається змінною середовища. */
const BASE = process.env['OBROBKA_MODELS_URL']
  ?? 'https://models.obrobka.dobrovolskyi.com.ua';

class NodeSegmenter implements Segmenter {
  readonly id: string;
  readonly inputSize: number;
  readonly #d: ModelDescriptor;
  #session: ort.InferenceSession | null = null;

  constructor(d: ModelDescriptor) {
    this.#d = d;
    this.id = d.id;
    this.inputSize = d.sizing.size;
  }

  async load(onProgress?: (fraction: number) => void): Promise<void> {
    if (this.#session !== null) { onProgress?.(1); return; }
    const path = await ensureModel(this.#d.file, `${BASE}/${this.#d.file}`, onProgress);
    this.#session = await ort.InferenceSession.create(path);
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
    // Вихід за індексом: U²-Netp має сім побічних виходів із іменами,
    // які згенерував експортер і які зміняться при переекспорті.
    const name = this.#session.outputNames[this.#d.outputIndex]!;
    return postprocess(out[name]!.data as Float32Array, t.width, t.height);
  }

  async dispose(): Promise<void> {
    await this.#session?.release();
    this.#session = null;
  }
}

export function createSegmenter(tier: Tier): Segmenter {
  return new NodeSegmenter(modelById(tier));
}
