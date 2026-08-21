import { describe, expect, it } from 'vitest';
import { makeZip, poolSize, runBatch, uniqueName, zipLevel } from '../src/lib/batch.js';

describe('poolSize', () => {
  it('з моделлю — рівно один воркер', () => {
    // Чотири сесії U²-Netp коштують 1,2 ГБ і дають лише 1,8×;
    // дві сесії isnet — 2,2 ГБ, за стелею вкладки.
    for (const cores of [1, 4, 8, 16, undefined]) {
      expect(poolSize(true, cores), `ядер ${String(cores)}`).toBe(1);
    }
  });

  it('без моделі лишає ядро на інтерфейс і не перевищує чотирьох', () => {
    expect(poolSize(false, 8)).toBe(4);
    expect(poolSize(false, 16)).toBe(4);
    expect(poolSize(false, 4)).toBe(3);
    expect(poolSize(false, 2)).toBe(1);
  });

  it('ніколи не віддає нуль — навіть на одному ядрі чи без даних', () => {
    expect(poolSize(false, 1)).toBe(1);
    expect(poolSize(false, 0)).toBe(3);
    expect(poolSize(false, undefined)).toBe(3);
  });
});

describe('zipLevel', () => {
  it('PNG тисне, решту складає як є', () => {
    expect(zipLevel('png')).toBe(4);
    for (const f of ['jpeg', 'webp', 'avif'] as const) expect(zipLevel(f)).toBe(0);
  });
});

describe('uniqueName', () => {
  it('міняє розширення на формат', () => {
    expect(uniqueName(new Set(), 'photo.jpg', 'webp')).toBe('photo.webp');
  });

  it('розводить збіги замість того, щоб затирати', () => {
    const taken = new Set<string>();
    expect(uniqueName(taken, 'photo.jpg', 'webp')).toBe('photo.webp');
    expect(uniqueName(taken, 'photo.png', 'webp')).toBe('photo-2.webp');
    expect(uniqueName(taken, 'photo.heic', 'webp')).toBe('photo-3.webp');
  });

  it('прибирає теки з імені', () => {
    expect(uniqueName(new Set(), 'album/2026/photo.jpg', 'png')).toBe('photo.png');
    expect(uniqueName(new Set(), 'C:\\фото\\photo.jpg', 'png')).toBe('photo.png');
  });

  it('файл без розширення й без імені все одно отримує ім’я', () => {
    expect(uniqueName(new Set(), 'clipboard', 'png')).toBe('clipboard.png');
    expect(uniqueName(new Set(), '.hidden', 'png')).toBe('image.png');
  });
});

describe('runBatch', () => {
  const items = Array.from({ length: 12 }, (_, i) => i);

  it('обробляє кожен елемент рівно один раз', async () => {
    const seen: number[] = [];
    await runBatch(items, { concurrency: 4, run: async (i) => { seen.push(i); } });
    expect(seen.sort((a, b) => a - b)).toEqual(items);
  });

  it('не перевищує заданої паралельності', async () => {
    let running = 0;
    let peak = 0;
    await runBatch(items, {
      concurrency: 3,
      run: async () => {
        peak = Math.max(peak, ++running);
        await new Promise((r) => setTimeout(r, 1));
        running--;
      },
    });
    expect(peak).toBe(3);
  });

  it('номери слотів не повторюються між одночасними задачами', async () => {
    const busy = new Set<number>();
    let clash = false;
    await runBatch(items, {
      concurrency: 4,
      run: async (_i, slot) => {
        if (busy.has(slot)) clash = true;
        busy.add(slot);
        await new Promise((r) => setTimeout(r, 1));
        busy.delete(slot);
      },
    });
    expect(clash, 'два файли не мають потрапити в один воркер одночасно').toBe(false);
  });

  it('помилка одного файлу не зупиняє решту', async () => {
    const ok: number[] = [];
    await runBatch(items, {
      concurrency: 2,
      run: async (i) => {
        if (i % 3 === 0) throw new Error('битий файл');
        ok.push(i);
      },
    });
    expect(ok).toHaveLength(8);
  });

  it('прогрес монотонний і рахує завершені', async () => {
    const seen: number[] = [];
    await runBatch(items, {
      concurrency: 4,
      run: async () => { await new Promise((r) => setTimeout(r, 1)); },
      onProgress: (done, total) => { seen.push(done); expect(total).toBe(12); },
    });
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(seen.at(-1)).toBe(12);
    expect(seen).toHaveLength(12);
  });

  it('скасування зупиняє чергу', async () => {
    const controller = new AbortController();
    let processed = 0;
    await runBatch(items, {
      concurrency: 2,
      signal: controller.signal,
      run: async () => {
        processed++;
        if (processed === 4) controller.abort();
        await new Promise((r) => setTimeout(r, 1));
      },
    });
    expect(processed).toBeLessThan(items.length);
  });

  it('порожня черга не зависає', async () => {
    await expect(runBatch([], { concurrency: 4, run: async () => {} })).resolves.toBeUndefined();
  });

  it('не запускає більше слотів, ніж є файлів', async () => {
    let peak = 0;
    let running = 0;
    await runBatch([1, 2], {
      concurrency: 8,
      run: async () => {
        peak = Math.max(peak, ++running);
        await new Promise((r) => setTimeout(r, 1));
        running--;
      },
    });
    expect(peak).toBe(2);
  });
});

describe('makeZip', () => {
  const entries = {
    'a.png': Uint8Array.from({ length: 512 }, (_, i) => i % 7),
    'b.png': Uint8Array.from({ length: 512 }, (_, i) => i % 11),
  };

  it('складає архів із усіма іменами', async () => {
    const blob = await makeZip(entries, 'png');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes[0]).toBe(0x50); // 'PK'
    expect(bytes[1]).toBe(0x4b);
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text).toContain('a.png');
    expect(text).toContain('b.png');
  });

  it('розпаковується назад у ті самі байти', async () => {
    const blob = await makeZip(entries, 'png');
    const { unzipSync } = await import('fflate');
    const back = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(Object.keys(back).sort()).toEqual(['a.png', 'b.png']);
    expect(back['a.png']).toEqual(entries['a.png']);
    expect(back['b.png']).toEqual(entries['b.png']);
  });

  it('стиснення справді залежить від формату', async () => {
    // Однакові дані, різні формати: PNG має стиснутись, WebP — лягти як є.
    const png = await makeZip(entries, 'png');
    const webp = await makeZip(
      { 'a.webp': entries['a.png'], 'b.webp': entries['b.png'] }, 'webp',
    );
    expect(png.size).toBeLessThan(webp.size);
  });

  it('порожній набір дає порожній, але коректний архів', async () => {
    const blob = await makeZip({}, 'png');
    const { unzipSync } = await import('fflate');
    expect(Object.keys(unzipSync(new Uint8Array(await blob.arrayBuffer())))).toEqual([]);
  });
});
