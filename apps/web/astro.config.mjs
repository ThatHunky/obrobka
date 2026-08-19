import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://obrobka.dobrovolskyi.com.ua',
  i18n: {
    locales: ['uk', 'en'],
    defaultLocale: 'uk',
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    svelte(),
    sitemap({ i18n: { defaultLocale: 'uk', locales: { uk: 'uk-UA', en: 'en' } } }),
  ],
  vite: {
    // COOP/COEP у режимі розробки — інакше SharedArrayBuffer недоступний локально
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless',
      },
    },
    worker: { format: 'es' },
    optimizeDeps: { exclude: ['@jsquash/png', '@jsquash/jpeg', '@jsquash/webp', '@jsquash/avif'] },
  },
});
