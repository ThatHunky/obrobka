import { test, expect } from '@playwright/test';

test('шрифти завантажились попри COEP', async ({ page }) => {
  const failed: string[] = [];
  page.on('requestfailed', (r) => {
    if (r.url().includes('.woff')) failed.push(`${r.url()} :: ${r.failure()?.errorText}`);
  });
  await page.goto('/', { waitUntil: 'networkidle' });

  const info = await page.evaluate(async () => {
    await document.fonts.ready;
    const h1 = document.querySelector('h1');
    return {
      isolated: globalThis.crossOriginIsolated,
      loaded: document.fonts.size,
      unbounded: document.fonts.check('700 2rem Unbounded'),
      inter: document.fonts.check('400 1rem Inter'),
      h1Family: h1 ? getComputedStyle(h1).fontFamily.split(',')[0] : null,
    };
  });
  expect(info.isolated).toBe(true);
  expect(info.unbounded).toBe(true);
  expect(info.inter).toBe(true);
  expect(failed).toEqual([]);
});

/**
 * Шрифти переїхали з Google до нас, і це варто тримати перевіркою.
 *
 * Причина була виміряна: запит по CSS до fonts.googleapis.com коштував
 * 375 мс на два кілобайти — рукостискання з чужим хостом перед показом.
 * Але легко не помітити, як третій сторонній запит повернеться назад
 * разом із чиїмось «просто додам ще один шрифт».
 */
test('жоден запит не йде на сторонній хост', async ({ page, baseURL }) => {
  // Своє походження треба знати заздалегідь: у момент першого запиту
  // page.url() ще about:blank, і порівнювати нема з чим.
  const own = new URL(baseURL ?? 'http://localhost').host;
  const foreign = new Set<string>();
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.protocol === 'data:' || url.protocol === 'blob:') return;
    if (url.host !== own) foreign.add(url.origin);
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  // Моделі живуть на власному піддомені й качаються лише за потреби —
  // на порожній сторінці їх бути не має.
  expect([...foreign]).toEqual([]);
});

test('шрифти віддаються з нашого походження й кешуються назавжди', async ({ page }) => {
  const fonts: { url: string; cache: string | undefined }[] = [];
  page.on('response', (r) => {
    if (!r.url().includes('.woff2')) return;
    fonts.push({ url: r.url(), cache: r.headers()['cache-control'] });
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  expect(fonts.length).toBeGreaterThan(0);
  for (const f of fonts) {
    expect(f.url, 'шрифт має приходити з нашого хосту').toContain('/fonts/');
    // Ім'я файлу містить хеш вмісту від Google, тож immutable безпечний.
    expect(f.cache ?? '', f.url).toContain('immutable');
  }
});

test('підвантажений наперед шрифт справді існує', async ({ page }) => {
  await page.goto('/');
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('link[rel=preload][as=font]')]
      .map((l) => (l as HTMLLinkElement).getAttribute('href') ?? ''));

  // Імена містять хеш і змінюються при оновленні шрифтів. Preload на
  // неіснуючий файл браузер не показує як помилку — він просто марний.
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    const res = await page.request.get(href);
    expect(res.status(), href).toBe(200);
  }
});
