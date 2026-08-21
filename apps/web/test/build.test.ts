import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const dist = join(import.meta.dirname, '..', 'dist');
let uk = '';
let en = '';
let headers = '';

beforeAll(async () => {
  uk = await readFile(join(dist, 'index.html'), 'utf8');
  en = await readFile(join(dist, 'en', 'index.html'), 'utf8');
  headers = await readFile(join(dist, '_headers'), 'utf8');
}, 60_000);

describe('збірка сайту', () => {
  it('українська сторінка в корені', () => {
    expect(uk).toContain('lang="uk"');
  });

  it('англійська сторінка під /en/', () => {
    expect(en).toContain('lang="en"');
  });

  it('українська посилається на англійську через hreflang', () => {
    expect(uk).toContain('hreflang="en"');
    expect(uk).toContain('/en/');
  });

  it('x-default вказує на українську', () => {
    expect(uk).toMatch(/hreflang="x-default"[^>]*href="[^"]*obrobka\.dobrovolskyi\.com\.ua\/"/);
  });

  it('заголовки COEP на місці', () => {
    expect(headers).toContain('Cross-Origin-Embedder-Policy: credentialless');
  });
});

/**
 * Стилі кожного компонента мусять дійти до збірки.
 *
 * Мовчазна поразка, яку цей тест ловить: панель EXIF рендерилась голим
 * HTML, бо її CSS-модуль не потрапив у чанк. Компонент був у JS, клас
 * svelte-* стояв у розмітці, збірка минала без жодного попередження —
 * і так поїхало в продакшн. Причина виявилась позиційною: усередині
 * {#if} у глибині шаблону CSS губився, на верхньому рівні — ні.
 *
 * Правило простіше за причину: якщо в компонента є <style>, у зібраному
 * CSS має бути хоч один його селектор.
 */
describe('стилі компонентів у збірці', () => {
  const componentsDir = join(import.meta.dirname, '..', 'src', 'components');

  async function builtCss(): Promise<string> {
    const { readdir } = await import('node:fs/promises');
    const dir = join(dist, '_astro');
    const files = (await readdir(dir)).filter((f) => f.endsWith('.css'));
    const parts = await Promise.all(files.map((f) => readFile(join(dir, f), 'utf8')));
    return parts.join('\n');
  }

  /** Класи, оголошені у <style> компонента. */
  function declaredClasses(source: string): string[] {
    const style = /<style>([\s\S]*?)<\/style>/.exec(source);
    if (style === null) return [];
    const withoutComments = style[1]!.replace(/\/\*[\s\S]*?\*\//g, '');
    const classes = new Set<string>();
    for (const m of withoutComments.matchAll(/\.([a-zA-Z][\w-]*)/g)) classes.add(m[1]!);
    return [...classes];
  }

  it('кожен компонент зі стилями має їх у зібраному CSS', async () => {
    const { readdir } = await import('node:fs/promises');
    const css = await builtCss();
    const names = (await readdir(componentsDir)).filter((f) => f.endsWith('.svelte'));
    expect(names.length).toBeGreaterThan(3);

    const missing: string[] = [];
    for (const name of names) {
      const source = await readFile(join(componentsDir, name), 'utf8');
      const classes = declaredClasses(source);
      if (classes.length === 0) continue;
      if (!classes.some((c) => css.includes(`.${c}`))) missing.push(name);
    }
    expect(missing, 'стилі цих компонентів не дійшли до збірки').toEqual([]);
  }, 30_000);

  it('панель EXIF має стилі — саме вона й ламалась', async () => {
    const css = await builtCss();
    expect(css).toContain('.exif');
    expect(css).toContain('.gps');
  });
});
