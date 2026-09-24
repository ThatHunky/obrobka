/**
 * Лічильник використання.
 *
 * Свідомо мінімальний: жодних кук, жодних ідентифікаторів, жодних
 * IP-адрес. Зберігаються тільки суми — скільки разів виконано операцію
 * і скільки разів це сталося в конкретному місті. Місто бере край
 * Cloudflare із запиту й одразу агрегує; сама адреса нікуди не пишеться.
 *
 * Зображення сюди не потрапляють у жодному вигляді — обробка лишається
 * повністю у вкладці.
 */

interface Env {
  DB: D1Database;
}

/** Дозволені операції. Усе інше відкидається, щоб у базу не сипалось сміття. */
const OPS = new Set([
  'convert', 'resize', 'removeBackground', 'outline', 'smartCrop', 'trim',
  'upscale', 'composite', 'paint',
]);

/**
 * Назви операцій Job, що рахуються під іншим ім'ям.
 *
 * Вкладка шле типи операцій як є, а зміна розміру там зветься `fit`.
 * Без цього звичайний прогін «змінити розмір» відфільтровувався до нуля
 * й не рахувався зовсім — навіть у `runs`.
 */
const ALIASES: Readonly<Record<string, string>> = { fit: 'resize' };

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  // Сторінка ізольована між походженнями; без цього браузер відкине відповідь
  'cross-origin-resource-policy': 'same-origin',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function tick(req: Request, env: Env): Promise<Response> {
  let ops: string[] = [];
  try {
    const body = (await req.json()) as { ops?: unknown };
    if (Array.isArray(body.ops)) {
      ops = body.ops
        .filter((o): o is string => typeof o === 'string')
        .map((o) => ALIASES[o] ?? o)
        .filter((o) => OPS.has(o));
    }
  } catch {
    return json({ error: 'bad body' }, 400);
  }
  if (ops.length === 0) return json({ ok: true, counted: 0 });

  const cf = (req as Request & { cf?: IncomingRequestCfProperties }).cf;
  const country = typeof cf?.country === 'string' ? cf.country : 'ZZ';
  const city = typeof cf?.city === 'string' && cf.city.length > 0 ? cf.city : '—';

  const statements = [
    // Один запуск = одна сесія обробки, скільки б операцій у ній не було
    env.DB.prepare(
      'INSERT INTO counters (key, n) VALUES (?1, 1) ' +
      'ON CONFLICT(key) DO UPDATE SET n = n + 1',
    ).bind('runs'),
    env.DB.prepare(
      'INSERT INTO places (country, city, n) VALUES (?1, ?2, 1) ' +
      'ON CONFLICT(country, city) DO UPDATE SET n = n + 1',
    ).bind(country, city),
  ];
  for (const op of new Set(ops)) {
    statements.push(env.DB.prepare(
      'INSERT INTO counters (key, n) VALUES (?1, 1) ' +
      'ON CONFLICT(key) DO UPDATE SET n = n + 1',
    ).bind(`op:${op}`));
  }
  await env.DB.batch(statements);
  return json({ ok: true, counted: ops.length });
}

async function stats(env: Env): Promise<Response> {
  const [counters, places] = await Promise.all([
    env.DB.prepare('SELECT key, n FROM counters').all<{ key: string; n: number }>(),
    env.DB.prepare(
      "SELECT country, city, n FROM places WHERE city <> '—' ORDER BY n DESC LIMIT 8",
    ).all<{ country: string; city: string; n: number }>(),
  ]);

  const byKey = new Map((counters.results ?? []).map((r) => [r.key, r.n]));
  const ops: Record<string, number> = {};
  for (const [k, n] of byKey) if (k.startsWith('op:')) ops[k.slice(3)] = n;

  return json({
    runs: byKey.get('runs') ?? 0,
    ops,
    cities: places.results ?? [],
    // Скільки різних міст побачив край — без переліку
    updated: new Date().toISOString(),
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === '/api/tick' && req.method === 'POST') return tick(req, env);
    if (url.pathname === '/api/stats' && req.method === 'GET') return stats(env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: JSON_HEADERS });

    return json({ error: 'not found' }, 404);
  },
} satisfies ExportedHandler<Env>;
