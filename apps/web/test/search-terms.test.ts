import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Заголовок сторінки мусить містити ту фразу, якою її задачу шукають.
 *
 * Фрази й обсяги — із DataForSEO по Україні, див.
 * docs/superpowers/specs/2026-09-25-obrobka-seo-design.md. Тест стоїть
 * на зібраному HTML, бо частина сторінок написана в YAML і в матриці
 * її немає, а бачить пошук саме те, що в dist.
 */

const dist = join(import.meta.dirname, '..', 'dist');

async function head(path: string): Promise<{ title: string; h1: string; description: string }> {
  const html = await readFile(join(dist, path, 'index.html'), 'utf8');
  const pick = (re: RegExp): string => (re.exec(html)?.[1] ?? '')
    .replace(/<[^>]+>/g, ' ').replace(/&#39;/g, '\'').replace(/\s+/g, ' ').trim().toLowerCase();
  return {
    title: pick(/<title>([^<]*)<\/title>/),
    h1: pick(/<h1[^>]*>(.*?)<\/h1>/s),
    description: pick(/<meta name="description" content="([^"]*)"/),
  };
}

const CASES: readonly { path: string; title: string; h1?: string; description?: string }[] = [
  // 22 200 + 22 200 проти 260 у «збільшити зображення».
  { path: 'збільшити-зображення', title: 'покращити якість фото', h1: 'покращити якість фото' },
  // 4 400 «зменшити розмір фото», 2 400 «стиснути фото».
  { path: 'стиснути-зображення', title: 'стиснути фото', h1: 'стиснути фото',
    description: 'зменшити розмір фото' },
  { path: 'розумна-обрізка', title: 'обрізати фото онлайн', h1: 'обрізати фото' },
  { path: 'видалити-фон', title: 'видалити фон з фото', h1: 'видалити фон з фото',
    description: 'вирізати' },
  { path: 'прибрати-exif', title: 'видалити метадані з фото', h1: 'видалити метадані з фото' },
  { path: 'змінити-розмір-зображення', title: 'змінити розмір', h1: 'змінити розмір фото' },
  { path: 'вертикальне-фото-для-інстаграму', title: 'формат 4:5', h1: 'формат 4:5' },
  { path: 'аватар', title: 'аватарка', h1: 'аватарка' },
  // JPG — так формат шукають: «webp в jpg» 260 проти «webp в jpeg» 20.
  { path: 'webp-в-jpeg', title: 'webp в jpg', h1: 'webp в jpg' },
  { path: 'png-в-jpeg', title: 'png в jpg', h1: 'png в jpg' },
  { path: 'heic-в-jpg', title: 'heic в jpg', h1: 'heic в jpg' },
  { path: 'jpeg-в-png', title: 'jpg в png', h1: 'jpg в png' },
  { path: 'en/webp-to-jpeg', title: 'webp to jpg', h1: 'webp to jpg' },
  { path: 'en/png-to-jpeg', title: 'png to jpg', h1: 'png to jpg' },
  { path: '', title: 'конвертер фото онлайн', description: 'змінити формат фото' },
];

describe('заголовки містять фразу, якою задачу шукають', () => {
  it.each(CASES)('$path', async ({ path, title, h1, description }) => {
    const got = await head(path);
    expect(got.title).toContain(title);
    if (h1 !== undefined) expect(got.h1).toContain(h1);
    if (description !== undefined) expect(got.description).toContain(description);
  });
});
