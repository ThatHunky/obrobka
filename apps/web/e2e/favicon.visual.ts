import { test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const PUB = join(process.cwd(), 'apps/web/public');
const OUT = join(process.cwd(), 'shots');

/** Рендерить SVG у PNG точного розміру через справжній браузер. */
async function raster(
  page: import('@playwright/test').Page,
  svg: string, size: number, opaque: string | null,
): Promise<Buffer> {
  const url = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><style>html,body{margin:0;padding:0;` +
    `background:${opaque ?? 'transparent'}}img{display:block;width:${size}px;height:${size}px}</style>` +
    `<img src="${url}">`);
  await page.waitForTimeout(120);
  return page.screenshot({ omitBackground: opaque === null });
}

test('генерація іконок', async ({ page }) => {
  const favicon = await readFile(join(PUB, 'favicon.svg'), 'utf8');
  const maskable = await readFile(join(PUB, 'icon-mask.svg'), 'utf8');

  for (const s of [16, 32, 48]) {
    await writeFile(join(PUB, `favicon-${s}.png`), await raster(page, favicon, s, null));
  }
  // Apple композитує на білому і не поважає альфу — віддаємо непрозоре
  await writeFile(join(PUB, 'apple-touch-icon.png'), await raster(page, maskable, 180, '#0B1020'));
  for (const s of [192, 512]) {
    await writeFile(join(PUB, `icon-${s}.png`), await raster(page, maskable, s, '#0B1020'));
  }
  await writeFile(join(OUT, 'favicon-final-64.png'), await raster(page, favicon, 64, null));
});

test('порівняльний аркуш', async ({ page }) => {
  const favicon = await readFile(join(PUB, 'favicon.svg'), 'utf8');
  const png = (await readFile(join(OUT, 'ChatGPT Image Aug 21, 2026, 06_54_01 PM.png')))
    .toString('base64');
  const svgUrl = `data:image/svg+xml;base64,${Buffer.from(favicon).toString('base64')}`;
  const pngUrl = `data:image/png;base64,${png}`;
  const sizes = [64, 48, 32, 16];
  const row = (l: string, src: string) =>
    `<div class="row"><span class="lbl">${l}</span>${sizes.map((s) =>
      `<div class="cell"><img src="${src}" width="${s}" height="${s}"><i>${s}</i></div>`).join('')}</div>`;

  await page.setViewportSize({ width: 640, height: 460 });
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    body{margin:0;font:13px/1.4 system-ui;color:#0b1020}
    .band{padding:16px 18px;background:#f7f8fc}
    .band.dark{background:#0b1020;color:#eef1fa}
    .row{display:flex;align-items:flex-end;gap:26px;margin:12px 0}
    .lbl{width:130px;font-weight:600;font-size:12px}
    .cell{display:grid;justify-items:center;gap:4px}
    .cell i{font-size:10px;opacity:.55;font-style:normal}
    img{display:block}</style>
  <div class="band"><strong>Світле тло</strong>${row('ChatGPT, як є', pngUrl)}${row('SVG, доведений', svgUrl)}</div>
  <div class="band dark"><strong>Темне тло</strong>${row('ChatGPT, як є', pngUrl)}${row('SVG, доведений', svgUrl)}</div>`);
  await page.waitForTimeout(300);
  await page.locator('body').screenshot({ path: join(OUT, 'favicon-compare.png') });
});
