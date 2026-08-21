import { test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

test('OG-картинка', async ({ page }) => {
  const PUB = join(process.cwd(), 'apps/web/public');
  const svg = await readFile(join(PUB, 'favicon.svg'), 'utf8');
  const url = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(`<!doctype html><meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
  <style>
    *{margin:0;box-sizing:border-box}
    body{width:1200px;height:630px;background:#0B1020;color:#EEF1FA;
      font-family:Inter,system-ui;display:flex;align-items:center;gap:64px;padding:0 84px;
      position:relative;overflow:hidden}
    body::before{content:'';position:absolute;inset:-40% -10% auto -20%;height:120%;
      background:radial-gradient(50% 50% at 25% 30%,rgba(245,181,46,.30),transparent 70%),
                 radial-gradient(45% 45% at 80% 20%,rgba(139,124,246,.22),transparent 70%)}
    .mark{width:260px;height:260px;flex:none;position:relative;
      filter:drop-shadow(0 24px 60px rgba(245,181,46,.28))}
    .copy{position:relative}
    h1{font-family:Unbounded;font-size:96px;letter-spacing:-.04em;line-height:1}
    p{font-size:30px;color:#B8C0D8;margin-top:20px;max-width:15ch;line-height:1.3}
    .tags{display:flex;gap:12px;margin-top:34px}
    .tag{font-family:ui-monospace,monospace;font-size:17px;color:#8892B0;
      border:1px solid #26304B;border-radius:999px;padding:7px 16px}
  </style>
  <img class="mark" src="${url}">
  <div class="copy">
    <h1>obrobka</h1>
    <p>Обробка зображень у браузері</p>
    <div class="tags"><span class="tag">без сервера</span><span class="tag">без акаунта</span><span class="tag">без завантажень</span></div>
  </div>`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  await writeFile(join(PUB, 'og.png'), await page.screenshot());
});
