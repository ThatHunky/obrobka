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

/** Реалізується в M3. */
export interface MetadataPort {
  read(bytes: Uint8Array): Promise<Record<string, unknown>>;
  strip(bytes: Uint8Array): Promise<Uint8Array>;
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
  /** Повідомляє про повільні кроки — зараз це лише тайли апскейлу. */
  readonly onProgress?: (stage: string, done: number, total: number) => void;
}
