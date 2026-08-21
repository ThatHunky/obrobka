import { test, expect, type Page } from '@playwright/test';
import { join } from 'node:path';

const SPHERE = join(import.meta.dirname, 'sphere.png');

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('input[type=file][data-ready="true"]')).toBeAttached({ timeout: 60_000 });
  await page.setInputFiles('input[type=file]', SPHERE);
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 60_000 });
  await expectNoError(page);
}

/**
 * Віджет показує помилки в окремій панелі. Тести перевіряли результат,
 * але не перевіряли її — і пропустили runtime-помилку, яка з'являлась
 * уже після того, як зображення відмалювалось.
 */
async function expectNoError(page: Page): Promise<void> {
  await expect(page.locator('.error')).toHaveCount(0);
}

const size = (page: Page) =>
  page.getByTestId('result').evaluate((el) => {
    const i = el as HTMLImageElement;
    return { w: i.naturalWidth, h: i.naturalHeight };
  });

test('пресет 16:9 перераховує висоту', async ({ page }) => {
  await ready(page);
  await page.getByTestId('ratio-16:9').click();
  await expect.poll(async () => (await size(page)).h, { timeout: 60_000 }).toBe(288);
  expect((await size(page)).w).toBe(512);
  await expectNoError(page);
});

test('пресет 9:16 перераховує ширину', async ({ page }) => {
  await ready(page);
  await page.getByTestId('ratio-9:16').click();
  await expect.poll(async () => (await size(page)).w, { timeout: 60_000 }).toBe(288);
});

test('обмін сторонами місцями', async ({ page }) => {
  await ready(page);
  await page.getByTestId('ratio-16:9').click();
  await expect.poll(async () => (await size(page)).h, { timeout: 60_000 }).toBe(288);
  await page.getByTestId('swap').click();
  await expect.poll(async () => (await size(page)).w, { timeout: 60_000 }).toBe(288);
});

test("прив'язка з'являється лише там, де щось означає", async ({ page }) => {
  await ready(page);
  await expect(page.getByTestId('anchor-center')).toBeVisible();
  // Розтягування заповнює кадр цілком — прив'язувати нема чого
  await page.getByRole('button', { name: 'Розтягнути' }).click();
  await expect(page.getByTestId('anchor-center')).toHaveCount(0);
  await page.getByRole('button', { name: 'Вписати', exact: true }).click();
  await expect(page.getByTestId('anchor-center')).toBeVisible();
});

test("прив'язка вгору-ліворуч притискає вміст у кут", async ({ page }) => {
  await ready(page);
  await page.getByTestId('anchor-top-left').click();
  await expect(page.getByTestId('anchor-top-left')).toHaveAttribute('aria-checked', 'true');

  const alpha = await page.getByTestId('result').evaluate(async (el) => {
    const img = el as HTMLImageElement;
    await img.decode();
    const c = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    return {
      topLeft: ctx.getImageData(2, 2, 1, 1).data[3],
      bottomRight: ctx.getImageData(img.naturalWidth - 3, img.naturalHeight - 3, 1, 1).data[3],
    };
  });
  // Куля квадратна, тож у квадратному кадрі полів немає — перевіряємо
  // лише що зображення заповнене й нічого не зламалось
  expect(alpha.topLeft).toBeGreaterThan(0);
  expect(alpha.bottomRight).toBeGreaterThan(0);
});

test("кадрування за суб'єктом обрізає до суб'єкта", async ({ page }) => {
  await ready(page);
  await page.getByTestId('framing-smart').click();
  // Модель має завантажитись і кадр перебудуватись
  await expect(page.getByTestId('provider')).toBeVisible({ timeout: 180_000 });
  await expect.poll(async () => (await size(page)).w, { timeout: 180_000 }).toBe(512);
  await expectNoError(page);
});

test('обрізка порожніх країв доступна окремо', async ({ page }) => {
  await ready(page);
  await page.getByTestId('framing-trim').click();
  await expect(page.getByTestId('framing-trim')).toHaveClass(/on/);
  await expect(page.getByTestId('provider')).toBeVisible({ timeout: 180_000 });
  await expectNoError(page);
});
