#!/usr/bin/env node
/**
 * Складає сервісворкер після збірки сайту.
 *
 * Версія рахується з імен зібраних файлів. Це важливіше, ніж здається:
 * якщо взяти час збірки, кеш скидатиметься при кожному деплої, навіть
 * коли нічого не змінилось; якщо взяти константу — не скинеться ніколи,
 * і люди сидітимуть на старій оболонці, доки не почистять браузер.
 *
 * Запускається як частина `astro build`, тож окремо про нього
 * пам'ятати не треба.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIST = new URL('../apps/web/dist/', import.meta.url).pathname;
const TEMPLATE = new URL('../apps/web/src/sw-template.js', import.meta.url).pathname;

/** Імена всього, що сервісворкер може віддати з кеша. */
async function cacheableNames() {
  const names = [];
  for (const dir of ['_astro', 'fonts']) {
    try {
      names.push(...(await readdir(join(DIST, dir))).map((f) => `${dir}/${f}`));
    } catch {
      // Теки може не бути — це не привід валити збірку.
    }
  }
  return names.sort();
}

const names = await cacheableNames();
if (names.length === 0) {
  throw new Error('У dist немає ані _astro, ані fonts — схоже, збірка не відбулась');
}

const version = createHash('sha256').update(names.join('\n')).digest('hex').slice(0, 12);
const template = await readFile(TEMPLATE, 'utf8');
await writeFile(join(DIST, 'sw.js'), template.replace('__VERSION__', version));

console.log(`sw.js: версія ${version} з ${names.length} файлів`);
