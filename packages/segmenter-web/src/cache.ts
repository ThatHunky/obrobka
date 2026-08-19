const CACHE = 'obrobka-models-v1';

/**
 * Дає байти моделі, кешуючи їх між сесіями.
 *
 * Cache Storage, а не IndexedDB: моделі — це саме HTTP-відповіді, тож
 * сторінка «мої моделі» зможе показати й почистити кеш без окремого обліку.
 */
export async function fetchModel(
  url: string, onProgress?: (fraction: number) => void,
): Promise<ArrayBuffer> {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(url);
  if (hit !== undefined) {
    onProgress?.(1);
    return hit.arrayBuffer();
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Не вдалося завантажити модель: HTTP ${res.status}`);

  const total = Number(res.headers.get('content-length') ?? 0);
  const reader = res.body?.getReader();
  if (reader === undefined) throw new Error('Порожня відповідь при завантаженні моделі');

  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total > 0) onProgress?.(received / total);
  }

  const bytes = new Uint8Array(received);
  let at = 0;
  for (const c of chunks) { bytes.set(c, at); at += c.length; }

  // Кладемо в кеш власноруч зібрану відповідь: оригінальний потік уже вичитаний
  await cache.put(url, new Response(bytes, {
    headers: {
      'content-type': 'application/octet-stream',
      'content-length': String(received),
    },
  }));
  onProgress?.(1);
  return bytes.buffer as ArrayBuffer;
}

/** Скільки місця займають закешовані моделі. */
export async function cachedModels(): Promise<{ url: string; bytes: number }[]> {
  const cache = await caches.open(CACHE);
  const out: { url: string; bytes: number }[] = [];
  for (const req of await cache.keys()) {
    const res = await cache.match(req);
    out.push({ url: req.url, bytes: Number(res?.headers.get('content-length') ?? 0) });
  }
  return out;
}

export async function clearModels(): Promise<void> {
  await caches.delete(CACHE);
}
