import { test, expect, type Page } from '@playwright/test';
import { join } from 'node:path';

const FIXTURE = join(import.meta.dirname, 'fixture.png');

/**
 * Перевірка розкладки: жоден рядок тексту не має лежати поверх кнопки.
 *
 * Приводом стало від'ємне поле в підказки. Воно писалось під сітку
 * віджета, де проміжок 1.5rem для підпису завеликий, але діяло й
 * усередині fieldset, де проміжку немає — і підказка під «Збільшенням»
 * наїжджала на чипи на 6 px. Це не лише виглядало неохайно: підказка
 * стоїть у розмітці пізніше, тож перехоплювала й натискання. На екрані
 * з мишею наведення піднімало чип і рятувало клік, на дотику — ні.
 */

interface Overlap {
  readonly text: string;
  readonly over: string;
  readonly oy: number;
}

/** Прямокутники рядків тексту проти прямокутників клікабельного. */
const PROBE = `(() => {
  const root = document.querySelector('.widget');
  if (root === null) return [];

  const lines = [];
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walk.nextNode()) !== null) {
    if (node.nodeValue === null || node.nodeValue.trim() === '') continue;
    const parent = node.parentElement;
    if (parent === null || parent.closest('svg') !== null) continue;
    const style = getComputedStyle(parent);
    if (style.visibility === 'hidden' || style.opacity === '0') continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const rect of Array.from(range.getClientRects())) {
      if (rect.width < 1 || rect.height < 1) continue;
      lines.push({ node, rect, label: node.nodeValue.trim().replace(/\\s+/g, ' ').slice(0, 40) });
    }
  }

  const name = (el) => {
    const cls = typeof el.className === 'string'
      ? el.className.split(' ').filter((c) => !c.startsWith('svelte-')).join('.') : '';
    const text = (el.textContent ?? '').trim().replace(/\\s+/g, ' ').slice(0, 28);
    return el.tagName.toLowerCase() + (cls === '' ? '' : '.' + cls) + ' «' + text + '»';
  };

  const targets = [];
  for (const el of Array.from(root.querySelectorAll('button, a, select, .chip, .track, .tier, .opt'))) {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    if (rect.width < 1 || rect.height < 1) continue;
    if (style.visibility === 'hidden' || style.opacity === '0') continue;
    targets.push({ el, rect });
  }

  const out = [];
  for (const line of lines) {
    for (const target of targets) {
      if (target.el.contains(line.node)) continue;
      const ox = Math.min(line.rect.right, target.rect.right) - Math.max(line.rect.left, target.rect.left);
      const oy = Math.min(line.rect.bottom, target.rect.bottom) - Math.max(line.rect.top, target.rect.top);
      if (ox > 0.5 && oy > 0.5) {
        out.push({ text: line.label, over: name(target.el), oy: Math.round(oy * 10) / 10 });
      }
    }
  }
  return out;
})()`;

const overlaps = (page: Page): Promise<Overlap[]> => page.evaluate(PROBE) as Promise<Overlap[]>;

/**
 * Моделі тут не потрібні: перевіряється лише розкладка, а тягнути
 * 84 МБ заради двох прямокутників — марна витрата часу й трафіку.
 */
async function open(page: Page, width: number, height: number): Promise<void> {
  await page.route(/\.onnx($|\?)/, (route) => route.abort());
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await expect(page.locator('input[type=file][data-ready="true"]')).toBeAttached({ timeout: 60_000 });
}

for (const view of [
  { name: 'широкий екран', width: 1400, height: 1000 },
  { name: 'телефон', width: 390, height: 844 },
]) {
  test(`${view.name}: підказки не лежать на кнопках`, async ({ page }) => {
    await open(page, view.width, view.height);
    expect(await overlaps(page)).toEqual([]);

    // Кожен перемикач відкриває свою підказку — перевіряємо всі.
    await page.getByTestId('upscale-2').click();
    expect(await overlaps(page)).toEqual([]);

    await page.getByTestId('framing-smart').click();
    expect(await overlaps(page)).toEqual([]);

    await page.getByTestId('removebg').click();
    expect(await overlaps(page)).toEqual([]);

    await page.getByTestId('outline-toggle').click();
    expect(await overlaps(page)).toEqual([]);

    // Панель шарів приносить свої підказки й свій список кнопок
    await page.setInputFiles('[data-testid="layer-add"]', FIXTURE);
    await expect(page.locator('[data-testid^="layer-remove-"]'))
      .toHaveCount(1, { timeout: 30_000 });
    expect(await overlaps(page)).toEqual([]);
  });
}

/**
 * Підказка під «Збільшенням» — той самий випадок, але перевірений із
 * боку влучання: нижній край чипів має лишатись натисним. Наведення
 * тут не допоможе, бо на дотику його немає, тож перевіряємо без нього.
 */
test('нижній край чипів збільшення лишається натисним', async ({ page }) => {
  await open(page, 1400, 1000);
  await page.getByTestId('upscale-2').click();
  await page.mouse.move(0, 0);

  const missed = await page.evaluate(() => {
    const out: string[] = [];
    for (const id of ['upscale-1', 'upscale-2', 'upscale-4']) {
      const btn = document.querySelector(`[data-testid="${id}"]`);
      if (btn === null) continue;
      const rect = btn.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.bottom - 3);
      if (hit === null || !(hit === btn || btn.contains(hit))) out.push(id);
    }
    return out;
  });
  expect(missed).toEqual([]);
});
