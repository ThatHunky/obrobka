import * as Comlink from 'comlink';
import { fit, runJob, type Job, type Mask, type RasterImage, type Tier } from '@obrobka/core';
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
 * Межа роздільності накладеного зображення.
 *
 * Чотири шари 4000×3000 у RGBA — це близько 190 МБ у вкладці, і жоден із
 * них не малюється в такому розмірі: наклейку видно на частку ширини
 * кадру. Дві тисячі лишають запас навіть для шару на всю ширину 4K.
 *
 * Константа живе тут, а не поруч з описом API: worker-api.ts спавнить
 * воркери через new Worker(new URL('./worker.ts')), і зустрічний імпорт
 * замкнув би цикл, а заразом затягнув би код спавнення в сам воркер.
 */
const MAX_OVERLAY_SIDE = 2048;

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
    // Декодуємо самі, а не через runJob: звідси беруться справжні розміри
    // оригіналу, які інтерфейс показує в «Було» і за якими рахує час
    // збільшення. Раніше туди потрапляв розмір зменшеної копії, і оцінка
    // виходила приблизно вдвадцятеро меншою за дійсність.
    const img = await codec.decode(new Uint8Array(bytes), mime);
    const small = fit(img, { width: maxSide, height: maxSide, mode: 'inside' });
    const out = await codec.encode(small, { format: 'webp', quality: 82 });
    const copy = new Uint8Array(out.length);
    copy.set(out);
    return Comlink.transfer(
      { buf: copy.buffer, width: img.width, height: img.height },
      [copy.buffer],
    );
  },

  /**
   * Декодує накладене зображення в RGBA й одразу зменшує до межі.
   *
   * Повертаємо саме пікселі, а не файл: шар лежить у Job, а Job має
   * лишатись придатним до structured clone. Кодувати назад у PNG лише
   * для того, щоб декодувати ще раз на кожен прогін, було б безглуздо.
   */
  async decodeOverlay(
    bytes: ArrayBuffer, mime: string,
  ): Promise<{ data: ArrayBuffer; width: number; height: number }> {
    const img = await codec.decode(new Uint8Array(bytes), mime);
    const capped = Math.max(img.width, img.height) > MAX_OVERLAY_SIDE
      ? fit(img, { width: MAX_OVERLAY_SIDE, height: MAX_OVERLAY_SIDE, mode: 'inside' })
      : img;
    const copy = new Uint8ClampedArray(capped.data);
    return Comlink.transfer(
      { data: copy.buffer, width: capped.width, height: capped.height },
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
