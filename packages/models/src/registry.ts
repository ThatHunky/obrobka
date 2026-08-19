import type { Tier } from '@obrobka/core';

export type { Tier };

/** Як приводити картинку до входу конкретної моделі. */
export type Normalization =
  | { readonly kind: 'imagenet' }
  | { readonly kind: 'symmetric' }   // mean 0.5, std 0.5 → [-1, 1]
  | { readonly kind: 'none' };       // тільки ÷255

/** Як обирається розмір входу. */
export type InputSizing =
  | { readonly kind: 'fixed'; readonly size: number }
  | { readonly kind: 'shortestEdge'; readonly size: number; readonly multipleOf: number };

export interface ModelDescriptor {
  readonly id: Tier;
  readonly label: string;
  /** Що модель уміє знаходити — показується користувачу. */
  readonly scope: string;
  readonly bytes: number;
  readonly license: string;
  readonly source: string;
  /** Ім'я файлу відносно бази моделей. */
  readonly file: string;
  readonly sizing: InputSizing;
  readonly normalization: Normalization;
  /**
   * Індекс потрібного виходу.
   *
   * U²-Netp віддає сім побічних виходів із іменами, згенерованими
   * експортером (`1959`…`1965`). Брати за іменем не можна — воно
   * зміниться при переекспорті. Перший вихід головний.
   */
  readonly outputIndex: number;
}

/**
 * Вибір ґрунтується на вимірюваннях, а не на описах моделей.
 *
 * MODNet і ormbg навчені на людях: на неживому об'єкті MODNet дав маску
 * з центром 0.022 — тобто нічого не знайшов. BiRefNet_lite викинуто:
 * при 1024×1024 його вбив OOM-кілер на машині з 4,2 ГБ вільної пам'яті,
 * а стеля wasm32 у вкладці ще нижча.
 */
export const MODELS: readonly ModelDescriptor[] = [
  {
    id: 'fast',
    label: 'Швидко',
    scope: 'Будь-який сюжет',
    bytes: 4_574_861,
    license: 'Apache-2.0',
    source: 'BritishWerewolf/U-2-Netp',
    file: 'u2netp.onnx',
    sizing: { kind: 'fixed', size: 320 },
    normalization: { kind: 'imagenet' },
    outputIndex: 0,
  },
  {
    id: 'portrait',
    label: 'Портрет',
    scope: 'Лише люди — краще тримає волосся',
    bytes: 6_632_188,
    license: 'Apache-2.0',
    source: 'Xenova/modnet',
    file: 'modnet.onnx',
    sizing: { kind: 'shortestEdge', size: 512, multipleOf: 32 },
    normalization: { kind: 'symmetric' },
    outputIndex: 0,
  },
  {
    id: 'quality',
    label: 'Якісно',
    scope: 'Будь-який сюжет, чіткіші краї',
    bytes: 88_186_000,
    license: 'MIT',
    source: 'imgly/isnet-general-onnx',
    file: 'isnet-general.onnx',
    sizing: { kind: 'fixed', size: 1024 },
    normalization: { kind: 'imagenet' },
    outputIndex: 0,
  },
];

export function modelById(id: Tier): ModelDescriptor {
  const m = MODELS.find((x) => x.id === id);
  if (m === undefined) throw new Error(`Невідомий рівень моделі: ${id}`);
  return m;
}

/** Обчислює розмір входу для конкретного зображення. */
export function inputSizeFor(
  d: ModelDescriptor, width: number, height: number,
): { width: number; height: number } {
  if (d.sizing.kind === 'fixed') {
    return { width: d.sizing.size, height: d.sizing.size };
  }
  const { size, multipleOf } = d.sizing;
  const scale = size / Math.min(width, height);
  const round = (v: number): number =>
    Math.max(multipleOf, Math.round((v * scale) / multipleOf) * multipleOf);
  return { width: round(width), height: round(height) };
}
