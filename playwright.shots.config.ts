import { defineConfig } from '@playwright/test';

/** Знімки для перегляду дизайну — окремо, щоб не шуміти в основному наборі. */
const PORT = 4489;

export default defineConfig({
  testDir: './apps/web/e2e',
  testMatch: '**/*.visual.ts',
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PORT}`, viewport: { width: 1280, height: 900 } },
  webServer: {
    command: `node apps/web/e2e/server.mjs ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
