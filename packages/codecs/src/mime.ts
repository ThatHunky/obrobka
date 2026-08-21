export type SupportedMime = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/avif' | 'image/heic';

function startsWith(bytes: Uint8Array, offset: number, signature: readonly number[]): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((b, i) => bytes[offset + i] === b);
}

/** AVIF: окреме зображення та послідовність. */
const AVIF_BRANDS: ReadonlySet<string> = new Set(['avif', 'avis']);

/**
 * HEIC та родина HEIF.
 *
 * `mif1` і `msf1` — це загальні бренди HEIF без прив'язки до кодека.
 * Вони теж сюди входять: справжні файли часто оголошують саме їх головними,
 * а `heic` ховають у список сумісних.
 */
const HEIC_BRANDS: ReadonlySet<string> = new Set([
  'heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs', 'mif1', 'msf1',
]);

/** Розумна стеля на бокс ftyp — далі шукати нема сенсу. */
const MAX_FTYP = 256;

/**
 * Збирає головний бренд і всі сумісні з боксу ftyp.
 *
 * Чотирьох байтів за зміщенням 8 недостатньо: у перевіреному файлі з айфона
 * головним брендом стоїть `mif1`, а `heic` лежить серед сумісних. Читати
 * лише головний бренд означає не впізнати частину справжніх HEIC.
 */
function ftypBrands(bytes: Uint8Array): readonly string[] {
  if (!startsWith(bytes, 4, [0x66, 0x74, 0x79, 0x70])) return [];
  const size = (bytes[0]! << 24 | bytes[1]! << 16 | bytes[2]! << 8 | bytes[3]!) >>> 0;
  const end = Math.min(size < 16 ? 16 : size, bytes.length, MAX_FTYP);

  const brands: string[] = [];
  // 8..12 — головний бренд, 12..16 — версія, далі сумісні по чотири байти.
  for (const at of [8, ...range(16, end)]) {
    if (at + 4 > end) break;
    brands.push(String.fromCharCode(...bytes.subarray(at, at + 4)));
  }
  return brands;
}

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = from; i + 4 <= to; i += 4) out.push(i);
  return out;
}

/**
 * Визначає формат за сигнатурою байтів.
 * Розширення файлу брехливе — браузери й месенджери регулярно
 * віддають HEIC під іменем .jpg.
 */
export function sniffMime(bytes: Uint8Array): SupportedMime | null {
  if (bytes.length < 12) return null;
  if (startsWith(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, 0, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, 0, [0x52, 0x49, 0x46, 0x46]) &&
      startsWith(bytes, 8, [0x57, 0x45, 0x42, 0x50])) return 'image/webp';

  const brands = ftypBrands(bytes);
  // AVIF перевіряємо першим: файли AVIF регулярно містять `mif1` серед
  // сумісних брендів, тож перевірка HEIF спрацювала б на них помилково.
  if (brands.some((b) => AVIF_BRANDS.has(b))) return 'image/avif';
  if (brands.some((b) => HEIC_BRANDS.has(b))) return 'image/heic';
  return null;
}
