import type { RasterImage } from '@obrobka/core';

/**
 * Декодування HEIC через libheif.
 *
 * Пакет свідомо окремий. libheif ліцензований під LGPL-3.0, а вимога цієї
 * ліцензії — можливість замінити бібліотеку. Динамічний імпорт окремого
 * модуля, без статичного лінкування, цю вимогу задовольняє; вкомпілювати
 * libheif у спільний кодек — ні.
 *
 * Кодування не підтримується: libheif-js уміє лише читати.
 */

/** Мінімальний вигляд модуля libheif — типів для цього підшляху немає. */
interface HeifHandle { readonly __brand?: never }

interface HeifImage {
  get_width(): number;
  get_height(): number;
  display(
    target: { data: Uint8ClampedArray; width: number; height: number },
    done: (result: unknown) => void,
  ): void;
  free(): void;
}

interface LibHeif {
  heif_context_alloc(): number;
  heif_context_free(ctx: number): void;
  heif_context_read_from_memory(ctx: number, bytes: Uint8Array): { code: unknown; message: string };
  heif_js_context_get_primary_image_handle(ctx: number): HeifHandle & { code?: unknown };
  heif_error_code: { heif_error_Ok: unknown };
  HeifImage: new (handle: HeifHandle) => HeifImage;
}

/**
 * Стеля на розмір.
 *
 * 100 Мп у RGBA — це 400 МБ на один буфер, і потрібен щонайменше другий.
 * Краще сказати про це прямо, ніж дати вкладці мовчки впасти.
 */
const MAX_PIXELS = 100_000_000;

let loading: Promise<LibHeif> | null = null;

/**
 * Вантажить libheif один раз.
 *
 * Обрано збірку з вбудованим wasm: у Node `fetch` не вміє схему `file:`,
 * і саме на це ми вже наступили з jSquash у M1. Base64 роздуває модуль
 * до 1,46 МБ, зате шлях один для браузера й для Node.
 */
function loadLibheif(): Promise<LibHeif> {
  loading ??= import('libheif-js/libheif-wasm/libheif-bundle.mjs')
    .then((m: unknown) => {
      const factory = (m as { default?: unknown }).default;
      if (typeof factory !== 'function') {
        throw new Error('Модуль libheif не має фабрики — несумісна версія');
      }
      return (factory as () => LibHeif)();
    });
  return loading;
}

/**
 * Декодує головне зображення HEIC.
 *
 * Головне, а не перше: у файлі буває кілька зображень верхнього рівня —
 * серії, вибір найкращого кадру. `HeifDecoder.decode()` віддає їх списком
 * у порядку ідентифікаторів, і брати `[0]` — це вгадувати.
 *
 * Метод `HeifImage.is_primary()` тут не допоміг би: у версії 1.19.8 він
 * звертається до `heif_image_handle_is_primary_image` як до глобальної
 * змінної й кидає ReferenceError. Робочий шлях — попросити в контексту
 * одразу головний хендл.
 */
export async function decodeHeic(bytes: Uint8Array): Promise<RasterImage> {
  const libheif = await loadLibheif();
  const ctx = libheif.heif_context_alloc();
  if (ctx === 0) throw new Error('libheif не змогла створити контекст');

  try {
    const err = libheif.heif_context_read_from_memory(ctx, bytes);
    if (err.code !== libheif.heif_error_code.heif_error_Ok) {
      throw new Error(`Не вдалося прочитати HEIC: ${err.message}`);
    }

    const handle = libheif.heif_js_context_get_primary_image_handle(ctx);
    if (handle === undefined || handle === null || handle.code !== undefined) {
      throw new Error('У файлі HEIC немає головного зображення');
    }

    const image = new libheif.HeifImage(handle);
    try {
      const width = image.get_width();
      const height = image.get_height();
      if (width < 1 || height < 1) {
        throw new Error(`HEIC повідомляє про розмір ${width}×${height} — файл пошкоджений`);
      }
      if (width * height > MAX_PIXELS) {
        throw new Error(
          `Зображення ${width}×${height} — це ${Math.round(width * height / 1e6)} Мп, ` +
          `більше за межу в ${MAX_PIXELS / 1e6} Мп. Такий буфер не вміститься в пам'ять вкладки.`,
        );
      }

      const target = { data: new Uint8ClampedArray(width * height * 4), width, height };
      await new Promise<void>((resolve, reject) => {
        image.display(target, (result) => {
          if (result === null || result === undefined) {
            reject(new Error('libheif не змогла розкодувати зображення'));
            return;
          }
          resolve();
        });
      });
      return target;
    } finally {
      image.free();
    }
  } finally {
    // Контекст тримає весь розібраний файл. Без цього кожен HEIC у батчі
    // лишав би по собі копію в купі wasm — двадцять файлів, двадцять копій.
    libheif.heif_context_free(ctx);
  }
}
