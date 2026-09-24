import { test, expect, type Page } from '@playwright/test';
import { join } from 'node:path';
import { plainJpeg } from './fixtures.js';

const SPHERE = join(import.meta.dirname, 'sphere.png');

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('input[type=file][data-ready="true"]')).toBeAttached({ timeout: 60_000 });
  await page.setInputFiles('[data-testid="pick"]', SPHERE);
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 60_000 });
}

/** Альфа в центрі результату. */
const centreAlpha = (page: Page) => page.getByTestId('result').evaluate(async (el) => {
  const img = el as HTMLImageElement;
  try { await img.decode(); } catch { return -1; }
  const c = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(
    Math.floor(img.naturalWidth / 2), Math.floor(img.naturalHeight / 2), 1, 1,
  ).data[3]!;
});

/** Мазок навколо точки (fx, fy) — частки сцени; типово центр. */
async function scribble(page: Page, fx = 0.5, fy = 0.5): Promise<void> {
  const stage = page.getByTestId('stage');
  await stage.scrollIntoViewIfNeeded();
  const b = (await stage.boundingBox())!;
  const cx = b.x + b.width * fx;
  const cy = b.y + b.height * fy;
  await page.mouse.move(cx - 40, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 40, cy, { steps: 10 });
  await page.mouse.move(cx + 40, cy + 20, { steps: 4 });
  await page.mouse.up();
}

test('мазок робить пікселі прозорими', async ({ page }) => {
  await ready(page);
  expect(await centreAlpha(page)).toBe(255);

  await page.getByTestId('brush-toggle').click();
  await expect(page.getByTestId('brush-canvas-erase')).toBeVisible();
  await scribble(page);

  await expect.poll(() => centreAlpha(page), { timeout: 60_000 }).toBe(0);
  await expect(page.locator('.error')).toHaveCount(0);
});

test('очищення повертає непрозорість', async ({ page }) => {
  await ready(page);
  await page.getByTestId('brush-toggle').click();
  await scribble(page);
  await expect.poll(() => centreAlpha(page), { timeout: 60_000 }).toBe(0);

  await page.getByTestId('brush-clear').click();
  await expect.poll(() => centreAlpha(page), { timeout: 60_000 }).toBe(255);
});

test('«повернути» знімає стирання на тому самому місці', async ({ page }) => {
  await ready(page);
  await page.getByTestId('brush-toggle').click();
  await scribble(page);
  await expect.poll(() => centreAlpha(page), { timeout: 60_000 }).toBe(0);

  await page.getByTestId('brush-restore').click();
  await scribble(page);
  await expect.poll(() => centreAlpha(page), { timeout: 60_000 }).toBe(255);
});

/** Та сама дисципліна, що й у тягненні кадру: у воркер летить жест, не кадр. */
test('мазок не перезапускає обробку щокадру', async ({ page }) => {
  await ready(page);
  await page.getByTestId('brush-toggle').click();
  await page.waitForTimeout(400);

  await page.evaluate(() => {
    const w = window as unknown as { __runs: number };
    w.__runs = 0;
    new MutationObserver(() => { w.__runs++; })
      .observe(document.querySelector('[data-testid="result"]')!,
        { attributes: true, attributeFilter: ['src'] });
  });

  await scribble(page);
  await page.waitForTimeout(1500);
  const runs = await page.evaluate(() => (window as unknown as { __runs: number }).__runs);
  expect(runs).toBeGreaterThan(0);
  expect(runs).toBeLessThanOrEqual(2);
});

test('стерти повернуте можна знову', async ({ page }) => {
  await ready(page);
  await page.getByTestId('brush-toggle').click();
  await scribble(page);
  await expect.poll(() => centreAlpha(page), { timeout: 60_000 }).toBe(0);

  await page.getByTestId('brush-restore').click();
  await scribble(page);
  await expect.poll(() => centreAlpha(page), { timeout: 60_000 }).toBe(255);

  await page.getByTestId('brush-erase').click();
  await scribble(page);
  await expect.poll(() => centreAlpha(page), { timeout: 60_000 }).toBe(0);
});

test('вимкнений і знову ввімкнений пензель не губить мазків', async ({ page }) => {
  await ready(page);
  await page.getByTestId('brush-toggle').click();
  await scribble(page);
  await expect.poll(() => centreAlpha(page), { timeout: 60_000 }).toBe(0);

  await page.getByTestId('brush-toggle').click();
  await page.getByTestId('brush-toggle').click();
  // Новий мазок деінде — старий у центрі має лишитись
  await scribble(page, 0.5, 0.15);
  await page.waitForTimeout(1500);
  expect(await centreAlpha(page)).toBe(0);
});

test('мазки не переходять на наступний файл', async ({ page }) => {
  await ready(page);
  await page.getByTestId('brush-toggle').click();
  await scribble(page);
  await expect.poll(() => centreAlpha(page), { timeout: 60_000 }).toBe(0);

  await page.setInputFiles('[data-testid="pick"]', await plainJpeg());
  await expect.poll(() => centreAlpha(page), { timeout: 60_000 }).toBe(255);
});

test('той самий файл, вибраний знову, починає з чистого', async ({ page }) => {
  await ready(page);
  await page.getByTestId('brush-toggle').click();
  await scribble(page);
  await expect.poll(() => centreAlpha(page), { timeout: 60_000 }).toBe(0);

  await page.setInputFiles('[data-testid="pick"]', SPHERE);
  await expect.poll(() => centreAlpha(page), { timeout: 60_000 }).toBe(255);
});

test('стирання в JPEG перемикає на PNG', async ({ page }) => {
  await ready(page);
  await page.getByLabel(/Формат|Format/).selectOption('jpeg');
  await page.getByTestId('brush-toggle').click();
  await scribble(page);
  await expect(page.getByLabel(/Формат|Format/)).toHaveValue('png');
  await expect.poll(() => centreAlpha(page), { timeout: 60_000 }).toBe(0);
});
