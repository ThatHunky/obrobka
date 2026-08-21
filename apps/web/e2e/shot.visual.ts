import { test, expect } from '@playwright/test';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'shots');

test('знімок лічильника', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.route('**/api/stats', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      runs: 4821,
      ops: { resize: 3102, removeBackground: 1290, convert: 340, smartCrop: 89 },
      cities: [
        { country: 'UA', city: 'Kyiv', n: 1840 },
        { country: 'UA', city: 'Lviv', n: 620 },
        { country: 'PL', city: 'Warszawa', n: 410 },
        { country: 'DE', city: 'Berlin', n: 220 },
        { country: 'US', city: 'New York', n: 96 },
      ],
    }),
  }));
  await page.goto('/');
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  const h = page.getByRole('heading', { name: /Скільки цим користуються/ });
  await h.scrollIntoViewIfNeeded();
  await expect(page.getByTestId('stats-runs')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1600);
  await page.locator('section.stats').screenshot({ path: join(OUT, 'stats.png') });
});
