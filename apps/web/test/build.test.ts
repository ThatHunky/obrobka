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

  /**
   * Увесь CSS збірки — і файлами, і вбудований у HTML.
   *
   * Astro вбудовує малі таблиці стилів просто в сторінку, тож перевіряти
   * лише `_astro/*.css` означає вважати такі компоненти неоформленими.
   */
  async function builtCss(): Promise<string> {
    const { readdir } = await import('node:fs/promises');
    const dir = join(dist, '_astro');
    const files = (await readdir(dir)).filter((f) => f.endsWith('.css'));
    const parts = await Promise.all(files.map((f) => readFile(join(dir, f), 'utf8')));

    for (const page of ['index.html', join('en', 'storage', 'index.html'),
      join('en', 'tools', 'index.html'), join('en', 'png-to-webp', 'index.html')]) {
      const html = await readFile(join(dist, page), 'utf8');
      for (const m of html.matchAll(/<style>([\s\S]*?)<\/style>/g)) parts.push(m[1]!);
    }
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
      // Кожен клас, а не будь-який: `.name`, `.size` і `.error` трапляються
      // одразу в кількох компонентів, тож `some` проходив навіть тоді, коли
      // від самого компонента у збірці не лишилось нічого.
      const absent = classes.filter((c) => !css.includes(`.${c}`));
      if (absent.length > 0) missing.push(`${name} (${absent.join(', ')})`);
    }
    expect(missing, 'стилі цих компонентів не дійшли до збірки').toEqual([]);
  }, 30_000);

  it('панель EXIF має стилі — саме вона й ламалась', async () => {
    const css = await builtCss();
    expect(css).toContain('.exif');
    expect(css).toContain('.gps');
  });
});

/**
 * Сторінка «Збережене» лише читає й чистить Cache Storage.
 *
 * Через головний вхід @obrobka/onnx-web вона тягла за собою весь рантайм
 * ONNX: 37,7 КБ, із яких Lighthouse нарахував 94 % невиконаного. Після
 * переходу на підшлях /cache лишилось 3,4 КБ. Один необережний імпорт
 * поверне все назад, і помітити це можна буде хіба випадково.
 */
describe('вага острівців', () => {
  async function islandBytes(prefix: string): Promise<number> {
    const { readdir, stat } = await import('node:fs/promises');
    const dir = join(dist, '_astro');
    const file = (await readdir(dir)).find((f) => f.startsWith(prefix) && f.endsWith('.js'));
    expect(file, `не знайдено чанк ${prefix}*`).toBeDefined();
    return (await stat(join(dir, file!))).size;
  }

  it('панель збереженого не тягне рантайм ONNX', async () => {
    expect(await islandBytes('Storage.')).toBeLessThan(8 * 1024);
  });

  it('віджет лишається єдиним важким острівцем', async () => {
    // Йому рантайм справді потрібен — тут перевірка лише на те,
    // що ми не роздули його ще й чимось стороннім.
    expect(await islandBytes('Widget.')).toBeLessThan(120 * 1024);
  });
});
