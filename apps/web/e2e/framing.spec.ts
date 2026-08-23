import { test, expect, type Page } from '@playwright/test';
import { join } from 'node:path';

const SPHERE = join(import.meta.dirname, 'sphere.png');

/**
 * Прямокутник сцени у координатах вікна.
 *
 * Без прокручування сцена лежить нижче за екран, а page.mouse працює
 * саме у видимих координатах — жест ішов у порожнечу, і тест «падав»
 * на цілком робочому коді.
 */
async function stageBox(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const stage = page.getByTestId('stage');
  await stage.scrollIntoViewIfNeeded();
  return (await stage.boundingBox())!;
}

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('input[type=file][data-ready="true"]')).toBeAttached({ timeout: 60_000 });
  await page.setInputFiles('[data-testid="pick"]', SPHERE);
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 60_000 });
}

test('кадрувати можна лише там, де є вільне місце', async ({ page }) => {
  await ready(page);
  await expect(page.getByTestId('stage')).toBeVisible();
  await expect(page.getByTestId('framing-reset')).toBeVisible();

  // Розтягування заповнює кадр цілком — рухати нема чого
  await page.getByTestId('fit-fill').click();
  await expect(page.getByTestId('stage')).toBeVisible();
  await expect(page.getByTestId('framing-reset')).toHaveCount(0);
});

test("тягнення переводить прив'язку в частки", async ({ page }) => {
  await ready(page);
  await page.getByTestId('fit-cover').click();
  await page.getByTestId('ratio-16:9').click();
  await expect(page.getByTestId('stage')).toBeVisible();
  await expect(page.getByTestId('anchor-center')).toHaveAttribute('aria-checked', 'true');

  const box = await stageBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 8, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();

  // Жодна з дев'яти крапок більше не активна: прив'язка стала власною
  await expect(page.locator('[data-testid^="anchor-"][aria-checked="true"]')).toHaveCount(0);
  await expect(page.locator('.error')).toHaveCount(0);
});

test('колесо наближає, скидання повертає кадр', async ({ page }) => {
  await ready(page);
  const box = await stageBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -300);
  await expect(page.getByTestId('zoom-value')).toBeVisible();
  await page.getByTestId('framing-reset').click();
  await expect(page.getByTestId('zoom-value')).toHaveCount(0);
  await expect(page.locator('.error')).toHaveCount(0);
});

/**
 * Найдорожча помилка тут — перезапускати пайплайн на кожен рух пальця.
 * Лічимо не виклики, а результати: кожен прогін віддає новий objectURL,
 * тож зміни src досить, щоб побачити зайві прогони.
 */
test('тягнення не перезапускає обробку щокадру', async ({ page }) => {
  await ready(page);
  await page.getByTestId('fit-cover').click();
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const w = window as unknown as { __runs: number };
    w.__runs = 0;
    const img = document.querySelector('[data-testid="result"]')!;
    new MutationObserver(() => { w.__runs++; })
      .observe(img, { attributes: true, attributeFilter: ['src'] });
  });

  const box = await stageBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 10, box.y + 10, { steps: 25 });
  await page.mouse.up();
  await page.waitForTimeout(1500);

  const runs = await page.evaluate(() => (window as unknown as { __runs: number }).__runs);
  expect(runs).toBeGreaterThan(0);
  expect(runs).toBeLessThanOrEqual(2);
});
