import { describe, expect, it } from 'vitest';
import { generatedPages } from '../src/data/generated/index.js';
import { FORMATS, SOURCES, TARGETS, losesAlpha, relativeToJpeg } from '../src/data/formats.js';

const pages = generatedPages();
const uk = pages.filter((p) => p.locale === 'uk');
const en = pages.filter((p) => p.locale === 'en');

describe('матриця сторінок', () => {
  it('кожна сторінка має пару в іншій локалі', () => {
    const ids = new Set(pages.map((p) => p.id));
    const orphans = pages.filter((p) => !ids.has(p.pair)).map((p) => p.id);
    expect(orphans).toEqual([]);
  });

  it('локалі рівні за кількістю', () => {
    expect(uk).toHaveLength(en.length);
  });

  it('слаги унікальні в межах локалі', () => {
    for (const set of [uk, en]) {
      const slugs = set.map((p) => p.slug);
      expect(new Set(slugs).size, `дублікати: ${slugs.filter((s, i) => slugs.indexOf(s) !== i)}`)
        .toBe(slugs.length);
    }
  });

  it('слаги придатні для URL', () => {
    // Кирилиця дозволена — українські адреси її й використовують.
    // Заборонені пробіли, крапки та все, що доведеться екранувати.
    for (const p of pages) {
      expect(p.slug, p.id).toMatch(/^[\p{L}\p{N}-]+$/u);
    }
  });

  it('українські слаги кириличні, англійські — латинські', () => {
    // Кілька термінів в українській так і живуть латиницею: «OG-image»,
    // «favicon», назви форматів. Перекладати їх у слаг означало б робити
    // адресу, якої ніхто не шукає.
    const LATIN_OK = new Set(['og-image']);
    for (const p of uk) {
      if (LATIN_OK.has(p.slug)) continue;
      expect(p.slug, p.id).toMatch(/[а-яіїєґ]/i);
    }
    for (const p of en) expect(p.slug, p.id).toMatch(/^[a-z0-9-]+$/);
  });

  it('усі обов’язкові поля заповнені', () => {
    for (const p of pages) {
      for (const key of ['title', 'description', 'intro'] as const) {
        expect(p[key].trim().length, `${p.id}.${key}`).toBeGreaterThan(20);
      }
      // «PNG у JPEG» — це десять символів, і цього цілком досить.
      expect(p.h1.trim().length, `${p.id}.h1`).toBeGreaterThan(5);
      expect(p.steps.length, `${p.id}.steps`).toBeGreaterThanOrEqual(2);
      expect(p.faq.length, `${p.id}.faq`).toBeGreaterThanOrEqual(3);
    }
  });

  it('заголовки вкладаються в те, що показує пошук', () => {
    // Понад ~70 символів Google обрізає — краще знати про це тут.
    for (const p of pages) expect(p.title.length, `${p.id}: ${p.title}`).toBeLessThanOrEqual(95);
    for (const p of pages) expect(p.description.length, p.id).toBeLessThanOrEqual(200);
  });

  it('жодна пара сторінок не має однакового заголовка', () => {
    // Однакові title у двох URL — це той самий дубльований контент,
    // за який пошуковики й не люблять породжені сторінки.
    for (const set of [uk, en]) {
      const titles = set.map((p) => p.title);
      const dupes = titles.filter((t, i) => titles.indexOf(t) !== i);
      expect(dupes).toEqual([]);
    }
  });

  it('вступи різні — інакше це один текст під різними адресами', () => {
    for (const set of [uk, en]) {
      const intros = set.map((p) => p.intro);
      const dupes = intros.filter((t, i) => intros.indexOf(t) !== i);
      expect(dupes.length, `${dupes.length} повторів`).toBe(0);
    }
  });

  it('мова не тече між локалями', () => {
    for (const p of en) {
      expect(`${p.title} ${p.description} ${p.h1} ${p.intro} ${p.steps.join(' ')}`, p.id)
        .not.toMatch(/[а-яіїєґ]/i);
    }
  });
});

describe('пари форматів', () => {
  const pairs = uk.filter((p) => p.id.includes('-to-'));

  it('покривають усі підтримувані переходи, крім написаних руками', () => {
    const expected: string[] = [];
    for (const from of SOURCES) {
      for (const to of TARGETS) {
        if ((from as string) === (to as string)) continue;
        expected.push(`${from}-to-${to}`);
      }
    }
    const got = pairs.map((p) => p.id.replace(/\.uk$/, ''));
    // heic→jpeg написано руками, тож матриця його не породжує.
    expect(new Set(got)).toEqual(new Set(expected.filter((id) => id !== 'heic-to-jpeg')));
  });

  it('перехід у JPEG попереджає про втрату прозорості', () => {
    for (const p of pairs) {
      const [from, , to] = p.id.replace(/\.uk$/, '').split('-');
      if (!losesAlpha(from as never, to as never)) continue;
      const text = `${p.intro} ${p.faq.map((f) => f.a).join(' ')}`;
      expect(text, p.id).toMatch(/прозор/i);
    }
  });

  it('несе виміряні числа, а не загальні слова', () => {
    for (const p of pairs) {
      const to = p.id.replace(/\.uk$/, '').split('-')[2]!;
      const kb = FORMATS[to as never as keyof typeof FORMATS].photoKb;
      expect(`${p.intro} ${p.faq.map((f) => f.a).join(' ')}`, p.id).toContain(String(kb));
    }
  });

  it('не породжує сторінку формату сам у себе', () => {
    for (const p of pairs) {
      const parts = p.id.replace(/\.uk$/, '').split('-');
      expect(parts[0], p.id).not.toBe(parts[2]);
    }
  });
});

describe('виміряні дані форматів', () => {
  it('порядок ваги збігається з виміряним', () => {
    // AVIF < WebP < JPEG < PNG на фотографії. Якщо колись стане не так,
    // це означає, що змінився кодек, і тексти сторінок брешуть.
    expect(FORMATS.avif.photoKb).toBeLessThan(FORMATS.webp.photoKb);
    expect(FORMATS.webp.photoKb).toBeLessThan(FORMATS.jpeg.photoKb);
    expect(FORMATS.jpeg.photoKb).toBeLessThan(FORMATS.png.photoKb);
  });

  it('відсотки від JPEG рахуються з тих самих чисел', () => {
    expect(relativeToJpeg('webp', 'photo')).toBe(75);
    expect(relativeToJpeg('avif', 'photo')).toBe(40);
    expect(relativeToJpeg('png', 'photo')).toBe(1318);
  });

  it('альфу мають усі, крім JPEG і HEIC', () => {
    expect(FORMATS.jpeg.alpha).toBe(false);
    expect(FORMATS.png.alpha).toBe(true);
    expect(FORMATS.webp.alpha).toBe(true);
    expect(FORMATS.avif.alpha).toBe(true);
  });
});
