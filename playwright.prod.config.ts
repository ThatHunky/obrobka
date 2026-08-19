import { defineConfig } from '@playwright/test';

/** Той самий набір e2e, але проти живого продакшну. */
export default defineConfig({
  testDir: './apps/web/e2e',
  timeout: 90_000,
  use: { baseURL: 'https://obrobka.dobrovolskyi.com.ua' },
});
