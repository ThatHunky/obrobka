import { test, expect } from '@playwright/test';

test('лічильник показує дані з API', async ({ page }) => {
  await page.route('**/api/stats', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      runs: 12345,
      ops: { resize: 9000, removeBackground: 3000, convert: 345 },
      cities: [
        { country: 'UA', city: 'Kyiv', n: 900 },
        { country: 'PL', city: 'Warsaw', n: 120 },
      ],
    }),
  }));
  await page.goto('/');
  await page.getByRole('heading', { name: /Скільки цим користуються/ }).scrollIntoViewIfNeeded();

  const runs = page.getByTestId('stats-runs');
  await expect(runs).toBeVisible({ timeout: 30_000 });
  // Число доїжджає анімацією, тож чекаємо на кінцеве значення
  await expect.poll(async () => (await runs.textContent())?.replace(/\D/g, ''), { timeout: 15_000 })
    .toBe('12345');

  await expect(page.getByText('Kyiv')).toBeVisible();
  await expect(page.getByText('видалення фону')).toBeVisible();
});

test('порожній лічильник не ламає сторінку', async ({ page }) => {
  await page.route('**/api/stats', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ runs: 0, ops: {}, cities: [] }),
  }));
  await page.goto('/');
  await expect(page.getByText(/Поки що тиша/)).toBeVisible({ timeout: 30_000 });
});

test('падіння API не ламає сторінку', async ({ page }) => {
  await page.route('**/api/stats', (r) => r.abort());
  await page.goto('/');
  await expect(page.getByTestId('result').or(page.locator('h1'))).toBeVisible();
  await expect(page.getByRole('heading', { name: /Скільки цим користуються/ })).toBeVisible();
});
