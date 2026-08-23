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

/**
 * Прев'ю має показувати те саме, що вийде.
 *
 * Раніше воно будувалось із object-fit, object-position і transform:
 * scale — зовсім інша композиція, ніж у пайплайна. object-position
 * розподіляє ненаближений надлишок, а наближення накладалось трансформом
 * від центра; fit() же спершу масштабує, і лише потім вирізає кадр
 * часткою від збільшеного надлишку. Поки z = 1, обидва збігались, тож
 * вада сиділа тихо. Наближено — і кадр показував кроля, а на виході
 * була ковдра з кутка.
 *
 * Колір фікстури кодує координату, тож піксель у центрі кадру прямо
 * каже, яку точку оригіналу туди привели.
 */
test("прев'ю збігається з результатом при наближенні", async ({ page }) => {
  const { gradientPortrait } = await import('./fixtures.js');
  await page.goto('/');
  await expect(page.locator('input[type=file][data-ready="true"]')).toBeAttached({ timeout: 60_000 });
  await page.setInputFiles('[data-testid="pick"]', await gradientPortrait());
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('fit-cover').click();
  await page.waitForTimeout(500);

  const centreOf = async (): Promise<readonly [number[], number[]]> => {
    const preview = await page.evaluate(() => {
      const frame = document.querySelector('[data-testid="stage"]')!;
      const img = frame.querySelector('img.source') as HTMLImageElement;
      const fr = frame.getBoundingClientRect();
      const ir = img.getBoundingClientRect();
      const c = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const px = Math.round(((fr.x + fr.width / 2 - ir.x) / ir.width) * img.naturalWidth);
      const py = Math.round(((fr.y + fr.height / 2 - ir.y) / ir.height) * img.naturalHeight);
      const d = ctx.getImageData(
        Math.max(0, Math.min(img.naturalWidth - 1, px)),
        Math.max(0, Math.min(img.naturalHeight - 1, py)), 1, 1,
      ).data;
      return [d[0]!, d[1]!];
    });
    const result = await page.getByTestId('result').evaluate(async (el) => {
      const img = el as HTMLImageElement;
      await img.decode();
      const c = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(
        Math.floor(img.naturalWidth / 2), Math.floor(img.naturalHeight / 2), 1, 1,
      ).data;
      return [d[0]!, d[1]!];
    });
    return [preview, result] as const;
  };

  const agrees = async (label: string): Promise<void> => {
    await page.waitForTimeout(700);
    const [preview, result] = await centreOf();
    // Допуск — на ресемплінг і округлення частки до пікселя
    expect({ label, dx: Math.abs(preview[0]! - result[0]!) < 8 }).toEqual({ label, dx: true });
    expect({ label, dy: Math.abs(preview[1]! - result[1]!) < 8 }).toEqual({ label, dy: true });
  };

  const stage = page.getByTestId('stage');
  await stage.scrollIntoViewIfNeeded();
  const b = (await stage.boundingBox())!;
  await agrees('без наближення');

  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  for (let i = 0; i < 10; i++) await page.mouse.wheel(0, -120);
  await agrees('наближено');

  for (const [dx, dy] of [[160, 0], [0, 160], [-140, -140]] as const) {
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, { steps: 10 });
    await page.mouse.up();
    await agrees(`тягнення ${dx},${dy}`);
  }
});
