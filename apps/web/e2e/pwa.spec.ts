import { test, expect, type Page } from '@playwright/test';

/**
 * Офлайн і збережене.
 *
 * Сервісворкер — найтихіша частина сайту: коли він ламається, нічого
 * не падає, просто офлайн перестає працювати, і дізнатись про це можна
 * лише в літаку. Тому перевірки тут прямі: зареєструвався, закешував,
 * віддав без мережі.
 */

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(
    () => navigator.serviceWorker.controller !== null
      || navigator.serviceWorker.ready.then(() => true),
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(() => navigator.serviceWorker.ready);
}

test('сервісворкер реєструється й активується', async ({ page }) => {
  await ready(page);
  const state = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active?.state ?? 'немає';
  });
  expect(state).toBe('activated');
});

test('оболонка потрапляє в кеш', async ({ page }) => {
  await ready(page);
  const names = await page.evaluate(() => caches.keys());
  expect(names.some((n) => n.startsWith('obrobka-shell-')), names.join(', ')).toBe(true);

  const cachedRoot = await page.evaluate(async () => {
    const key = (await caches.keys()).find((n) => n.startsWith('obrobka-shell-'));
    if (key === undefined) return false;
    const cache = await caches.open(key);
    return (await cache.match('/')) !== undefined;
  });
  expect(cachedRoot).toBe(true);
});

test('сторінка відкривається без мережі', async ({ page, context }) => {
  await ready(page);
  // Перезавантаження під контролем воркера — тепер він бачить запити.
  await page.reload();
  await page.evaluate(() => navigator.serviceWorker.ready);

  await context.setOffline(true);
  try {
    // Спершу доводимо, що мережі справді немає — інакше тест проходив би
    // й тоді, коли setOffline не спрацював. Запит мусить іти зі сторінки:
    // page.request живе поза браузером і режиму офлайну не помічає.
    const unreachable = await page.evaluate(
      () => fetch('/api/stats').then(() => 'відповіло').catch(() => 'не відповіло'),
    );
    expect(unreachable, 'мережа мала бути вимкнена').toBe('не відповіло');

    await page.reload();
    await expect(page.locator('h1')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-testid="pick"]')).toBeAttached();
  } finally {
    await context.setOffline(false);
  }
});

test('сервісворкер не ламає ізоляцію походжень', async ({ page }) => {
  await ready(page);
  await page.reload();
  expect(await page.evaluate(() => globalThis.crossOriginIsolated)).toBe(true);
});

test('версія кеша змінюється разом зі складом збірки', async ({ page }) => {
  await page.goto('/sw.js');
  const body = await page.evaluate(() => document.body.textContent ?? '');
  // Заглушка з шаблону не має доїжджати до продакшену.
  expect(body).not.toContain('__VERSION__');
  expect(body).toMatch(/obrobka-shell-\$\{VERSION\}|const VERSION = '[0-9a-f]{12}'/);
});

test('сторінка збереженого показує стан кеша', async ({ page }) => {
  await page.goto('/збережене/');
  await expect(page.getByTestId('storage')).toBeVisible({ timeout: 30_000 });
  // Моделей ще немає — має бути чесне «порожньо», а не порожня сторінка.
  await expect(page.getByTestId('storage-empty')).toBeVisible();
});

test('сторінка збереженого існує в обох локалях', async ({ page }) => {
  await page.goto('/en/storage/');
  await expect(page.getByTestId('storage')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('h1')).toContainText('Stored data');
});

test('на збережене можна дійти з будь-якої сторінки', async ({ page }) => {
  await page.goto('/png-в-webp/');
  await expect(page.locator('a[href="/збережене/"]')).toHaveCount(1);
});
