import { test, expect } from '@playwright/test';
import { join } from 'node:path';

const FIXTURE = join(import.meta.dirname, 'fixture.png');

test('сторінка ізольована між походженнями', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => globalThis.crossOriginIsolated)).toBe(true);
});

test('віджет приводить зображення до 512×512', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', FIXTURE);

  const img = page.getByTestId('result');
  await expect(img).toBeVisible({ timeout: 30_000 });
  await expect.poll(
    () => img.evaluate((el) => (el as HTMLImageElement).naturalWidth),
    { timeout: 30_000 },
  ).toBe(512);

  const size = await img.evaluate((el) => {
    const i = el as HTMLImageElement;
    return { w: i.naturalWidth, h: i.naturalHeight };
  });
  expect(size).toEqual({ w: 512, h: 512 });
});

test('пресет аватара дає 400×400 у режимі cover', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', FIXTURE);
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'Аватар 400×400' }).click();
  const img = page.getByTestId('result');
  await expect.poll(
    () => img.evaluate((el) => (el as HTMLImageElement).naturalWidth),
    { timeout: 30_000 },
  ).toBe(400);
});

test("кнопка завантаження має осмислене ім'я файлу", async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', FIXTURE);
  const link = page.getByTestId('download');
  await expect(link).toBeVisible({ timeout: 30_000 });
  await expect(link).toHaveAttribute('download', 'fixture-512x512.png');
});
