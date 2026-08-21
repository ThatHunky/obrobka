import type { EncodeOptions, Mask, RasterImage, Tier } from '../types.js';

export interface Codec {
  canDecode(mime: string): boolean;
  canEncode(format: EncodeOptions['format']): boolean;
  decode(bytes: Uint8Array, mime: string): Promise<RasterImage>;
  encode(img: RasterImage, opts: EncodeOptions): Promise<Uint8Array>;
}

/** Необов'язковий швидший ресемплер. Без нього ядро використовує вбудований. */
export interface Resampler {
  resize(img: RasterImage, width: number, height: number): RasterImage;
}

/** Реалізується в M2. Оголошено тут, щоб зафіксувати межу. */
export interface Segmenter {
  readonly id: string;
  readonly inputSize: number;
  load(onProgress?: (fraction: number) => void): Promise<void>;
  segment(img: RasterImage): Promise<Mask>;
  dispose(): Promise<void>;
}

/** Реалізується в M4. */
export interface Upscaler {
  readonly id: string;
  readonly factor: 2 | 4;
  readonly tileSize: number;
  load(onProgress?: (fraction: number) => void): Promise<void>;
  upscale(img: RasterImage): Promise<RasterImage>;
  dispose(): Promise<void>;
}

/**
 * Те, що пайплайну потрібно з метаданих, — і нічого більше.
 *
 * Оголошення в M1 обіцяло ще `read` і `strip`. Ані те, ані те ядру
 * не знадобилось: повне читання потрібне інтерфейсу й агенту, зняття
 * метаданих узагалі не торкається пікселів. Обидві функції живуть
 * у @obrobka/metadata, поруч зі своїми викликами, а порт описує
 * рівно одну залежність — число, за яким треба повернути кадр.
 */
export interface MetadataPort {
  /** Значення теґу EXIF Orientation, або 1, якщо його немає. */
  readOrientation(bytes: Uint8Array): Promise<number>;
}

export interface Context {
  readonly codec: Codec;
  readonly resampler?: Resampler;
  /**
   * Створює сегментатор потрібного рівня. Необов'язковий: операції M1
   * працюють без нього, а операції з маскою дадуть зрозумілу помилку.
   */
  readonly segmenter?: (tier: Tier) => Segmenter;
  /** Створює апскейлер. Потрібен лише для операції upscale. */
  readonly upscaler?: (factor: 2 | 4) => Upscaler;
  /**
   * Читач орієнтації. Без нього автоповорот просто не відбувається —
   * геометричні операції мають лишатись доступними без жодних залежностей.
   */
  readonly metadata?: MetadataPort;
  /** Повідомляє про повільні кроки — зараз це лише тайли апскейлу. */
  readonly onProgress?: (stage: string, done: number, total: number) => void;
}
