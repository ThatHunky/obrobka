import * as Comlink from 'comlink';
import { runJob, type Job, type Mask, type RasterImage, type Tier } from '@obrobka/core';
import { withDecoder } from '@obrobka/codecs';
import { browserCodec } from '@obrobka/codecs/browser';
import { decodeHeic } from '@obrobka/heic';
import { readMetadata, readOrientation, type Metadata } from '@obrobka/metadata';
import {
  createSegmenter, createUpscaler, type Provider, type WebSegmenterApi,
} from '@obrobka/onnx-web';

/**
 * HEIC під'єднано збоку: libheif важить 1,46 МБ і ліцензований під LGPL,
 * тож вантажиться динамічно й лише тоді, коли такий файл справді відкрили.
 */
const codec = withDecoder(browserCodec, 'image/heic', decodeHeic);

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
  codec,
  metadata: { readOrientation },
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

/** Апскейлери теж кешуються: перекомпіляція моделі на кожен тайл була б абсурдом. */
const upPool = new Map<2 | 4, ReturnType<typeof createUpscaler>>();
function upscalerFor(factor: 2 | 4) {
  let u = upPool.get(factor);
  if (u === undefined) { u = createUpscaler(factor); upPool.set(factor, u); }
  return u;
}

const api = {
  async process(
    bytes: ArrayBuffer, mime: string, job: Job,
    onTile?: (p: { stage: string; done: number; total: number }) => void,
  ): Promise<ArrayBuffer> {
    const withProgress = {
      ...ctx,
      upscaler: (factor: 2 | 4) => {
        const u = upscalerFor(factor);
        return {
          id: u.id, factor: u.factor, tileSize: u.tileSize,
          load: (p?: (f: number) => void) => u.load(p),
          upscale: (img: RasterImage) => u.upscale(img),
          dispose: async () => { lastProvider = u.provider ?? lastProvider; },
        };
      },
      onProgress: (stage: string, done: number, total: number) => {
        onTile?.({ stage, done, total });
      },
    };
    const result = await runJob(new Uint8Array(bytes), mime, job, withProgress);
    const out = new Uint8Array(result.length);
    out.set(result);
    return Comlink.transfer(out.buffer, [out.buffer]);
  },

  async warmUpUpscaler(
    factor: 2 | 4, onProgress: (fraction: number) => void,
  ): Promise<Provider | null> {
    const u = upscalerFor(factor);
    await u.load(onProgress);
    lastProvider = u.provider ?? lastProvider;
    return u.provider;
  },

  /** Читає метадані. Панель EXIF питає це один раз на файл. */
  async metadata(bytes: ArrayBuffer): Promise<Metadata> {
    return readMetadata(new Uint8Array(bytes));
  },

  /**
   * Зменшена копія для показу «Було».
   *
   * Потрібна лише для HEIC: браузер такий blob у теґу `<img>` не покаже
   * (крім Safari), тож картинку доводиться перемалювати в те, що покаже
   * будь-хто. Для решти форматів прев'ю не будується — там працює
   * прямий objectURL, і це і швидше, і точніше.
   */
  async preview(
    bytes: ArrayBuffer, mime: string, maxSide: number,
  ): Promise<{ buf: ArrayBuffer; width: number; height: number }> {
    const source = new Uint8Array(bytes);
    const out = await runJob(source, mime, {
      ops: [{ type: 'fit', width: maxSide, height: maxSide, mode: 'inside' }],
      output: { format: 'webp', quality: 82 },
    }, ctx);
    const decoded = await codec.decode(out, 'image/webp');
    const copy = new Uint8Array(out.length);
    copy.set(out);
    return Comlink.transfer(
      { buf: copy.buffer, width: decoded.width, height: decoded.height },
      [copy.buffer],
    );
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
