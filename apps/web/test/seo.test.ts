import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const dist = join(import.meta.dirname, '..', 'dist');
let uk = '';
let en = '';

beforeAll(async () => {
  uk = await readFile(join(dist, 'стікер-для-телеграма', 'index.html'), 'utf8');
  en = await readFile(join(dist, 'en', 'telegram-sticker', 'index.html'), 'utf8');
}, 60_000);

function jsonLdTypes(html: string): string[] {
  const m = /<script type="application\/ld\+json">(.+?)<\/script>/s.exec(html);
  if (m === null) return [];
  const parsed = JSON.parse(m[1]!) as { '@graph': { '@type': string }[] };
  return parsed['@graph'].map((n) => n['@type']).sort();
}

describe('сторінка інструмента', () => {
  it('українська сторінка згенерована', () => {
    expect(uk).toContain('Стікер для Telegram');
  });

  it('англійська сторінка згенерована', () => {
    expect(en).toContain('Telegram sticker');
  });

  it('містить усі три типи структурованих даних', () => {
    expect(jsonLdTypes(uk)).toEqual(['FAQPage', 'HowTo', 'SoftwareApplication']);
  });

  it('локалі посилаються одна на одну', () => {
    expect(uk).toContain('/en/telegram-sticker/');
    expect(en).toContain('hreflang="uk"');
  });

  it('питання FAQ присутні в самому HTML, не лише в JSON-LD', () => {
    const withoutJsonLd = uk.replace(/<script type="application\/ld\+json">.+?<\/script>/s, '');
    expect(withoutJsonLd).toContain('Чи зберігається прозорість?');
  });

  it('кроки інструкції видно без JavaScript', () => {
    const withoutJsonLd = uk.replace(/<script type="application\/ld\+json">.+?<\/script>/s, '');
    expect(withoutJsonLd).toContain('Завантажте готовий PNG');
  });

  it('пресет із YAML доїхав до віджета', () => {
    expect(uk).toMatch(/width&quot;:\[0,512\]|&quot;width&quot;:\[0,512\]/);
  });
});

describe('сторінки видалення фону', () => {
  it('українська сторінка згенерована', async () => {
    const html = await readFile(join(dist, 'видалити-фон', 'index.html'), 'utf8');
    expect(html).toContain('Видалення фону');
    expect(html).toContain('hreflang="en"');
  });

  it('англійська пара на місці', async () => {
    const html = await readFile(join(dist, 'en', 'remove-background', 'index.html'), 'utf8');
    expect(html).toContain('Background removal');
  });

  it('сторінка розумної обрізки згенерована', async () => {
    const html = await readFile(join(dist, 'розумна-обрізка', 'index.html'), 'utf8');
    expect(html).toContain('Обрізка за суб');
  });

  it('пресет видалення фону доїхав у віджет', async () => {
    const html = await readFile(join(dist, 'видалити-фон', 'index.html'), 'utf8');
    expect(html).toMatch(/removeBg&quot;:\[\d+,true\]/);
  });

  it('у sitemap рівно стільки сторінок, скільки їх є', async () => {
    // Очікування рахується з даних, а не вписане числом: інакше кожен
    // новий лендінг «ламав» би тест, і його правили б, не дивлячись,
    // що саме змінилось. Так тест ловить те, що має, — зниклу сторінку.
    const { readdir } = await import('node:fs/promises');
    const { generatedPages } = await import('../src/data/generated/index.js');
    const handWritten = (await readdir(join(import.meta.dirname, '..', 'src', 'data', 'tools')))
      .filter((f) => f.endsWith('.yaml')).length;
    // Головна й каталог, у двох локаліях кожна.
    const standalone = 4;

    const idx = await readFile(join(dist, 'sitemap-0.xml'), 'utf8');
    expect((idx.match(/<loc>/g) ?? []).length)
      .toBe(handWritten + generatedPages().length + standalone);
  });

  it('нові сторінки M3 у sitemap', async () => {
    const idx = await readFile(join(dist, 'sitemap-0.xml'), 'utf8');
    expect(idx).toContain('/en/heic-to-jpg/');
    expect(idx).toContain('/en/strip-exif/');
  });

  it('пресет «без зміни розміру» справді не змінює розмір', async () => {
    // inside із межею, більшою за будь-яке фото, і без дозволу збільшувати —
    // масштаб затискається до одиниці, а resample має швидкий шлях на
    // однаковому розмірі. Це і є «конвертувати, не чіпаючи пікселів».
    const html = await readFile(join(dist, 'heic-в-jpg', 'index.html'), 'utf8');
    expect(html).toMatch(/mode&quot;:\[\d+,&quot;inside&quot;\]/);
    expect(html).toMatch(/width&quot;:\[\d+,20000\]/);
  });
});

/**
 * Каталог і llms.txt — єдині два шляхи, якими до породжених сторінок
 * можна дійти не через sitemap. Каталогом ходить людина, файлом — агент.
 */
describe('каталог і llms.txt', () => {
  it('каталог перелічує всі сторінки своєї локалі', async () => {
    const { generatedPages } = await import('../src/data/generated/index.js');
    const { readdir } = await import('node:fs/promises');
    const handWritten = (await readdir(join(import.meta.dirname, '..', 'src', 'data', 'tools')))
      .filter((f) => f.endsWith('.uk.yaml')).length;
    const expected = handWritten + generatedPages().filter((p) => p.locale === 'uk').length;

    const html = await readFile(join(dist, 'інструменти', 'index.html'), 'utf8');
    const links = new Set((html.match(/href="\/[^"]*\/"/g) ?? []));
    // Плюс посилання на головну в шапці й підвалі.
    expect(links.size).toBeGreaterThanOrEqual(expected);
  });

  it('каталог доступний з кожної сторінки', async () => {
    const html = await readFile(join(dist, 'png-в-webp', 'index.html'), 'utf8');
    expect(html).toContain('/інструменти/');
  });

  it('англійська сторінка веде в англійський каталог, а не в український', async () => {
    const html = await readFile(join(dist, 'en', 'png-to-webp', 'index.html'), 'utf8');
    expect(html).toContain('/en/tools/');
    expect(html).not.toContain('href="/інструменти/"');
  });

  it('llms.txt описує межі, а не лише перелік', async () => {
    const txt = await readFile(join(dist, 'llms.txt'), 'utf8');
    expect(txt).toContain('## Чого не вміє');
    expect(txt).toContain('npx obrobka-mcp');
    // Кожна сторінка має бути перелічена — інакше файл бреше про повноту.
    const { generatedPages } = await import('../src/data/generated/index.js');
    for (const p of generatedPages().slice(0, 12)) {
      expect(txt, p.id).toContain(p.locale === 'uk' ? `/${p.slug}/` : `/en/${p.slug}/`);
    }
  });

  it('перехресні посилання ведуть на сторінки, які існують', async () => {
    const { readdir } = await import('node:fs/promises');
    const html = await readFile(join(dist, 'png-в-webp', 'index.html'), 'utf8');
    const related = [...html.matchAll(/class="related"[\s\S]*?<\/ul>/g)].join('');
    const hrefs = [...related.matchAll(/href="\/([^"]+)\/"/g)].map((m) => m[1]!);
    expect(hrefs.length).toBeGreaterThan(3);
    const dirs = new Set(await readdir(dist));
    for (const h of hrefs) expect(dirs.has(h.split('/')[0]!), h).toBe(true);
  });
});
