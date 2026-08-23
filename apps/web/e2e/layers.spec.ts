import { test, expect, type Page } from '@playwright/test';
import { join } from 'node:path';

const SPHERE = join(import.meta.dirname, 'sphere.png');
const FIXTURE = join(import.meta.dirname, 'fixture.png');

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('input[type=file][data-ready="true"]')).toBeAttached({ timeout: 60_000 });
  await page.setInputFiles('[data-testid="pick"]', SPHERE);
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 60_000 });
}

/**
 * Середній піксель результату — щоб побачити, що шар справді ліг.
 *
 * Кожен прогін підміняє src новим objectURL, і зчитування може влучити
 * у мить, коли зображення ще не декодоване: decode() тоді кидає
 * EncodingError. Це не поламаний результат, а перегони, тож чекаємо
 * готовності замість того, щоб падати.
 */
async function centre(page: Page): Promise<string> {
  return page.getByTestId('result').evaluate(async (el) => {
    const img = el as HTMLImageElement;
    if (!img.complete || img.naturalWidth === 0) {
      await new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
        setTimeout(resolve, 3000);
      });
    }
    await img.decode();
    const c = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(
      Math.floor(img.naturalWidth / 2), Math.floor(img.naturalHeight / 2), 1, 1,
    ).data;
    return `${d[0]},${d[1]},${d[2]},${d[3]}`;
  });
}

async function addLayer(page: Page): Promise<void> {
  await page.setInputFiles('[data-testid="layer-add"]', FIXTURE);
  await expect(page.locator('[data-testid^="layer-remove-"]')).toHaveCount(1, { timeout: 30_000 });
}

test('накладене зображення видно в результаті', async ({ page }) => {
  await ready(page);
  const before = await centre(page);
  await addLayer(page);
  await expect.poll(() => centre(page), { timeout: 60_000 }).not.toBe(before);
  await expect(page.locator('.error')).toHaveCount(0);
});

test('прихований шар зникає з результату', async ({ page }) => {
  await ready(page);
  const clean = await centre(page);
  await addLayer(page);
  await expect.poll(() => centre(page), { timeout: 60_000 }).not.toBe(clean);

  await page.locator('[data-testid^="layer-hide-"]').first().click();
  await expect.poll(() => centre(page), { timeout: 60_000 }).toBe(clean);
});

test('прозорість шару впливає на результат', async ({ page }) => {
  await ready(page);
  const clean = await centre(page);
  await addLayer(page);
  await expect.poll(() => centre(page), { timeout: 60_000 }).not.toBe(clean);
  const full = await centre(page);
  // fill сам шле input — другої події не треба, вона лише подвоювала прогін
  await page.getByTestId('layer-opacity').fill('20');
  await expect.poll(() => centre(page), { timeout: 60_000 }).not.toBe(full);
  await expect(page.locator('.error')).toHaveCount(0);
});

test('вилучення шару прибирає його зі списку й з результату', async ({ page }) => {
  await ready(page);
  const clean = await centre(page);
  await addLayer(page);
  await expect.poll(() => centre(page), { timeout: 60_000 }).not.toBe(clean);

  await page.locator('[data-testid^="layer-remove-"]').first().click();
  await expect(page.locator('[data-testid^="layer-remove-"]')).toHaveCount(0);
  await expect.poll(() => centre(page), { timeout: 60_000 }).toBe(clean);
});
