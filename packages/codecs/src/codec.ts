import type { Codec, EncodeOptions, OutputFormat, RasterImage } from '@obrobka/core';
import type { SupportedMime } from './mime.js';
import { decodeSlot, encodeSlot, loadSlot, type InitStrategy } from './modules.js';

const DECODABLE: readonly string[] = ['image/png', 'image/jpeg', 'image/webp', 'image/avif'];
const ENCODABLE: readonly OutputFormat[] = ['png', 'jpeg', 'webp', 'avif'];

/** ImageData, як його очікують модулі jSquash. */
interface JsquashImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Підписи 8-бітних функцій jSquash.
 *
 * Кожен модуль типізує вхід як DOM-ImageData, а png і avif мають ще й
 * 16-бітові перевантаження, які TypeScript обирає першими. Під час
 * виконання читаються лише data/width/height, тож зводимо всі модулі
 * до одного явного підпису, не тягнучи DOM-бібліотеку в пакет,
 * який має працювати і в Node.
 */
type Encode8Bit = (data: JsquashImageData, options?: unknown) => Promise<ArrayBuffer>;
type Decode8Bit = (buffer: ArrayBuffer) => Promise<JsquashImageData | null>;

/** AVIF керується cqLevel 0..63, де менше = краще. Мапимо 1..100 у 62..0. */
function qualityToCq(quality: number): number {
  const clamped = Math.min(100, Math.max(1, quality));
  return Math.round(62 - (clamped / 100) * 62);
}

function encodeOptions(format: OutputFormat, quality: number): unknown {
  switch (format) {
    case 'png': return undefined;
    case 'avif': return { cqLevel: qualityToCq(quality) };
    default: return { quality };
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset, bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

/**
 * Створює кодек поверх модулів jSquash.
 *
 * Уся логіка форматів і якості спільна; різниться лише те, як середовище
 * добуває .wasm — це й задає стратегія ініціалізації.
 */
export function createCodec(init: InitStrategy): Codec {
  return {
    canDecode: (mime) => DECODABLE.includes(mime),
    canEncode: (format) => ENCODABLE.includes(format),

    async decode(bytes: Uint8Array, mime: string): Promise<RasterImage> {
      if (!DECODABLE.includes(mime)) {
        throw new Error(`Формат ${mime} не підтримується для читання`);
      }
      const mod = await loadSlot(decodeSlot(mime as SupportedMime), init);
      const result = await (mod.default as unknown as Decode8Bit)(toArrayBuffer(bytes));
      if (result === null) {
        throw new Error(`Не вдалося декодувати зображення ${mime} — дані пошкоджені`);
      }
      return { data: result.data, width: result.width, height: result.height };
    },

    async encode(img: RasterImage, opts: EncodeOptions): Promise<Uint8Array> {
      if (!ENCODABLE.includes(opts.format)) {
        throw new Error(`Формат ${opts.format} не підтримується для запису`);
      }
      const mod = await loadSlot(encodeSlot(opts.format), init);
      const data: JsquashImageData = {
        data: img.data, width: img.width, height: img.height,
      };
      const buffer = await (mod.default as unknown as Encode8Bit)(
        data, encodeOptions(opts.format, opts.quality ?? 80),
      );
      return new Uint8Array(buffer);
    },
  };
}
