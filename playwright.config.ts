import { defineConfig } from '@playwright/test';

/**
 * Власний статичний сервер замість `astro preview`: той не застосовує
 * public/_headers (це фіча Cloudflare Pages), тож без нього перевірка
 * crossOriginIsolated була б беззмістовною. До того ж preview в Astro 7 —
 * демон, який конфліктує з іншими проєктами на цій машині.
 */
const PORT = 4488;

export default defineConfig({
  testDir: './apps/web/e2e',
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `node apps/web/e2e/server.mjs ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
