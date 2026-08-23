import { describe, it, expect } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { DICTS } from '../src/lib/i18n.js';

const CYRILLIC = /[А-Яа-яЇїІіЄєҐґ]/;

describe('словник', () => {
  it('українська й англійська мають однакові ключі', () => {
    const keys = (o: object): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        v !== null && typeof v === 'object' ? keys(v).map((s) => `${k}.${s}`) : [k]);
    expect(keys(DICTS.en).sort()).toEqual(keys(DICTS.uk).sort());
  });

  it('англійський словник не містить кирилиці', () => {
    const walk = (o: unknown, path = ''): string[] => {
      if (typeof o === 'string') return CYRILLIC.test(o) ? [`${path}: ${o}`] : [];
      if (o !== null && typeof o === 'object') {
        return Object.entries(o).flatMap(([k, v]) => walk(v, path ? `${path}.${k}` : k));
      }
      return [];
    };
    expect(walk(DICTS.en)).toEqual([]);
  });
});

describe('компоненти', () => {
  /**
   * Ловить регресію, від якої вже постраждала англійська сторінка: рядок,
   * вписаний просто в розмітку, повз словник.
   */
  it('у Svelte-компонентах немає вшитої кирилиці', async () => {
    const dir = join(import.meta.dirname, '..', 'src', 'components');
    const offenders: string[] = [];
    for (const f of await readdir(dir)) {
      if (!f.endsWith('.svelte')) continue;
      const src = await readFile(join(dir, f), 'utf8');
      // Коментарі українською — це нормально, вони не потрапляють в UI.
      // Багаторядкові коментарі гасимо цілком, зберігаючи переноси, щоб
      // номери рядків у звіті лишились правдивими. Блоки /* */ теж
      // бувають на кілька рядків — у <style> це звичайна річ, і поки їх
      // гасив лише посрядковий прохід нижче, чесний коментар до CSS
      // потрапляв у порушники.
      const blank = (block: string): string =>
        '\n'.repeat((block.match(/\n/g) ?? []).length);
      const masked = src
        .replace(/<!--[\s\S]*?-->/g, blank)
        .replace(/\/\*[\s\S]*?\*\//g, blank);
      masked.split('\n').forEach((line, i) => {
        const withoutComments = line.replace(/\/\/.*$/, '');
        if (!CYRILLIC.test(withoutComments)) return;
        if (/^\s*(\*|\/\/)/.test(line)) return;
        offenders.push(`${f}:${i + 1}  ${line.trim().slice(0, 70)}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});

describe('англійська сторінка', () => {
  it('віджет віддає англійський текст', async () => {
    const html = await readFile(
      join(import.meta.dirname, '..', 'dist', 'en', 'index.html'), 'utf8');
    expect(html).toContain('locale');
    // Український заголовок пресета не має з'являтись на англійській сторінці
    expect(html).not.toContain('Стікер Telegram');
  });
});
