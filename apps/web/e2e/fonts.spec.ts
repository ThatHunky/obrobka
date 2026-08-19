import { test, expect } from '@playwright/test';

test('шрифти завантажились попри COEP', async ({ page }) => {
  const blocked: string[] = [];
  page.on('requestfailed', (r) => {
    if (r.url().includes('fonts.g')) blocked.push(`${r.url()} :: ${r.failure()?.errorText}`);
  });
  await page.goto('/', { waitUntil: 'networkidle' });

  const info = await page.evaluate(async () => {
    await document.fonts.ready;
    const h1 = document.querySelector('h1');
    return {
      isolated: globalThis.crossOriginIsolated,
      loaded: document.fonts.size,
      unbounded: document.fonts.check('700 2rem Unbounded'),
      inter: document.fonts.check('400 1rem Inter'),
      h1Family: h1 ? getComputedStyle(h1).fontFamily.split(',')[0] : null,
    };
  });
  console.log('ШРИФТИ:', JSON.stringify(info));
  console.log('ЗАБЛОКОВАНО:', blocked.length ? blocked : 'нічого');
  expect(info.isolated).toBe(true);
  expect(info.unbounded).toBe(true);
  expect(blocked).toEqual([]);
});
