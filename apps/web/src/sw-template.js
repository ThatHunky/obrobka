/* eslint-disable no-restricted-globals */
/**
 * Сервісворкер.
 *
 * Написаний руками, а не згенерований плагіном, з двох причин. Перша:
 * тут є що вирішувати, і рішення неочевидні — 24 МБ рантайму ONNX не
 * можна класти в precache, інакше перший же візит з'їсть у людини
 * чверть гігабайта заради моделі, яку вона, можливо, не відкриє.
 * Друга: моделі вже мають власний кеш у Cache Storage, і сервісворкер
 * не повинен його дублювати.
 *
 * Версія підставляється збіркою — scripts/build-sw.mjs. Вона рахується
 * з імен зібраних файлів, тож змінюється рівно тоді, коли змінюється
 * щось із того, що ми кешуємо.
 */
const VERSION = '__VERSION__';
const SHELL = `obrobka-shell-${VERSION}`;
const ASSETS = `obrobka-assets-${VERSION}`;

/**
 * Оболонка, яку кладемо наперед.
 *
 * Лише навігаційні адреси, і лише ті, з яких людина справді починає.
 * Класти сюди всі вісімдесят сім сторінок означало б качати їх усі
 * при першому візиті — заради сторінок, на які ніхто не піде.
 */
const PRECACHE = ['/', '/en/', '/інструменти/', '/en/tools/', '/site.webmanifest'];

/** Чужі кеші не чіпаємо: моделі живуть у власному, з власним життєвим циклом. */
const OURS = /^obrobka-(shell|assets)-/;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // Кожна адреса окремо: одна недоступна сторінка не має валити встановлення.
    await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (OURS.test(name) && name !== SHELL && name !== ASSETS) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

/** Файли з хешем в імені — незмінні, тож віддаємо з кеша не питаючи мережу. */
function isImmutable(url) {
  return url.pathname.startsWith('/_astro/') || url.pathname.startsWith('/fonts/');
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  if (hit !== undefined) return hit;

  const res = await fetch(request);
  // Кладемо лише вдалі повні відповіді: 206 і помилки в кеші отруйні.
  if (res.ok && res.status === 200) await cache.put(request, res.clone());
  return res;
}

/**
 * Навігація — мережа перша.
 *
 * Кеш тут лише запасний вихід: сторінки статичні, але їх вісімдесят сім,
 * і показати вчорашню версію замість свіжої немає жодної причини, поки
 * мережа є.
 */
async function navigate(request) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(request);
    if (res.ok) await cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request) ?? await cache.match('/');
    if (hit !== undefined) return hit;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Чуже походження не чіпаємо взагалі. Моделі лежать на окремому
  // піддомені й мають власний кеш; лічильник узагалі не має кешуватись.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigate(request));
    return;
  }
  if (isImmutable(url)) {
    event.respondWith(cacheFirst(request));
  }
});
