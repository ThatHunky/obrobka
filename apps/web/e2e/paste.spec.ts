import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const FIXTURE = join(import.meta.dirname, 'fixture.png');

test('кнопка «Вставити» є й активна після гідратації', async ({ page }) => {
  await page.goto('/');
  const btn = page.getByTestId('paste');
  await expect(btn).toBeVisible();
  await expect(btn).toBeEnabled({ timeout: 60_000 });
});

test('подія paste приймає зображення з буфера', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('input[type=file][data-ready="true"]')).toBeAttached({ timeout: 60_000 });

  const b64 = (await readFile(FIXTURE)).toString('base64');
  // Формуємо справжню подію paste із File у clipboardData
  await page.evaluate(async (data) => {
    const bin = atob(data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const file = new File([bytes], 'pasted.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
  }, b64);

  await expect(page.getByTestId('result')).toBeVisible({ timeout: 60_000 });
  await expect.poll(
    () => page.getByTestId('result').evaluate((el) => (el as HTMLImageElement).naturalWidth),
    { timeout: 60_000 },
  ).toBe(512);
});
