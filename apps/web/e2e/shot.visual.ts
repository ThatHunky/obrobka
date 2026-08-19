import { test, expect } from '@playwright/test';
import { join } from 'node:path';

const FIXTURE = join(import.meta.dirname, 'fixture.png');
const OUT = join(process.cwd(), 'shots');

for (const theme of ['light', 'dark'] as const) {
  test(`знімок ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
    await expect(page.locator('input[type=file][data-ready="true"]')).toBeAttached({ timeout: 30_000 });
    await page.setInputFiles('input[type=file]', FIXTURE);
    await expect(page.getByTestId('result')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: join(OUT, `home-${theme}.png`), fullPage: true });
  });
}

test('знімок лендінгу', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/стікер-для-телеграма/');
  await expect(page.locator('input[type=file][data-ready="true"]')).toBeAttached({ timeout: 30_000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT, 'landing.png'), fullPage: true });
});
