import { test, expect, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { heicSample, plainJpeg, rotatedJpeg } from './fixtures.js';

async function openMany(page: Page, files: readonly string[]): Promise<void> {
  await page.goto('/');
  await expect(page.locator('input[type=file][data-ready="true"]'))
    .toBeAttached({ timeout: 60_000 });
  await page.setInputFiles('[data-testid="pick"]', [...files]);
  await expect(page.getByTestId('batch-panel')).toBeVisible({ timeout: 60_000 });
}

async function three(): Promise<string[]> {
  return [
    await plainJpeg('one.jpg'),
    await plainJpeg('two.jpg'),
    (await rotatedJpeg()).path,
  ];
}

test('кілька файлів вмикають пакетний режим', async ({ page }) => {
  await openMany(page, await three());
  await expect(page.getByTestId('batch-count')).toContainText('3');
  await expect(page.getByTestId('batch-item')).toHaveCount(3);
  // Одиночне прев'ю «було / стало» в пакеті не показується. Сцена тепер
  // є в розмітці завжди — інакше Rollup викидав її CSS, — тож перевіряємо
  // видимість, а не наявність.
  await expect(page.locator('.stage')).toBeHidden();
  await expect(page.locator('.error')).toHaveCount(0);
});

test('усі файли доходять до стану «готово»', async ({ page }) => {
  await openMany(page, await three());
  await expect(page.locator('[data-testid="batch-item"].done'))
    .toHaveCount(3, { timeout: 90_000 });
  await expect(page.getByTestId('batch-failed')).toHaveCount(0);
});

test('ZIP розпаковується й містить усі три зображення', async ({ page }) => {
  await openMany(page, await three());
  await expect(page.locator('[data-testid="batch-item"].done'))
    .toHaveCount(3, { timeout: 90_000 });

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    page.getByTestId('batch-zip').click(),
  ]);

  const path = await download.path();
  const { readFile } = await import('node:fs/promises');
  const zip = unzipSync(new Uint8Array(await readFile(path)));
  const names = Object.keys(zip).sort();
  expect(names).toHaveLength(3);
  expect(names.every((n) => n.endsWith('.png'))).toBe(true);
  // Кожен запис — справжній PNG, а не порожній файл.
  for (const name of names) {
    expect(zip[name]!.length).toBeGreaterThan(100);
    expect([...zip[name]!.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  }
});

test('орієнтація застосовується й у пакеті', async ({ page }) => {
  await openMany(page, await three());

  // За замовчуванням кадр 512×512 у режимі «вписати», і всі результати
  // виходять квадратними — на квадраті поворот не побачиш. Тому inside:
  // він тримає пропорції, і вертикальний кадр лишається вертикальним.
  await page.getByTestId('fit-inside').click();
  await expect(page.getByTestId('batch-run')).toBeVisible();
  await page.getByTestId('batch-run').click();
  await expect(page.locator('[data-testid="batch-item"].done'))
    .toHaveCount(3, { timeout: 90_000 });

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    page.getByTestId('batch-zip').click(),
  ]);
  const { readFile } = await import('node:fs/promises');
  const zip = unzipSync(new Uint8Array(await readFile(await download.path())));

  // Заголовок IHDR PNG: ширина й висота лежать у байтах 16..24.
  const dims = (bytes: Uint8Array): [number, number] => {
    const v = new DataView(bytes.buffer, bytes.byteOffset);
    return [v.getUint32(16), v.getUint32(20)];
  };
  const rotated = dims(zip['rotated.png']!);
  const plain = dims(zip['one.png']!);
  expect(plain[0], 'звичайний файл лишається горизонтальним').toBeGreaterThan(plain[1]);
  expect(rotated[1], 'повернутий стає вертикальним').toBeGreaterThan(rotated[0]);
});

test('битий файл не зупиняє решту', async ({ page }) => {
  const { writeFile, mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'obrobka-bad-'));
  const bad = join(dir, 'bad.jpg');
  await writeFile(bad, Uint8Array.of(0xff, 0xd8, 0xff, 1, 2, 3, 4, 5, 6, 7, 8, 9));

  await openMany(page, [await plainJpeg('ok1.jpg'), bad, await plainJpeg('ok2.jpg')]);
  await expect(page.locator('[data-testid="batch-item"].done'))
    .toHaveCount(2, { timeout: 90_000 });
  await expect(page.getByTestId('batch-failed')).toBeVisible();
  await expect(page.getByTestId('batch-zip')).toBeVisible();
});

test('HEIC працює в пакеті нарівні з рештою', async ({ page }) => {
  await openMany(page, [await heicSample(), await plainJpeg('side.jpg')]);
  await expect(page.locator('[data-testid="batch-item"].done'))
    .toHaveCount(2, { timeout: 120_000 });
  await expect(page.getByTestId('batch-failed')).toHaveCount(0);
});

test('зміна налаштувань просить перезапустити, а не гризе процесор', async ({ page }) => {
  await openMany(page, await three());
  await expect(page.locator('[data-testid="batch-item"].done'))
    .toHaveCount(3, { timeout: 90_000 });

  await page.getByLabel(/Формат|Format/).selectOption('webp');
  await expect(page.getByTestId('batch-run')).toBeVisible();

  await page.getByTestId('batch-run').click();
  await expect(page.locator('[data-testid="batch-item"].done'))
    .toHaveCount(3, { timeout: 90_000 });
  await expect(page.getByTestId('batch-run')).toHaveCount(0);
  await expect(page.locator('.error')).toHaveCount(0);
});

test('двадцять файлів за один прохід — критерій готовності етапу', async ({ page }) => {
  const files: string[] = [];
  for (let i = 0; i < 20; i++) files.push(await plainJpeg(`IMG_${1000 + i}.jpg`));

  await openMany(page, files);
  await expect(page.locator('[data-testid="batch-item"].done'))
    .toHaveCount(20, { timeout: 180_000 });
  await expect(page.getByTestId('batch-failed')).toHaveCount(0);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    page.getByTestId('batch-zip').click(),
  ]);
  const { readFile } = await import('node:fs/promises');
  const zip = unzipSync(new Uint8Array(await readFile(await download.path())));
  expect(Object.keys(zip)).toHaveLength(20);
});

test('очищення повертає до одиночного режиму', async ({ page }) => {
  await openMany(page, await three());
  await page.getByTestId('batch-clear').click();
  await expect(page.getByTestId('batch-panel')).toHaveCount(0);
  await expect(page.locator('.error')).toHaveCount(0);
});
