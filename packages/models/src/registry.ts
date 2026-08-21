import type { Tier } from '@obrobka/core';

export type { Tier };

/** Як приводити картинку до входу конкретної моделі. */
export type Normalization =
  | { readonly kind: 'imagenet' }
  | { readonly kind: 'symmetric' }   // mean 0.5, std 0.5 → [-1, 1]
  | { readonly kind: 'dis' }         // mean 0.5, std 1.0 — рецепт роботи DIS
  | { readonly kind: 'none' };       // тільки ÷255

/** Як обирається розмір входу. */
export type InputSizing =
  | { readonly kind: 'fixed'; readonly size: number }
  | { readonly kind: 'shortestEdge'; readonly size: number; readonly multipleOf: number };

export interface ModelDescriptor {
  readonly id: Tier;
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
    bytes: 12_984_781,
    license: 'Apache-2.0',
    source: 'Xenova/modnet',
    // fp16, а не uint8: квантована версія на 6,3 МБ давала рвану маску
    // з дірками — matting живе на півтонах альфи, і uint8 їх нищить.
    file: 'modnet-fp16.onnx',
    sizing: { kind: 'shortestEdge', size: 512, multipleOf: 32 },
    normalization: { kind: 'symmetric' },
    outputIndex: 0,
  },
  {
    id: 'quality',
    bytes: 88_152_708,
    license: 'MIT',
    source: 'imgly/isnet-general-onnx',
    file: 'isnet-general.onnx',
    sizing: { kind: 'fixed', size: 1024 },
    // DIS-рецепт, не ImageNet: з ImageNet модель знаходила 0 % суб'єкта
    // на реальних фото, хоча на синтетичному тесті виглядала справною.
    normalization: { kind: 'dis' },
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

// ─────────────────────────────  Апскейл  ─────────────────────────────

export type UpscaleFactor = 2 | 4;

export interface UpscalerDescriptor {
  readonly factor: UpscaleFactor;
  readonly bytes: number;
  readonly license: string;
  readonly source: string;
  readonly file: string;
  /**
   * Розмір тайла у вхідних пікселях.
   *
   * Підібраний за виміряним піком пам'яті: ×2 на тайлі 256 бере 561 МБ,
   * ×4 на тайлі 128 — 578 МБ. Удвічі більший тайл у кожному випадку
   * дає близько 1,8 ГБ, що вже за межами розумного для вкладки.
   */
  readonly tileSize: number;
  /** Вхід має бути кратним цьому числу — вимога Swin2SR. */
  readonly padTo: number;
}

/**
 * Квантування обрано за вимірюванням PSNR на реальних фото, а не за розміром.
 *
 * Для ×2 fp32 дає +0.2…+0.4 дБ проти uint8 і важить лише на 2,4 МБ більше,
 * тож економія не варта втрати. Для ×4, навпаки, uint8 не поступається
 * fp32 зовсім, тому там береться він — 18 МБ замість 50.
 *
 * Варіант ×4 у fp16 не використовується: він не завантажується в
 * onnxruntime 1.27 через помилку злиття вузлів у графі.
 */
export const UPSCALERS: readonly UpscalerDescriptor[] = [
  {
    factor: 2,
    bytes: 8_078_888,
    license: 'Apache-2.0',
    source: 'Xenova/swin2SR-lightweight-x2-64',
    file: 'swin2sr-x2.onnx',
    tileSize: 256,
    padTo: 8,
  },
  {
    factor: 4,
    bytes: 18_999_633,
    license: 'Apache-2.0',
    source: 'Xenova/swin2SR-realworld-sr-x4-64-bsrgan-psnr',
    file: 'swin2sr-x4-uint8.onnx',
    tileSize: 128,
    padTo: 8,
  },
];

export function upscalerFor(factor: UpscaleFactor): UpscalerDescriptor {
  const d = UPSCALERS.find((x) => x.factor === factor);
  if (d === undefined) throw new Error(`Немає апскейлера з множником ${factor}`);
  return d;
}
