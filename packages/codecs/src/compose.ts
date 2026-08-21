import type { Codec, RasterImage } from '@obrobka/core';

/**
 * Додає до кодека декодер для одного стороннього формату.
 *
 * Потрібне через HEIC: його вміє лише libheif, який важить 1,46 МБ і
 * ліцензований під LGPL. Ані тягнути його в основний кодек, ані статично
 * лінкувати не можна, тож формат під'єднується збоку й лише тоді, коли
 * такий файл справді відкрили.
 *
 * Усе, що не збігається з mime, проходить у базовий кодек без змін —
 * композиція не має права змінити поведінку для решти форматів.
 */
export function withDecoder(
  base: Codec,
  mime: string,
  decode: (bytes: Uint8Array) => Promise<RasterImage>,
): Codec {
  return {
    canDecode: (m) => m === mime || base.canDecode(m),
    canEncode: (f) => base.canEncode(f),
    decode: async (bytes, m) => (m === mime ? decode(bytes) : base.decode(bytes, m)),
    encode: (img, opts) => base.encode(img, opts),
  };
}
