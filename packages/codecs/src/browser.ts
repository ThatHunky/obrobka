import type { Codec } from '@obrobka/core';
import { createCodec } from './codec.js';

/**
 * Кодек для браузера.
 *
 * Ініціалізація порожня: jSquash сам завантажує .wasm відносно URL власного
 * модуля, а збирач проставляє правильні шляхи. Виклик init() тут лише
 * прогріває модуль, щоб перше кодування не чекало на компіляцію WASM.
 */
export const browserCodec: Codec = createCodec(async (_slot, mod) => {
  await mod.init();
});
