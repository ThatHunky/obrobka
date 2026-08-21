import type { Orientation } from '@obrobka/core';

/**
 * Конструктор сегмента APP1 з EXIF.
 *
 * Потрібен, щоб тести працювали на справжніх байтах, а не на макетах.
 * Готовий JPEG з орієнтацією й координатами не візьмеш нізвідки: викласти
 * бінарник у репозиторій означає покласти туди чиєсь фото з чиїмись
 * координатами, а зібрати його на місці — рівно ці сімдесят рядків.
 */

interface Field {
  readonly tag: number;
  readonly type: 1 | 2 | 3 | 4 | 5;
  readonly count: number;
  readonly payload: readonly number[];
}

const u16 = (v: number): number[] => [(v >> 8) & 255, v & 255];
const u32 = (v: number): number[] => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];

function ascii(tag: number, value: string): Field {
  const bytes = [...value].map((c) => c.charCodeAt(0) & 0x7f);
  bytes.push(0);
  return { tag, type: 2, count: bytes.length, payload: bytes };
}

function short(tag: number, value: number): Field {
  return { tag, type: 3, count: 1, payload: u16(value) };
}

/** Градуси, хвилини, секунди — три раціональні числа підряд, як вимагає EXIF. */
function dms(tag: number, degrees: number): Field {
  const d = Math.floor(Math.abs(degrees));
  const minutesTotal = (Math.abs(degrees) - d) * 60;
  const m = Math.floor(minutesTotal);
  const s = Math.round((minutesTotal - m) * 60 * 100);
  return {
    tag, type: 5, count: 3,
    payload: [...u32(d), ...u32(1), ...u32(m), ...u32(1), ...u32(s), ...u32(100)],
  };
}

/**
 * Збирає IFD.
 *
 * Записи мусять іти за зростанням теґа — це вимога TIFF, і читачі, суворіші
 * за exifr, на порушенні спиняються. Значення довші за чотири байти
 * не влазять у поле запису й лягають у ділянку даних за зміщенням.
 */
function buildIfd(fields: readonly Field[], ifdOffset: number): {
  bytes: number[]; nextFree: number;
} {
  const sorted = [...fields].sort((a, b) => a.tag - b.tag);
  const headerSize = 2 + 12 * sorted.length + 4;
  let dataAt = ifdOffset + headerSize;

  const entries: number[] = [];
  const data: number[] = [];
  for (const f of sorted) {
    entries.push(...u16(f.tag), ...u16(f.type), ...u32(f.count));
    if (f.payload.length <= 4) {
      entries.push(...f.payload, ...new Array(4 - f.payload.length).fill(0));
    } else {
      entries.push(...u32(dataAt));
      data.push(...f.payload);
      dataAt += f.payload.length;
    }
  }
  return {
    bytes: [...u16(sorted.length), ...entries, ...u32(0), ...data],
    nextFree: dataAt,
  };
}

export interface ExifSpec {
  readonly orientation?: Orientation;
  readonly make?: string;
  readonly model?: string;
  readonly software?: string;
  readonly gps?: { readonly latitude: number; readonly longitude: number };
}

/** Тег-покажчик на GPS IFD. */
const GPS_IFD_POINTER = 0x8825;

/** Будує готовий сегмент APP1, разом із маркером і полем довжини. */
export function buildExifApp1(spec: ExifSpec): Uint8Array {
  const fields: Field[] = [];
  if (spec.orientation !== undefined) fields.push(short(0x0112, spec.orientation));
  if (spec.make !== undefined) fields.push(ascii(0x010f, spec.make));
  if (spec.model !== undefined) fields.push(ascii(0x0110, spec.model));
  if (spec.software !== undefined) fields.push(ascii(0x0131, spec.software));

  // Місце під покажчик треба зайняти до розкладки: без нього IFD0 буде
  // на дванадцять байтів коротшим, і всі зміщення поїдуть.
  if (spec.gps !== undefined) {
    fields.push({ tag: GPS_IFD_POINTER, type: 4, count: 1, payload: u32(0) });
  }

  const ifd0 = buildIfd(fields, 8);
  let tail: number[] = [];
  if (spec.gps !== undefined) {
    const gpsAt = ifd0.nextFree;
    const gps = buildIfd([
      { tag: 0x0001, type: 2, count: 2, payload: [spec.gps.latitude >= 0 ? 78 : 83, 0] },
      dms(0x0002, spec.gps.latitude),
      { tag: 0x0003, type: 2, count: 2, payload: [spec.gps.longitude >= 0 ? 69 : 87, 0] },
      dms(0x0004, spec.gps.longitude),
    ], gpsAt);
    tail = gps.bytes;
    patchPointer(ifd0.bytes, GPS_IFD_POINTER, gpsAt);
  }

  const tiff = [0x4d, 0x4d, 0x00, 0x2a, ...u32(8), ...ifd0.bytes, ...tail];
  const payload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff]; // "Exif\0\0"
  return Uint8Array.from([0xff, 0xe1, ...u16(payload.length + 2), ...payload]);
}

/** Вписує справжнє зміщення в уже розкладений запис. */
function patchPointer(ifd: number[], tag: number, value: number): void {
  const count = (ifd[0]! << 8) | ifd[1]!;
  for (let i = 0; i < count; i++) {
    const at = 2 + i * 12;
    if (((ifd[at]! << 8) | ifd[at + 1]!) !== tag) continue;
    ifd.splice(at + 8, 4, ...u32(value));
    return;
  }
  throw new Error(`У IFD немає запису з теґом 0x${tag.toString(16)} — нікуди вписувати зміщення`);
}

/**
 * Вставляє сегмент одразу після SOI.
 *
 * Саме туди його кладуть камери, і саме там його першим шукають читачі.
 */
export function withExif(jpeg: Uint8Array, app1: Uint8Array): Uint8Array {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) {
    throw new Error('Очікувався JPEG: файл не починається з SOI');
  }
  const out = new Uint8Array(jpeg.length + app1.length);
  out.set(jpeg.subarray(0, 2), 0);
  out.set(app1, 2);
  out.set(jpeg.subarray(2), 2 + app1.length);
  return out;
}
