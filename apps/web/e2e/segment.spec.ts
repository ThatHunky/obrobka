import { test, expect, type Page } from '@playwright/test';
import { join } from 'node:path';

const SPHERE = join(import.meta.dirname, 'sphere.png');

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('input[type=file][data-ready="true"]')).toBeAttached({ timeout: 60_000 });
  await page.setInputFiles('input[type=file]', SPHERE);
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 60_000 });
}

test('фон знімається, розмір результату не змінюється', async ({ page }) => {
  await ready(page);
  await page.getByTestId('removebg').click();
  await expect.poll(
    () => page.getByTestId('result').evaluate((el) => (el as HTMLImageElement).naturalWidth),
    { timeout: 180_000 },
  ).toBe(512);
});

test('показує рівні моделі з вагою', async ({ page }) => {
  await ready(page);
  await page.getByTestId('removebg').click();
  await expect(page.getByTestId('tier-fast')).toBeVisible();
  await expect(page.getByTestId('tier-fast')).toContainText('4.4 МБ');
  await expect(page.getByTestId('tier-portrait')).toContainText('12.4 МБ');
  await expect(page.getByTestId('tier-quality')).toContainText('84.1 МБ');
});

test('повідомляє провайдер виконання', async ({ page }) => {
  await ready(page);
  await page.getByTestId('removebg').click();
  await expect(page.getByTestId('provider')).toContainText(/відеокарті|процесорі/, {
    timeout: 180_000,
  });
});

test('jpeg перемикається на png при видаленні фону', async ({ page }) => {
  await ready(page);
  await page.getByLabel(/Формат|Format/).selectOption('jpeg');
  await page.getByTestId('removebg').click();
  await expect(page.getByLabel(/Формат|Format/)).toHaveValue('png');
});

test('результат справді прозорий по кутах', async ({ page }) => {
  await ready(page);
  await page.getByTestId('removebg').click();
  await expect(page.getByTestId('provider')).toBeVisible({ timeout: 180_000 });

  /**
   * Опитуємо, а не читаємо одразу: після прогріву моделі віджет запускає
   * обробку ще раз, і миттєвий знімок піймав би попередній результат.
   */
  async function alphaAt(): Promise<{ corner: number; centre: number }> {
    return page.getByTestId('result').evaluate(async (el) => {
      const img = el as HTMLImageElement;
      await img.decode();
      const c = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      return {
        corner: ctx.getImageData(4, 4, 1, 1).data[3]!,
        centre: ctx.getImageData(
          Math.round(img.naturalWidth * 0.5),
          Math.round(img.naturalHeight * 0.48), 1, 1).data[3]!,
      };
    });
  }

  await expect.poll(async () => (await alphaAt()).corner, { timeout: 180_000 })
    .toBeLessThan(60);
  expect((await alphaAt()).centre).toBeGreaterThan(190);
});
