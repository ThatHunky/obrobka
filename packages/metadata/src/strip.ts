import { sniffMime } from '@obrobka/codecs';

/**
 * Маркери JPEG, які треба прибрати.
 *
 * APP1 тримає і EXIF, і XMP — обидва є метаданими. APP13 тримає блок
 * Photoshop із IPTC. COM — це текстовий коментар.
 *
 * APP2 (профіль ICC) і APP14 (Adobe) лишаються навмисно: перший визначає,
 * якими будуть кольори на екрані, другий — як інтерпретувати канали.
 * Це не дані про людину, а частина опису самого зображення, і прибрати їх
 * означало б змінити картинку, а не почистити її.
 */
const JPEG_DROP: ReadonlySet<number> = new Set([0xe1, 0xed, 0xfe]);

/** Маркери без поля довжини. */
function isStandalone(marker: number): boolean {
  return marker === 0xd8 || marker === 0xd9 || marker === 0x01
    || (marker >= 0xd0 && marker <= 0xd7);
}

function stripJpeg(bytes: Uint8Array): Uint8Array {
  const keep: Uint8Array[] = [];
  let p = 0;

  while (p < bytes.length) {
    if (bytes[p] !== 0xff) {
      throw new Error(`Пошкоджений JPEG: очікувався маркер за зміщенням ${p}`);
    }
    // Перед маркером допускається скільки завгодно байтів 0xFF.
    let m = p + 1;
    while (m < bytes.length && bytes[m] === 0xff) m++;
    const marker = bytes[m];
    if (marker === undefined) throw new Error('Пошкоджений JPEG: файл обірвано на маркері');

    if (isStandalone(marker)) {
      keep.push(bytes.subarray(p, m + 1));
      p = m + 1;
      continue;
    }
    if (marker === 0xda) {
      // Далі йде стиснений потік аж до кінця файлу — його не розбираємо.
      keep.push(bytes.subarray(p));
      break;
    }

    const len = (bytes[m + 1]! << 8) | bytes[m + 2]!;
    if (len < 2) throw new Error(`Пошкоджений JPEG: довжина сегмента ${len} за зміщенням ${m}`);
    const end = m + 1 + len;
    if (end > bytes.length) throw new Error('Пошкоджений JPEG: сегмент виходить за межі файлу');

    if (!JPEG_DROP.has(marker)) keep.push(bytes.subarray(p, end));
    p = end;
  }

  return concat(keep);
}

/** Чанки PNG, які тримають текст, час і метадані. */
const PNG_DROP: ReadonlySet<string> = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);

function stripPng(bytes: Uint8Array): Uint8Array {
  const keep: Uint8Array[] = [bytes.subarray(0, 8)];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 8;

  while (p + 8 <= bytes.length) {
    const len = view.getUint32(p);
    const type = String.fromCharCode(...bytes.subarray(p + 4, p + 8));
    const end = p + 12 + len;
    if (end > bytes.length) throw new Error(`Пошкоджений PNG: чанк ${type} виходить за межі файлу`);
    if (!PNG_DROP.has(type)) keep.push(bytes.subarray(p, end));
    p = end;
    if (type === 'IEND') break;
  }

  return concat(keep);
}

/** Чанки WebP із метаданими. */
const WEBP_DROP: ReadonlySet<string> = new Set(['EXIF', 'XMP ']);

/**
 * Прапорці наявності в чанку VP8X: біт 3 — EXIF, біт 2 — XMP.
 * Лишити їх піднятими після видалення чанків означало б віддати файл,
 * який сам про себе бреше.
 */
const VP8X_META_FLAGS = 0x0c;

function stripWebp(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const keep: Uint8Array[] = [];
  let p = 12;
  let dropped = false;

  while (p + 8 <= bytes.length) {
    const type = String.fromCharCode(...bytes.subarray(p, p + 4));
    const len = view.getUint32(p + 4, true);
    // Чанки вирівняні до парного розміру — байт-заповнювач належить чанку.
    const end = p + 8 + len + (len % 2);
    if (end > bytes.length) throw new Error(`Пошкоджений WebP: чанк ${type} виходить за межі файлу`);

    if (WEBP_DROP.has(type)) {
      dropped = true;
    } else if (type === 'VP8X') {
      const chunk = bytes.slice(p, end);
      chunk[8] = (chunk[8]! & ~VP8X_META_FLAGS) & 0xff;
      keep.push(chunk);
    } else {
      keep.push(bytes.subarray(p, end));
    }
    p = end;
  }

  if (!dropped) return bytes;

  const body = concat(keep);
  const out = new Uint8Array(12 + body.length);
  out.set(bytes.subarray(0, 12));
  out.set(body, 12);
  // Поле розміру RIFF рахує все після себе: 4 байти 'WEBP' плюс чанки.
  new DataView(out.buffer).setUint32(4, out.length - 8, true);
  return out;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
}

/**
 * Прибирає метадані, не чіпаючи пікселі.
 *
 * Сенс саме в цьому: конвертація й так стирає все — вона перемальовує
 * зображення з нуля. Ця функція потрібна тоді, коли перестискати не можна:
 * зняти координати з фотографії, лишивши її байт у байт тією самою.
 *
 * AVIF і HEIC не підтримуються навмисно. Метадані там лежать у боксі `meta`
 * як окремі елементи з посиланнями з `iinf` та `iref`; вирізати їх наосліп —
 * найкоротший шлях зробити файл, який десь відкриється, а десь ні.
 * Для цих форматів надійніше перекодувати.
 */
export async function stripMetadata(bytes: Uint8Array): Promise<Uint8Array> {
  const mime = sniffMime(bytes);
  switch (mime) {
    case 'image/jpeg': return stripJpeg(bytes);
    case 'image/png': return stripPng(bytes);
    case 'image/webp': return stripWebp(bytes);
    case 'image/avif':
    case 'image/heic':
      throw new Error(
        `Знімати метадані з ${mime} без перекодування ми не вміємо: у цих форматах ` +
        'вони вплетені в структуру файлу. Перекодуйте зображення — при перекодуванні ' +
        'метадані не переносяться взагалі.',
      );
    default:
      throw new Error(
        'Не вдалося визначити формат файлу. Підтримуються JPEG, PNG і WebP.',
      );
  }
}
