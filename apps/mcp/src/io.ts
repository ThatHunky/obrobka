import { readFile, writeFile } from 'node:fs/promises';
import { sniffMime, type SupportedMime } from '@obrobka/codecs';
import type { RGBA } from '@obrobka/core';

export async function readImage(
  path: string,
): Promise<{ bytes: Uint8Array; mime: SupportedMime }> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await readFile(path));
  } catch {
    throw new Error(`Файл не знайдено або недоступний для читання: ${path}`);
  }
  const mime = sniffMime(bytes);
  if (mime === null) {
    throw new Error(
      `Не вдалося визначити формат зображення: ${path}. ` +
      'Підтримуються PNG, JPEG, WebP і AVIF.',
    );
  }
  return { bytes, mime };
}

export async function writeImage(path: string, bytes: Uint8Array): Promise<void> {
  try {
    await writeFile(path, bytes);
  } catch {
    throw new Error(`Не вдалося записати файл: ${path}`);
  }
}

/** #rrggbb або #rrggbbaa у RGBA. */
export function parseColor(hex: string): RGBA {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{8})$/i.exec(hex.trim());
  if (m === null) {
    throw new Error(`Очікувався колір як #rrggbb або #rrggbbaa, отримано "${hex}"`);
  }
  const h = m[1]!;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    a: h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255,
  };
}
