<script lang="ts">
  import type { BatchItem } from '../lib/batch.js';
  import type { Dict } from '../lib/i18n.js';

  const {
    items, done, total, busy, needsModel, t, oncancel, onclear, onzip,
  }: {
    items: readonly BatchItem[];
    done: number;
    total: number;
    busy: boolean;
    needsModel: boolean;
    t: Dict;
    oncancel: () => void;
    onclear: () => void;
    onzip: () => void;
  } = $props();

  const ready = $derived(items.filter((i) => i.status === 'done'));
  const failed = $derived(items.filter((i) => i.status === 'error'));
  const totalSize = $derived(ready.reduce((sum, i) => sum + (i.resultSize ?? 0), 0));

  function size(bytes: number): string {
    return bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(0)} ${t.units.kb}`
      : `${(bytes / 1048576).toFixed(1)} ${t.units.mb}`;
  }
</script>

<section class="batch" data-testid="batch-panel">
  <header>
    <h3>{t.batch.title}</h3>
    <span class="count" data-testid="batch-count">{t.batch.files(items.length)}</span>
    {#if busy}
      <span class="progress" data-testid="batch-progress">{t.batch.processing(done, total)}</span>
    {/if}
  </header>

  <div class="bar" role="progressbar" aria-valuenow={done} aria-valuemin="0" aria-valuemax={total}>
    <span style={`width: ${total === 0 ? 0 : (done / total) * 100}%`}></span>
  </div>

  <ul>
    {#each items as item (item.id)}
      <li class={item.status} data-testid="batch-item">
        <span class="name" title={item.name}>{item.name}</span>
        <span class="status">
          {#if item.status === 'error'}
            <span class="err" title={item.error}>{t.batch.statuses.error}</span>
          {:else if item.status === 'done'}
            {size(item.resultSize ?? 0)}
          {:else}
            {t.batch.statuses[item.status]}
          {/if}
        </span>
      </li>
    {/each}
  </ul>

  {#if failed.length > 0}
    <p class="failed" data-testid="batch-failed">
      {t.batch.failed(failed.length)}: {failed[0]?.error}
    </p>
  {/if}

  {#if needsModel}
    <p class="note">{t.batch.modelIsSerial}</p>
  {/if}

  <div class="actions">
    {#if busy}
      <button type="button" class="btn" data-testid="batch-cancel" onclick={oncancel}>
        {t.batch.cancel}
      </button>
    {:else}
      <button type="button" class="btn" data-testid="batch-clear" onclick={onclear}>
        {t.batch.clear}
      </button>
    {/if}

    <!-- Кнопка архіву з'являється лише коли є що складати -->
    {#if ready.length > 0}
      <button type="button" class="btn btn-accent" data-testid="batch-zip" onclick={onzip}>
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M12 16V4m0 12-5-5m5 5 5-5" /><path d="M4 18v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1" />
        </svg>
        {t.batch.downloadZip}
        <em>{size(totalSize)} {t.batch.total}</em>
      </button>
    {/if}
  </div>

  <p class="note">{t.batch.settingsApply}</p>
</section>

<style>
  .batch {
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    background: var(--bg-raised);
    padding: 0.85rem 1rem;
  }
  header { display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap; }
  h3 {
    margin: 0;
    font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase;
    color: var(--fg-muted);
  }
  .count { font-size: 0.8rem; color: var(--fg-faint); }
  .progress { margin-inline-start: auto; font-size: 0.8rem; color: var(--accent-text); }

  .bar {
    margin: 0.6rem 0; height: 4px; border-radius: 999px;
    background: var(--bg-sunken); overflow: hidden;
  }
  .bar span {
    display: block; height: 100%;
    background: var(--accent-bg);
    transition: width var(--dur) var(--ease-out);
  }

  ul {
    list-style: none; margin: 0; padding: 0;
    max-height: 14rem; overflow-y: auto;
    font-size: 0.82rem;
  }
  li {
    display: flex; gap: 0.6rem; align-items: baseline;
    padding: 0.28rem 0;
    border-bottom: 1px solid color-mix(in oklab, var(--line) 55%, transparent);
  }
  li:last-child { border-bottom: 0; }
  .name {
    flex: 1; min-width: 0;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .status { flex: none; font-family: var(--font-mono); font-size: 0.74rem; color: var(--fg-faint); }
  li.working .status { color: var(--accent-text); }
  li.done .status { color: var(--fg-muted); }
  .err { color: var(--accent-text); }
  li.error .name { opacity: 0.65; }

  .failed { margin: 0.5rem 0 0; font-size: 0.78rem; color: var(--accent-text); }
  .note { margin: 0.5rem 0 0; font-size: 0.76rem; line-height: 1.5; color: var(--fg-faint); }
  .actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.7rem; }
  .actions em { font-style: normal; opacity: 0.8; font-size: 0.76rem; }
</style>
