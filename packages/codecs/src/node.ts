import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import type { Codec } from '@obrobka/core';
import { createCodec } from './codec.js';
import type { Slot } from './modules.js';

const require = createRequire(import.meta.url);

/** Де лежить .wasm для кожного модуля. */
const WASM_PATH: Readonly<Record<Slot, string>> = {
  'png-encode': '@jsquash/png/codec/pkg/squoosh_png_bg.wasm',
  'png-decode': '@jsquash/png/codec/pkg/squoosh_png_bg.wasm',
  'jpeg-encode': '@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm',
  'jpeg-decode': '@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm',
  'webp-encode': '@jsquash/webp/codec/enc/webp_enc.wasm',
  'webp-decode': '@jsquash/webp/codec/dec/webp_dec.wasm',
  'avif-encode': '@jsquash/avif/codec/enc/avif_enc.wasm',
  'avif-decode': '@jsquash/avif/codec/dec/avif_dec.wasm',
};

/**
 * Кодек для Node.
 *
 * Збірки jSquash орієнтовані на веб і тягнуть свій .wasm через fetch.
 * У Node fetch не підтримує схему file:, тож байти читаємо з диска
 * й передаємо в init явно.
 *
 * Модуль PNG зібрано через wasm-bindgen — його init приймає самі байти.
 * JPEG, WebP і AVIF зібрані Emscripten — вони чекають на { wasmBinary }.
 */
export const nodeCodec: Codec = createCodec(async (slot, mod) => {
  const bytes = await readFile(require.resolve(WASM_PATH[slot]));
  await mod.init(slot.startsWith('png-') ? bytes : { wasmBinary: bytes });
});
