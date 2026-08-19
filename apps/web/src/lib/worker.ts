import * as Comlink from 'comlink';
import { runJob, type Job, type Mask, type RasterImage, type Tier } from '@obrobka/core';
import { browserCodec } from '@obrobka/codecs/browser';
import { createSegmenter, type Provider, type WebSegmenterApi } from '@obrobka/segmenter-web';

let lastProvider: Provider | null = null;

/**
 * Сегментатори кешуються між викликами: створювати сесію ONNX заново
 * на кожен рух повзунка означало б щоразу компілювати модель.
 */
const pool = new Map<Tier, WebSegmenterApi>();

function segmenterFor(tier: Tier): WebSegmenterApi {
  let s = pool.get(tier);
  if (s === undefined) { s = createSegmenter(tier); pool.set(tier, s); }
  return s;
}

const ctx = {
  codec: browserCodec,
  segmenter: (tier: Tier) => {
    const s = segmenterFor(tier);
    // Пайплайн викликає dispose після кожного Job, а нам треба тримати
    // сесію живою між викликами. Обгортку будуємо явно: спред екземпляра
    // класу скопіював би лише власні поля й загубив методи з прототипу.
    return {
      id: s.id,
      inputSize: s.inputSize,
      load: (onProgress?: (f: number) => void) => s.load(onProgress),
      segment: (img: RasterImage): Promise<Mask> => s.segment(img),
      dispose: async (): Promise<void> => { lastProvider = s.provider; },
    };
  },
};

const api = {
  async process(bytes: ArrayBuffer, mime: string, job: Job): Promise<ArrayBuffer> {
    const result = await runJob(new Uint8Array(bytes), mime, job, ctx);
    const out = new Uint8Array(result.length);
    out.set(result);
    return Comlink.transfer(out.buffer, [out.buffer]);
  },

  /** Прогрів моделі з прогресом — щоб інтерфейс не мовчав під час завантаження. */
  async warmUp(tier: Tier, onProgress: (fraction: number) => void): Promise<Provider | null> {
    const s = segmenterFor(tier);
    await s.load(onProgress);
    lastProvider = s.provider;
    return s.provider;
  },
};

Comlink.expose(api);
