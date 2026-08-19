import type { OutputFormat } from '@obrobka/core';
import type { SupportedMime } from './mime.js';

/** Один завантажуваний модуль jSquash: формат плюс напрям. */
export type Slot =
  | 'png-encode' | 'png-decode'
  | 'jpeg-encode' | 'jpeg-decode'
  | 'webp-encode' | 'webp-decode'
  | 'avif-encode' | 'avif-decode';

/** Мінімальний спільний вигляд модуля jSquash. */
export interface JsquashModule {
  init: (arg?: unknown) => Promise<unknown>;
  default: (...args: never[]) => Promise<unknown>;
}

/**
 * Готує щойно імпортований модуль до роботи.
 *
 * У браузері нічого робити не треба — jSquash сам тягне .wasm відносно
 * власного URL. У Node fetch не вміє схему file:, тож байти доводиться
 * читати з диска й передавати явно.
 */
export type InitStrategy = (slot: Slot, mod: JsquashModule) => Promise<void>;

export function encodeSlot(format: OutputFormat): Slot {
  return `${format}-encode`;
}

export function decodeSlot(mime: SupportedMime): Slot {
  const format = mime.slice('image/'.length) as OutputFormat;
  return `${format}-decode`;
}

async function importSlot(slot: Slot): Promise<JsquashModule> {
  switch (slot) {
    case 'png-encode': return await import('@jsquash/png/encode.js') as unknown as JsquashModule;
    case 'png-decode': return await import('@jsquash/png/decode.js') as unknown as JsquashModule;
    case 'jpeg-encode': return await import('@jsquash/jpeg/encode.js') as unknown as JsquashModule;
    case 'jpeg-decode': return await import('@jsquash/jpeg/decode.js') as unknown as JsquashModule;
    case 'webp-encode': return await import('@jsquash/webp/encode.js') as unknown as JsquashModule;
    case 'webp-decode': return await import('@jsquash/webp/decode.js') as unknown as JsquashModule;
    case 'avif-encode': return await import('@jsquash/avif/encode.js') as unknown as JsquashModule;
    case 'avif-decode': return await import('@jsquash/avif/decode.js') as unknown as JsquashModule;
  }
}

const ready = new Map<Slot, Promise<JsquashModule>>();

/**
 * Імпортує модуль і готує його рівно один раз.
 *
 * Проміс кешується до його завершення, тож два паралельні виклики
 * не породять двох ініціалізацій.
 */
export function loadSlot(slot: Slot, init: InitStrategy): Promise<JsquashModule> {
  const existing = ready.get(slot);
  if (existing !== undefined) return existing;

  const pending = (async (): Promise<JsquashModule> => {
    const mod = await importSlot(slot);
    await init(slot, mod);
    return mod;
  })();
  ready.set(slot, pending);
  return pending;
}
