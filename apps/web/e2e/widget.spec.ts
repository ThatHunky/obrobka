import { test, expect, type Page } from '@playwright/test';
import { join } from 'node:path';

const FIXTURE = join(import.meta.dirname, 'fixture.png');

/**
 * Острівець гідратується за client:visible, тож до готовності обробник
 * change ще не навішений. Віджет позначає це атрибутом data-ready —
 * чекаємо на нього, інакше подія летить у порожнечу.
 */
async function openWithFile(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('input[type=file][data-ready="true"]')).toBeAttached({
    timeout: 60_000,
  });
  await page.setInputFiles('[data-testid="pick"]', FIXTURE);
}

test('сторінка ізольована між походженнями', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => globalThis.crossOriginIsolated)).toBe(true);
});

test('віджет приводить зображення до 512×512', async ({ page }) => {
  await openWithFile(page);

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
  await openWithFile(page);
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'Аватар 400×400' }).click();
  const img = page.getByTestId('result');
  await expect.poll(
    () => img.evaluate((el) => (el as HTMLImageElement).naturalWidth),
    { timeout: 30_000 },
  ).toBe(400);
});

test("кнопка завантаження має осмислене ім'я файлу", async ({ page }) => {
  await openWithFile(page);
  const link = page.getByTestId('download');
  await expect(link).toBeVisible({ timeout: 30_000 });
  await expect(link).toHaveAttribute('download', 'fixture-512x512.png');
});
