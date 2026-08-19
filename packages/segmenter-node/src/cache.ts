import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DIR = join(homedir(), '.cache', 'obrobka', 'models');

export function cachePath(file: string): string {
  return join(DIR, file);
}

/**
 * Повертає шлях до моделі, завантажуючи її за потреби.
 *
 * Файл пишеться під тимчасовим іменем і перейменовується лише після
 * повного завантаження: обірваний процес не лишить у кеші огризок,
 * який потім тихо не запуститься.
 */
export async function ensureModel(
  file: string, url: string, onProgress?: (fraction: number) => void,
): Promise<string> {
  const target = cachePath(file);
  try {
    await stat(target);
    onProgress?.(1);
    return target;
  } catch { /* немає — качаємо */ }

  await mkdir(DIR, { recursive: true });
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Не вдалося завантажити модель ${file}: HTTP ${res.status}`);
  }

  const total = Number(res.headers.get('content-length') ?? 0);
  const reader = res.body?.getReader();
  if (reader === undefined) throw new Error(`Порожня відповідь для моделі ${file}`);

  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total > 0) onProgress?.(received / total);
  }

  const blob = new Uint8Array(received);
  let at = 0;
  for (const c of chunks) { blob.set(c, at); at += c.length; }

  const tmp = `${target}.${process.pid}.part`;
  await writeFile(tmp, blob);
  await rename(tmp, target);
  onProgress?.(1);
  return target;
}
