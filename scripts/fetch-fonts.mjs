#!/usr/bin/env node
/**
 * Забирає шрифти з Google і кладе поруч зі статикою.
 *
 * Навіщо своя копія. Виміряно на продакшені: запит до fonts.googleapis.com
 * коштував 375 мс на 2 КБ CSS — це майже цілком DNS і TLS до чужого хосту,
 * і він блокує показ. Далі йшов другий чужий хост, fonts.gstatic.com,
 * із власним рукостисканням. Наші власні файли з того самого з'єднання
 * приходили за 14–16 мс.
 *
 * Друга причина простіша. Сайт обіцяє, що файл не залишає пристрій, —
 * і при цьому браузер кожного відвідувача стукав у Google.
 *
 * Скрипт іде за тим самим CSS, що й браузер (потрібен сучасний User-Agent,
 * інакше Google віддасть ttf замість woff2), забирає всі підмножини разом
 * із їхніми unicode-range і переписує посилання на локальні.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = new URL('../apps/web/public/fonts/', import.meta.url).pathname;
const CSS_OUT = new URL('../apps/web/src/styles/fonts.css', import.meta.url).pathname;
const TS_OUT = new URL('../apps/web/src/lib/fonts.ts', import.meta.url).pathname;

/**
 * Вага 500 в Inter не бралася: жодного font-weight: 500 у стилях немає,
 * а це ще дві підмножини на кожен алфавіт.
 */
const FAMILIES = [
  'Unbounded:wght@600;700',
  'Inter:wght@400;600;700',
  'JetBrains+Mono:wght@400;600',
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const url = `https://fonts.googleapis.com/css2?${FAMILIES.map((f) => `family=${f}`).join('&')}&display=swap`;

/**
 * Підмножини, які цьому сайту потрібні.
 *
 * Google віддає сім: разом це 489 КБ на диску. Українській вистачає
 * `cyrillic` — і, ї, є та ґ усі лежать у U+0400-045F і U+0490-0491.
 * `cyrillic-ext` додає переважно церковнослов'янщину й знак гривні,
 * якого в текстах немає. Грецька та в'єтнамська не потрібні поготів.
 * `latin-ext` лишаємо: у нього потрапляють діакритики запозичених слів
 * і назв, а коштує він небагато.
 */
const SUBSETS = new Set(['latin', 'latin-ext', 'cyrillic']);

/** Викидає блоки @font-face непотрібних підмножин разом із їхніми коментарями. */
function keepSubsets(source) {
  const blocks = source.split(/(?=\/\* [a-z-]+ \*\/)/);
  return blocks.filter((b) => {
    const m = /^\/\* ([a-z-]+) \*\//.exec(b.trim());
    return m === null || SUBSETS.has(m[1]);
  }).join('');
}

const res = await fetch(url, { headers: { 'user-agent': UA } });
if (!res.ok) throw new Error(`Google віддав HTTP ${res.status}`);
let css = await res.text();

if (!css.includes('.woff2')) {
  throw new Error('У відповіді немає woff2 — схоже, User-Agent не підійшов');
}
css = keepSubsets(css);

await mkdir(OUT, { recursive: true });

const seen = new Map();
const urls = [...new Set([...css.matchAll(/https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2/g)].map((m) => m[0]))];

let total = 0;
for (const remote of urls) {
  // Останній сегмент шляху вже унікальний — саме він і розрізняє
  // підмножини. Обрізати його не можна: у файлів однієї родини
  // збігається довгий початок, і перші дванадцять символів однакові.
  const parts = remote.split('/');
  const name = `${parts.at(-3)}-${parts.at(-2)}-${parts.at(-1)}`;
  const bytes = new Uint8Array(await (await fetch(remote, { headers: { 'user-agent': UA } })).arrayBuffer());
  await writeFile(join(OUT, name), bytes);
  seen.set(remote, `/fonts/${name}`);
  total += bytes.length;
  console.log(`  ${String(Math.round(bytes.length / 1024)).padStart(4)} КБ  ${name}`);
}

for (const [remote, local] of seen) css = css.split(remote).join(local);

const header = `/*
 * Згенеровано scripts/fetch-fonts.mjs — правити тут немає сенсу.
 *
 * Шрифти лежать у public/fonts і віддаються з того самого з'єднання,
 * що й решта сайту. Раніше вони приходили з двох сторонніх хостів,
 * і саме рукостискання з ними коштувало 375 мс перед показом.
 */
`;
await writeFile(CSS_OUT, header + css);

/*
 * Список для preload генеруємо тут-таки.
 *
 * Імена файлів містять хеш Google і змінюються при кожному оновленні
 * шрифтів. Вписані руками в шаблон, вони тихо вказували б у нікуди —
 * preload на неіснуючий файл браузер не показує як помилку.
 */
const preload = [];
for (const block of css.split(/(?=\/\* [a-z-]+ \*\/)/).slice(1)) {
  const subset = /^\/\* ([a-z-]+) \*\//.exec(block.trim())?.[1];
  const family = /font-family: '([^']+)'/.exec(block)?.[1];
  const file = /\/fonts\/([^')]+)/.exec(block)?.[1];
  if (family !== 'Inter' || file === undefined) continue;
  if (subset !== 'latin' && subset !== 'cyrillic') continue;
  const href = `/fonts/${file}`;
  if (!preload.includes(href)) preload.push(href);
}

await writeFile(TS_OUT, `/*
 * Згенеровано scripts/fetch-fonts.mjs — правити тут немає сенсу.
 */

/**
 * Шрифти, які підвантажуються наперед.
 *
 * Лише Inter і лише дві підмножини — латиниця й кирилиця. Це основний
 * текст, від якого залежить перший показ. Заголовковий Unbounded важчий
 * і потрібен для кількох рядків, тож він іде звичайним шляхом зі swap:
 * підвантажувати наперед усе означало б змагатися самому із собою
 * за смугу.
 */
export const FONT_PRELOAD: readonly string[] = ${JSON.stringify(preload, null, 2)};
`);

console.log(`\n${urls.length} файлів, ${Math.round(total / 1024)} КБ разом`);
console.log(`preload: ${preload.length}`);
