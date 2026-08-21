import { isOrientation, type Orientation } from '@obrobka/core';

export interface GpsPosition {
  readonly latitude: number;
  readonly longitude: number;
  /** Метри над рівнем моря, якщо камера це записала. */
  readonly altitude?: number;
}

export interface CameraInfo {
  readonly make?: string;
  readonly model?: string;
  readonly lens?: string;
}

export interface ShotInfo {
  /** ISO-8601. Дата зберігається рядком, щоб результат лишався JSON. */
  readonly takenAt?: string;
  /** Витримка в секундах. */
  readonly exposureTime?: number;
  readonly fNumber?: number;
  readonly iso?: number;
  /** Фокусна відстань у міліметрах. */
  readonly focalLength?: number;
}

export interface Metadata {
  readonly orientation?: Orientation;
  readonly camera?: CameraInfo;
  readonly shot?: ShotInfo;
  /** Виділено окремо: саме координати варто показати людині окремим попередженням. */
  readonly gps?: GpsPosition;
  readonly software?: string;
  /** Усі знайдені теґи, приведені до JSON. Для агента, якому потрібне все. */
  readonly tags: Readonly<Record<string, unknown>>;
}

export const EMPTY_METADATA: Metadata = { tags: {} };

/** Чи знайшлось хоч щось, що варто показувати. */
export function hasMetadata(m: Metadata): boolean {
  return Object.keys(m.tags).length > 0;
}

type Blocks = Record<string, Record<string, unknown> | undefined>;
type Parser = (bytes: Uint8Array, options: unknown) => Promise<Blocks | undefined>;

let parser: Promise<Parser> | null = null;

/**
 * exifr важить 75 КБ і потрібен лише тим, хто відкрив панель або HEIC.
 * Імпорт кешується разом із промісом, тож два паралельні читання
 * не завантажать модуль двічі.
 */
function loadParser(): Promise<Parser> {
  parser ??= import('exifr').then((m) => {
    const mod = (m as { default?: { parse?: unknown }; parse?: unknown });
    const parse = mod.default?.parse ?? mod.parse;
    if (typeof parse !== 'function') {
      throw new Error('Модуль exifr не має функції parse — несумісна версія');
    }
    return parse as Parser;
  });
  return parser;
}

function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  return trimmed === '' ? undefined : trimmed;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function iso(v: unknown): string | undefined {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();
  return str(v);
}

/** Той самий набір полів, але кожне може бути відсутнім. */
type Loose<T> = { [K in keyof T]: T[K] | undefined };

/** Прибирає undefined, щоб об'єкт не з'являвся заради самих порожніх полів. */
function compact<T extends object>(obj: Loose<T>): T | undefined {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
  return entries.length === 0 ? undefined : (Object.fromEntries(entries) as T);
}

/** Дати в JSON не серіалізуються осмислено, а масиви раціоналів — серіалізуються. */
function jsonSafe(value: unknown): unknown {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (value instanceof Uint8Array) return `<${value.length} байт>`;
  if (Array.isArray(value)) return value.map(jsonSafe);
  return value;
}

/** Похідні поля exifr — вони вже лежать у типізованому gps. */
const DERIVED: ReadonlySet<string> = new Set(['latitude', 'longitude']);

/**
 * Блоки, які справді є метаданими.
 *
 * Свідомо без `jfif` і `ihdr`: там лежить опис самого контейнера —
 * бітова глибина, тип фільтра, версія заголовка. Показувати це людині
 * в панелі «що було у вашому файлі» безглуздо, а головне — через них
 * будь-який PNG виглядав би файлом із метаданими, і панель вискакувала б
 * завжди.
 */
const BLOCKS: readonly string[] = ['ifd0', 'exif', 'gps', 'interop', 'xmp', 'iptc'];

function mergeBlocks(blocks: Blocks): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const name of BLOCKS) {
    const block = blocks[name];
    if (block === undefined || block === null) continue;
    Object.assign(out, block);
  }
  return out;
}

function toTags(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (DERIVED.has(k) || v === undefined) continue;
    out[k] = jsonSafe(v);
  }
  return out;
}

/**
 * Читає метадані з байтів файлу.
 *
 * Формат визначає сам exifr — він уміє JPEG, PNG, TIFF, HEIC та AVIF.
 * Файл без метаданих і файл невідомого формату дають однаковий
 * результат: порожній об'єкт. Читання метаданих — річ довідкова,
 * і воно не має права зупинити обробку зображення.
 */
export async function readMetadata(bytes: Uint8Array): Promise<Metadata> {
  let blocks: Blocks | undefined;
  try {
    const parse = await loadParser();
    // translateValues: false лишає Orientation числом. З типовим true
    // він став би рядком «Rotate 90 CW», непридатним для повороту.
    // mergeOutput: false потрібен, щоб відрізнити метадані від заголовка
    // контейнера — злиті в один об'єкт, вони нерозрізненні.
    blocks = await parse(bytes, {
      tiff: true, exif: true, gps: true, ifd0: true, xmp: true, iptc: true,
      translateKeys: true, translateValues: false, reviveValues: true,
      mergeOutput: false,
    });
  } catch {
    return EMPTY_METADATA;
  }
  if (blocks === undefined) return EMPTY_METADATA;
  const raw = mergeBlocks(blocks);

  const latitude = num(raw['latitude']);
  const longitude = num(raw['longitude']);
  const altitude = num(raw['GPSAltitude']);
  const gps: GpsPosition | undefined = latitude !== undefined && longitude !== undefined
    ? { latitude, longitude, ...(altitude === undefined ? {} : { altitude }) }
    : undefined;

  const camera = compact<CameraInfo>({
    make: str(raw['Make']),
    model: str(raw['Model']),
    lens: str(raw['LensModel']) ?? str(raw['LensMake']),
  });

  const shot = compact<ShotInfo>({
    takenAt: iso(raw['DateTimeOriginal']) ?? iso(raw['CreateDate']),
    exposureTime: num(raw['ExposureTime']),
    fNumber: num(raw['FNumber']),
    iso: num(raw['ISO']),
    focalLength: num(raw['FocalLength']),
  });

  const orientation = raw['Orientation'];
  const software = str(raw['Software']);

  return {
    ...(isOrientation(orientation) ? { orientation } : {}),
    ...(camera === undefined ? {} : { camera }),
    ...(shot === undefined ? {} : { shot }),
    ...(gps === undefined ? {} : { gps }),
    ...(software === undefined ? {} : { software }),
    tags: toTags(raw),
  };
}

/**
 * Читає лише орієнтацію.
 *
 * Окремий шлях, бо цим користується пайплайн на кожному зображенні,
 * а йому з усього EXIF потрібне одне число.
 */
export async function readOrientation(bytes: Uint8Array): Promise<Orientation> {
  const meta = await readMetadata(bytes);
  return meta.orientation ?? 1;
}
