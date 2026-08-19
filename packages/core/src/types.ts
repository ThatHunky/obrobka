/** RGBA, non-premultiplied, 8 біт на канал, рядок за рядком. */
export interface RasterImage {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

/** Одноканальна маска, 0..255. */
export interface Mask {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface RGBA {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/**
 * contain — вписати цілком, лишок заповнити полями; вихід рівно width×height
 * cover   — заповнити повністю, надлишок обрізати; вихід рівно width×height
 * fill    — розтягнути, ігноруючи співвідношення; вихід рівно width×height
 * inside  — вписати цілком, вихід має розмір вписаного, полів немає
 * outside — покрити, вихід має розмір масштабованого, обрізки немає
 */
export type FitMode = 'contain' | 'cover' | 'fill' | 'inside' | 'outside';

export type Position =
  | 'center' | 'top' | 'bottom' | 'left' | 'right'
  | { readonly x: number; readonly y: number };

export interface FitOptions {
  readonly width: number;
  readonly height: number;
  readonly mode: FitMode;
  /** Колір полів для contain. Типово прозорий. */
  readonly pad?: RGBA | 'transparent';
  /** Типово 'center'. */
  readonly position?: Position;
  /** Чи дозволено збільшувати. Діє лише для contain та inside. Типово false. */
  readonly allowUpscale?: boolean;
}

export type OutputFormat = 'png' | 'jpeg' | 'webp' | 'avif';

export interface EncodeOptions {
  readonly format: OutputFormat;
  /** 1..100. Ігнорується для png. */
  readonly quality?: number;
}

export type Op =
  | ({ readonly type: 'fit' } & FitOptions)
  | { readonly type: 'crop'; readonly rect: Rect };

export interface Job {
  readonly ops: readonly Op[];
  readonly output: EncodeOptions;
}

export const TRANSPARENT: RGBA = { r: 0, g: 0, b: 0, a: 0 };
