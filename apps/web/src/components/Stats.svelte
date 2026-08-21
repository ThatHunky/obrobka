<script lang="ts">
  import { dict, type Locale } from '../lib/i18n.js';

  const { locale = 'uk' }: { locale?: Locale } = $props();
  const t = $derived(dict(locale));

  interface Payload {
    runs: number;
    ops: Record<string, number>;
    cities: { country: string; city: string; n: number }[];
  }

  let data = $state<Payload | null>(null);
  let shown = $state(0);

  /** Прапорець країни з коду ISO — два символи-індикатори, без картинок. */
  function flag(code: string): string {
    if (!/^[A-Z]{2}$/.test(code)) return '🏳️';
    return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
  }

  async function load(): Promise<void> {
    try {
      const res = await fetch('/api/stats', { headers: { accept: 'application/json' } });
      if (!res.ok) return;
      data = (await res.json()) as Payload;
    } catch { /* лічильник не критичний — мовчимо */ }
  }

  /** Число доїжджає до значення, а не з'являється стрибком. */
  $effect(() => {
    const target = data?.runs ?? 0;
    if (target === 0) { shown = 0; return; }
    const started = performance.now();
    const from = shown;
    let raf = 0;
    const step = (now: number): void => {
      const k = Math.min(1, (now - started) / 900);
      shown = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  });

  $effect(() => {
    void load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  });

  const topOps = $derived(
    Object.entries(data?.ops ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 4),
  );
</script>

<section class="stats wrap" aria-labelledby="stats-title">
  <h2 id="stats-title">{t.stats.title}</h2>

  {#if data === null || data.runs === 0}
    <p class="empty">{t.stats.empty}</p>
  {:else}
    <div class="grid">
      <div class="big">
        <strong data-testid="stats-runs">{shown.toLocaleString(locale)}</strong>
        <span>{t.stats.runs}</span>
      </div>

      <ul class="ops">
        {#each topOps as [op, n] (op)}
          <li>
            <span class="n">{n.toLocaleString(locale)}</span>
            <span class="lbl">{t.stats.ops[op] ?? op}</span>
          </li>
        {/each}
      </ul>

      {#if data.cities.length > 0}
        <div class="cities">
          <h3>{t.stats.cities}</h3>
          <ul>
            {#each data.cities as c (c.country + c.city)}
              <li>
                <span aria-hidden="true">{flag(c.country)}</span>
                <span class="city">{c.city}</span>
                <span class="bar" style={`--w:${(100 * c.n) / data.cities[0]!.n}%`}></span>
                <span class="n">{c.n}</span>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  {/if}

  <p class="note">{t.stats.note}</p>
</section>

<style>
  .stats { display: grid; gap: 1rem; margin-top: 4rem; }
  .empty { color: var(--fg-faint); }

  .grid { display: grid; gap: 1.6rem; align-items: start; }
  @media (min-width: 52rem) { .grid { grid-template-columns: auto 1fr 1.2fr; gap: 2.4rem; } }

  .big { display: grid; }
  .big strong {
    font-family: var(--font-display);
    font-size: clamp(2.6rem, 2rem + 3vw, 4rem);
    line-height: 1;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
    background: linear-gradient(105deg, var(--accent) 20%, var(--violet-400) 95%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .big span { font-size: 0.85rem; color: var(--fg-muted); }

  ul { list-style: none; padding: 0; margin: 0; }
  .ops { display: grid; gap: 0.35rem; align-content: start; }
  .ops li { display: flex; gap: 0.6rem; align-items: baseline; font-size: 0.9rem; }
  .ops .n {
    font-family: var(--font-mono); font-weight: 600; color: var(--fg);
    font-variant-numeric: tabular-nums; min-width: 3ch; text-align: end;
  }
  .ops .lbl { color: var(--fg-muted); }

  .cities h3 {
    font-size: 0.78rem; font-weight: 600; letter-spacing: 0.04em;
    text-transform: uppercase; color: var(--fg-muted); margin-bottom: 0.5rem;
  }
  .cities ul { display: grid; gap: 0.3rem; }
  .cities li {
    display: grid; grid-template-columns: 1.4rem minmax(4rem, 9rem) 1fr auto;
    gap: 0.55rem; align-items: center; font-size: 0.85rem;
  }
  .city { color: var(--fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar {
    height: 5px; border-radius: 999px;
    background: linear-gradient(90deg, var(--accent-bg), var(--violet-400));
    width: var(--w); min-width: 4px;
    animation: grow 700ms var(--ease-out) both;
  }
  @keyframes grow { from { width: 0; } }
  .cities .n {
    font-family: var(--font-mono); font-size: 0.75rem; color: var(--fg-faint);
    font-variant-numeric: tabular-nums;
  }

  .note { font-size: 0.78rem; color: var(--fg-faint); max-width: 62ch; }
</style>
