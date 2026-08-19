import { test, expect } from '@playwright/test';
import { join } from 'node:path';

const SPHERE = join(import.meta.dirname, 'sphere.png');
const OUT = join(process.cwd(), 'shots');

test('знімок видалення фону', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/');
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await expect(page.locator('input[type=file][data-ready="true"]')).toBeAttached({ timeout: 60_000 });
  await page.setInputFiles('input[type=file]', SPHERE);
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 60_000 });

  await page.getByTestId('removebg').click();
  await expect(page.getByTestId('provider')).toBeVisible({ timeout: 180_000 });
  await page.getByTestId('outline-toggle').click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(OUT, 'segment-dark.png'), fullPage: true });
});
