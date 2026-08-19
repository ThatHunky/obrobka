import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const dist = join(import.meta.dirname, '..', 'dist');
let uk = '';
let en = '';
let headers = '';

beforeAll(async () => {
  uk = await readFile(join(dist, 'index.html'), 'utf8');
  en = await readFile(join(dist, 'en', 'index.html'), 'utf8');
  headers = await readFile(join(dist, '_headers'), 'utf8');
}, 60_000);

describe('збірка сайту', () => {
  it('українська сторінка в корені', () => {
    expect(uk).toContain('lang="uk"');
  });

  it('англійська сторінка під /en/', () => {
    expect(en).toContain('lang="en"');
  });

  it('українська посилається на англійську через hreflang', () => {
    expect(uk).toContain('hreflang="en"');
    expect(uk).toContain('/en/');
  });

  it('x-default вказує на українську', () => {
    expect(uk).toMatch(/hreflang="x-default"[^>]*href="[^"]*obrobka\.dobrovolskyi\.com\.ua\/"/);
  });

  it('заголовки COEP на місці', () => {
    expect(headers).toContain('Cross-Origin-Embedder-Policy: credentialless');
  });
});
