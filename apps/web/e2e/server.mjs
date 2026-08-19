/**
 * Статичний сервер для e2e.
 *
 * `astro preview` не застосовує public/_headers — це фіча Cloudflare Pages.
 * Без COOP/COEP сторінка не буде crossOriginIsolated, і тест, який це
 * перевіряє, був би беззмістовним. Тому сервер читає той самий _headers
 * і віддає заголовки так само, як їх віддасть продакшн.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';

const DIST = resolve(import.meta.dirname, '..', 'dist');
const PORT = Number(process.argv[2] ?? 4488);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

/** Розбирає public/_headers у список [глоб, заголовки]. */
async function parseHeaders() {
  let text = '';
  try {
    text = await readFile(join(DIST, '_headers'), 'utf8');
  } catch {
    return [];
  }
  const rules = [];
  let current = null;
  for (const raw of text.split('\n')) {
    if (raw.trim() === '' || raw.trimStart().startsWith('#')) continue;
    if (!raw.startsWith(' ') && !raw.startsWith('\t')) {
      current = { pattern: raw.trim(), headers: {} };
      rules.push(current);
      continue;
    }
    const i = raw.indexOf(':');
    if (i > 0 && current !== null) {
      current.headers[raw.slice(0, i).trim()] = raw.slice(i + 1).trim();
    }
  }
  return rules;
}

function matches(pattern, path) {
  const rx = new RegExp('^' + pattern.split('*').map((s) =>
    s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
  return rx.test(path);
}

const rules = await parseHeaders();

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith('/')) path += 'index.html';

  const file = join(DIST, path);
  if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }

  let body;
  try {
    await stat(file);
    body = await readFile(file);
  } catch {
    try {
      body = await readFile(join(DIST, path, 'index.html'));
      path = join(path, 'index.html');
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('404');
      return;
    }
  }

  const headers = { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' };
  for (const rule of rules) {
    if (matches(rule.pattern, path)) Object.assign(headers, rule.headers);
  }
  res.writeHead(200, headers).end(body);
}).listen(PORT, () => console.log(`e2e-сервер на http://localhost:${PORT}`));
