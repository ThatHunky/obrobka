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

  it('sitemap містить усі десять сторінок', async () => {
    const idx = await readFile(join(dist, 'sitemap-0.xml'), 'utf8');
    expect((idx.match(/<loc>/g) ?? []).length).toBe(10);
  });
});
