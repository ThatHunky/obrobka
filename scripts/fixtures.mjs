import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Кеш тестових файлів, які не можна покласти в репозиторій.
 *
 * HEIC не збереш програмно — libheif-js уміє лише читати, а покласти в
 * репозиторій чуже фото означало б покласти туди чиїсь координати
 * й чиюсь ліцензію. Тож файл береться з conformance-набору Nokia
 * і кешується так само, як моделі: поруч, у ~/.cache/obrobka.
 */
const DIR = join(homedir(), '.cache', 'obrobka', 'fixtures');

export const FIXTURES = {
  'sample.heic':
    'https://github.com/nokiatech/heif_conformance/raw/master/conformance_files/C003.heic',
};

export function fixturePath(name) {
  return join(DIR, name);
}

export async function ensureFixture(name) {
  const url = FIXTURES[name];
  if (url === undefined) throw new Error(`Невідома фікстура: ${name}`);

  const target = fixturePath(name);
  try {
    await stat(target);
    return target;
  } catch { /* немає — качаємо */ }

  await mkdir(DIR, { recursive: true });
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Не вдалося завантажити фікстуру ${name}: HTTP ${res.status}. ` +
      'Тест потребує мережі при першому запуску; далі файл береться з кешу.',
    );
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  const tmp = `${target}.${process.pid}.part`;
  await writeFile(tmp, bytes);
  await rename(tmp, target);
  return target;
}
