<script lang="ts">
  import { cachedModels, clearModels } from '@obrobka/onnx-web/cache';
  import { MODELS, UPSCALERS } from '@obrobka/models';
  import { dict, type Locale } from '../lib/i18n.js';

  /**
   * Що займає місце й як це прибрати.
   *
   * Моделі важать від 4,4 до 84 МБ і лишаються в браузері назавжди —
   * саме заради того, щоб не качатись удруге. Але це чуже місце на
   * чужому пристрої, і людина має бачити, скільки його зайнято,
   * без походу в налаштування браузера.
   */
  const { locale = 'uk' }: { locale?: Locale } = $props();
  const t = $derived(dict(locale));

  interface Row { url: string; name: string; bytes: number }

  let rows = $state<Row[] | null>(null);
  let shellCached = $state<boolean | null>(null);
  let quota = $state<{ usage: number; quota: number } | null>(null);
  let busy = $state(false);
  let error = $state('');

  /** Людська назва замість імені файлу, коли ми її знаємо. */
  function nameOf(url: string): string {
    const file = url.split('/').at(-1) ?? url;
    const model = MODELS.find((m) => m.file === file);
    if (model !== undefined) return `${t.tiers[model.id].label} · ${file}`;
    const up = UPSCALERS.find((u) => u.file === file);
    if (up !== undefined) return `${up.factor === 2 ? t.upscale.x2 : t.upscale.x4} · ${file}`;
    return file;
  }

  function mb(bytes: number): string {
    return `${(bytes / 1_048_576).toFixed(1)} ${t.units.mb}`;
  }

  async function load(): Promise<void> {
    error = '';
    try {
      const cached = await cachedModels();
      rows = cached
        .map((c) => ({ url: c.url, name: nameOf(c.url), bytes: c.bytes }))
        .sort((a, b) => b.bytes - a.bytes);

      // Оболонка кешується сервісворкером в окремому кеші з версією в імені.
      const keys = await caches.keys();
      shellCached = keys.some((k) => k.startsWith('obrobka-shell-'));

      if (navigator.storage?.estimate !== undefined) {
        const est = await navigator.storage.estimate();
        quota = { usage: est.usage ?? 0, quota: est.quota ?? 0 };
      }
    } catch (e) {
      error = e instanceof Error ? e.message : t.storage.errRead;
    }
  }

  async function clear(): Promise<void> {
    busy = true;
    try {
      await clearModels();
      await load();
    } catch (e) {
      error = e instanceof Error ? e.message : t.storage.errClear;
    } finally {
      busy = false;
    }
  }

  $effect(() => { void load(); });

  const total = $derived((rows ?? []).reduce((s, r) => s + r.bytes, 0));
</script>

<section class="storage card" data-testid="storage">
  {#if rows === null}
    <p class="muted">{t.storage.reading}</p>
  {:else if rows.length === 0}
    <p class="muted" data-testid="storage-empty">{t.storage.empty}</p>
  {:else}
    <ul>
      {#each rows as row (row.url)}
        <li>
          <span class="name">{row.name}</span>
          <span class="size">{mb(row.bytes)}</span>
        </li>
      {/each}
    </ul>
    <p class="total">
      <strong>{t.storage.total}</strong>
      <span data-testid="storage-total">{mb(total)}</span>
    </p>
    <button type="button" class="btn" disabled={busy} data-testid="storage-clear" onclick={clear}>
      {busy ? t.storage.clearing : t.storage.clear}
    </button>
  {/if}

  {#if shellCached !== null}
    <p class="muted small" data-testid="storage-offline">
      {shellCached ? t.storage.offlineReady : t.storage.offlineNot}
    </p>
  {/if}

  {#if quota !== null && quota.quota > 0}
    <p class="muted small">
      {t.storage.quota(mb(quota.usage), mb(quota.quota))}
    </p>
  {/if}

  {#if error !== ''}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
  .storage { display: grid; gap: 0.9rem; padding: clamp(1rem, 3vw, 1.5rem); }

  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.3rem; }
  li {
    display: flex; gap: 0.8rem; align-items: baseline;
    padding: 0.4rem 0;
    border-bottom: 1px solid color-mix(in oklab, var(--line) 55%, transparent);
  }
  li:last-child { border-bottom: 0; }
  .name {
    flex: 1; min-width: 0;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-size: 0.9rem;
  }
  .size { flex: none; font-family: var(--font-mono); font-size: 0.8rem; color: var(--fg-muted); }

  .total { display: flex; gap: 0.6rem; margin: 0; font-size: 0.9rem; }
  .total span { font-family: var(--font-mono); }

  .muted { margin: 0; color: var(--fg-muted); font-size: 0.9rem; }
  .small { font-size: 0.8rem; }
  .error { margin: 0; color: var(--danger); font-size: 0.85rem; }
  button { justify-self: start; }
</style>
