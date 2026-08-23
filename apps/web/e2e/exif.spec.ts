import { test, expect, type Page } from '@playwright/test';
import { heicSample, plainJpeg, rotatedJpeg } from './fixtures.js';

async function open(page: Page, file: string): Promise<void> {
  await page.goto('/');
  await expect(page.locator('input[type=file][data-ready="true"]'))
    .toBeAttached({ timeout: 60_000 });
  await page.setInputFiles('[data-testid="pick"]', file);
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 60_000 });
}

const resultSize = (page: Page) =>
  page.getByTestId('result').evaluate((el) => {
    const i = el as HTMLImageElement;
    return { w: i.naturalWidth, h: i.naturalHeight };
  });

const sourceSize = (page: Page) =>
  page.locator('.stage img').first().evaluate((el) => {
    const i = el as HTMLImageElement;
    return { w: i.naturalWidth, h: i.naturalHeight };
  });

test('розбіжність, заради якої все робилось: браузер повертає фото, декодер — ні', async ({ page }) => {
  const fixture = await rotatedJpeg();
  await open(page, fixture.path);

  // Браузер застосовує EXIF сам: 60×30 у файлі показуються як 30×60.
  const before = await sourceSize(page);
  expect(before, 'браузер мав показати кадр поверненим').toEqual({ w: 30, h: 60 });

  // Без автоповороту в пайплайні результат вийшов би 60 у ширину —
  // тобто «Було» і «Стало» суперечили б одне одному.
  await page.getByTestId('fit-inside').click();
  await page.getByLabel(/Ширина|Width/).fill('300');
  await page.getByLabel(/Висота|Height/).fill('300');

  // inside тримає пропорції, тож вертикальний кадр лишається вертикальним.
  await expect.poll(async () => {
    const s = await resultSize(page);
    return s.h > s.w;
  }, { timeout: 60_000 }).toBe(true);
  await expect(page.locator('.error')).toHaveCount(0);
});

test('панель показує координати з файлу', async ({ page }) => {
  const fixture = await rotatedJpeg();
  await open(page, fixture.path);

  await expect(page.getByTestId('exif-panel')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('exif-gps')).toContainText('50.45000');
  await expect(page.getByTestId('exif-gps')).toContainText('30.52330');
  await expect(page.getByTestId('exif-camera')).toContainText('iPhone 15 Pro');
  await expect(page.getByTestId('exif-orientation')).toContainText('6');
  await expect(page.locator('.error')).toHaveCount(0);
});

test('панель обіцяє чистий результат', async ({ page }) => {
  await open(page, (await rotatedJpeg()).path);
  await expect(page.getByTestId('exif-panel')).toContainText(/не потрапить|reaches the result/);
});

test('файл без метаданих не малює порожню панель', async ({ page }) => {
  await open(page, await plainJpeg());
  await expect(page.getByTestId('exif-panel')).toHaveCount(0);
  await expect(page.locator('.error')).toHaveCount(0);
});

test('HEIC відкривається й має прев’ю', async ({ page }) => {
  await open(page, await heicSample());

  // `<img>` із blob-HEIC у Chromium не показався б, тож прев'ю малює воркер.
  await expect.poll(async () => (await sourceSize(page)).w, { timeout: 90_000 })
    .toBeGreaterThan(0);
  const out = await resultSize(page);
  expect(out.w).toBeGreaterThan(0);
  await expect(page.locator('.error')).toHaveCount(0);
});

test('HEIC конвертується в JPEG', async ({ page }) => {
  await open(page, await heicSample());
  await page.getByLabel(/Формат|Format/).selectOption('jpeg');
  await expect.poll(async () => (await resultSize(page)).w, { timeout: 90_000 })
    .toBeGreaterThan(0);
  await expect(page.getByTestId('download')).toHaveAttribute('download', /\.jpeg$/);
  await expect(page.locator('.error')).toHaveCount(0);
});
