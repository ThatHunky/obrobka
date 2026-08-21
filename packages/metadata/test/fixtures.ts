import { nodeCodec } from '@obrobka/codecs/node';
import type { RasterImage } from '@obrobka/core';

/**
 * Файли з метаданими доводиться будувати на місці.
 *
 * Взяти справжнє фото з EXIF нізвідки: у репозиторії воно було б чиїмось
 * знімком із чиїмись координатами. Тому кожен контейнер збирається тут,
 * байт за байтом, із передбачуваним вмістом.
 */

/** Несиметрична картинка: ліва половина червона, права синя. */
export function halvesImage(width: number, height: number): RasterImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const left = x < width / 2;
      data[i] = left ? 255 : 0;
      data[i + 1] = 0;
      data[i + 2] = left ? 0 : 255;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

export async function makeJpeg(img: RasterImage): Promise<Uint8Array> {
  return nodeCodec.encode(img, { format: 'jpeg', quality: 92 });
}

export async function makePng(img: RasterImage): Promise<Uint8Array> {
  return nodeCodec.encode(img, { format: 'png' });
}

export async function makeWebp(img: RasterImage): Promise<Uint8Array> {
  return nodeCodec.encode(img, { format: 'webp', quality: 90 });
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = Uint8Array.from([...type].map((c) => c.charCodeAt(0)));
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(typeBytes, 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** Вставляє текстовий чанк і час одразу після IHDR. */
export function pngWithText(png: Uint8Array, keyword: string, text: string): Uint8Array {
  const ihdrEnd = 8 + 25; // сигнатура + чанк IHDR завжди 25 байтів
  const tEXt = pngChunk('tEXt', Uint8Array.from(
    [...keyword].map((c) => c.charCodeAt(0)).concat(0, [...text].map((c) => c.charCodeAt(0))),
  ));
  const tIME = pngChunk('tIME', Uint8Array.from([0x07, 0xe6, 8, 21, 12, 0, 0]));
  const out = new Uint8Array(png.length + tEXt.length + tIME.length);
  out.set(png.subarray(0, ihdrEnd), 0);
  out.set(tEXt, ihdrEnd);
  out.set(tIME, ihdrEnd + tEXt.length);
  out.set(png.subarray(ihdrEnd), ihdrEnd + tEXt.length + tIME.length);
  return out;
}

function riffChunk(type: string, data: Uint8Array): Uint8Array {
  const pad = data.length % 2;
  const out = new Uint8Array(8 + data.length + pad);
  out.set(Uint8Array.from([...type].map((c) => c.charCodeAt(0))), 0);
  new DataView(out.buffer).setUint32(4, data.length, true);
  out.set(data, 8);
  return out;
}

/**
 * Перетворює простий WebP на розширений і додає чанк EXIF.
 *
 * Розширений формат — це VP8X попереду, і саме в його прапорцях
 * позначено, що в файлі є EXIF. Перевіряти, що зняття метаданих
 * гасить цей біт, є сенс лише на файлі, де він піднятий.
 */
export function webpWithExif(webp: Uint8Array, exif: Uint8Array, w: number, h: number): Uint8Array {
  const payload = webp.subarray(12);
  const flags = new Uint8Array(10);
  flags[0] = 0x08; // біт EXIF
  const write24 = (at: number, v: number): void => {
    flags[at] = v & 255; flags[at + 1] = (v >> 8) & 255; flags[at + 2] = (v >> 16) & 255;
  };
  write24(4, w - 1);
  write24(7, h - 1);

  const vp8x = riffChunk('VP8X', flags);
  const exifChunk = riffChunk('EXIF', exif);
  const body = new Uint8Array(vp8x.length + payload.length + exifChunk.length);
  body.set(vp8x, 0);
  body.set(payload, vp8x.length);
  body.set(exifChunk, vp8x.length + payload.length);

  const out = new Uint8Array(12 + body.length);
  out.set(webp.subarray(0, 12), 0);
  out.set(body, 12);
  new DataView(out.buffer).setUint32(4, out.length - 8, true);
  return out;
}

/** Розкладає файл на назви блоків — щоб тест перевіряв структуру, а не байти. */
export function jpegMarkers(bytes: Uint8Array): string[] {
  const out: string[] = [];
  let p = 0;
  while (p < bytes.length - 1) {
    if (bytes[p] !== 0xff) break;
    const marker = bytes[p + 1]!;
    out.push(marker.toString(16).padStart(2, '0'));
    if (marker === 0xd8) { p += 2; continue; }
    if (marker === 0xda || marker === 0xd9) break;
    p += 2 + ((bytes[p + 2]! << 8) | bytes[p + 3]!);
  }
  return out;
}

export function pngChunkTypes(bytes: Uint8Array): string[] {
  const out: string[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 8;
  while (p + 8 <= bytes.length) {
    const len = view.getUint32(p);
    const type = String.fromCharCode(...bytes.subarray(p + 4, p + 8));
    out.push(type);
    p += 12 + len;
    if (type === 'IEND') break;
  }
  return out;
}

export function webpChunkTypes(bytes: Uint8Array): string[] {
  const out: string[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 12;
  while (p + 8 <= bytes.length) {
    const type = String.fromCharCode(...bytes.subarray(p, p + 4));
    const len = view.getUint32(p + 4, true);
    out.push(type);
    p += 8 + len + (len % 2);
  }
  return out;
}
