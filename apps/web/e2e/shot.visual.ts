import { test, expect } from '@playwright/test';
import { join } from 'node:path';

const SPHERE = join(import.meta.dirname, 'sphere.png');
const OUT = join(process.cwd(), 'shots');

test('знімок налаштувань обрізки', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 1000 });
  await page.goto('/');
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await expect(page.locator('input[type=file][data-ready="true"]')).toBeAttached({ timeout: 60_000 });
  await page.setInputFiles('[data-testid="pick"]', SPHERE);
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 60_000 });

  await page.getByTestId('ratio-16:9').click();
  await page.getByTestId('anchor-bottom-left').click();
  await page.getByTestId('framing-smart').click();
  await expect(page.getByTestId('provider')).toBeVisible({ timeout: 180_000 });
  await page.waitForTimeout(1200);
  await page.locator('.crop').scrollIntoViewIfNeeded();
  await page.locator('section.widget').screenshot({ path: join(OUT, 'crop-ui.png') });
});
