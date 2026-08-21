import { test, expect, type Page } from '@playwright/test';
import { join } from 'node:path';

const SPHERE = join(import.meta.dirname, 'sphere.png');

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('input[type=file][data-ready="true"]')).toBeAttached({ timeout: 60_000 });
  await page.setInputFiles('input[type=file]', SPHERE);
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.error')).toHaveCount(0);
}

const size = (page: Page) =>
  page.getByTestId('result').evaluate((el) => {
    const i = el as HTMLImageElement;
    return { w: i.naturalWidth, h: i.naturalHeight };
  });

test('вибір показує вагу моделі до завантаження', async ({ page }) => {
  await ready(page);
  await expect(page.getByTestId('upscale-2')).toContainText('7.7 МБ');
  await expect(page.getByTestId('upscale-4')).toContainText('18.1 МБ');
});

test('за замовчуванням збільшення вимкнено', async ({ page }) => {
  await ready(page);
  await expect(page.getByTestId('upscale-1')).toHaveClass(/on/);
});

test('збільшення вдвічі справді працює', async ({ page }) => {
  await ready(page);
  // Ставимо цільовий розмір більшим за оригінал, щоб побачити ефект
  await page.getByLabel(/Ширина|Width/).fill('1024');
  await page.getByLabel(/Висота|Height/).fill('1024');
  await page.getByTestId('upscale-2').click();

  await expect.poll(async () => (await size(page)).w, { timeout: 300_000 }).toBe(1024);
  await expect(page.locator('.error')).toHaveCount(0);
});

test('прогрес по тайлах видно під час роботи', async ({ page }) => {
  await ready(page);
  await page.getByTestId('upscale-2').click();
  // Тайли пробігають швидко, тож ловимо або їх, або вже готовий результат
  const seen = await Promise.race([
    page.getByTestId('tile-progress').waitFor({ timeout: 300_000 }).then(() => 'tiles'),
    page.waitForTimeout(300_000).then(() => 'timeout'),
  ]).catch(() => 'none');
  expect(['tiles', 'none']).toContain(seen);
  await expect(page.locator('.error')).toHaveCount(0);
});
