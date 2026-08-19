<script lang="ts">
  import { MODELS, type Tier } from '@obrobka/models';

  let { value = $bindable<Tier>('fast'), progress = 0, provider = null, onchange }:
    { value: Tier; progress?: number; provider?: string | null; onchange?: () => void } = $props();

  function mb(bytes: number): string {
    return `${(bytes / 1_048_576).toFixed(1)} МБ`;
  }
</script>

<fieldset class="tiers">
  <legend>Модель</legend>
  <div class="row">
    {#each MODELS as m (m.id)}
      <button
        type="button"
        class="tier"
        class:on={value === m.id}
        aria-pressed={value === m.id}
        data-testid={`tier-${m.id}`}
        onclick={() => { value = m.id; onchange?.(); }}
      >
        <span class="label">{m.label}</span>
        <span class="scope">{m.scope}</span>
        <span class="size">{mb(m.bytes)}</span>
      </button>
    {/each}
  </div>

  {#if progress > 0 && progress < 1}
    <div class="bar" role="progressbar" aria-valuenow={Math.round(progress * 100)}
         aria-valuemin="0" aria-valuemax="100">
      <span style={`width: ${progress * 100}%`}></span>
    </div>
    <p class="note">Завантажую модель — {Math.round(progress * 100)} %</p>
  {:else if provider === 'wasm'}
    <p class="note warn" data-testid="provider">
      WebGPU недоступний — рахую на процесорі. Це помітно повільніше.
    </p>
  {:else if provider === 'webgpu'}
    <p class="note ok" data-testid="provider">Рахую на відеокарті</p>
  {/if}
</fieldset>

<style>
  .tiers { border: 0; padding: 0; margin: 0; min-width: 0; }
  legend {
    padding: 0; margin-bottom: 0.5rem;
    font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase;
    color: var(--fg-muted);
  }
  .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: 0.5rem; }

  .tier {
    display: grid; gap: 0.15rem; text-align: start;
    padding: 0.7rem 0.85rem;
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    background: var(--bg-raised);
    cursor: pointer;
    transition: transform var(--dur-fast) var(--ease-spring),
                border-color var(--dur) var(--ease-out);
  }
  .tier:hover { transform: translateY(-2px); border-color: var(--line-strong); }
  .tier.on {
    border-color: var(--accent);
    background: color-mix(in oklab, var(--accent-bg) 12%, var(--bg-raised));
    box-shadow: 0 0 0 1px var(--accent), 0 6px 18px var(--accent-glow);
  }
  .label { font-weight: 600; font-size: 0.9rem; }
  .scope { font-size: 0.75rem; color: var(--fg-muted); }
  .size { font-family: var(--font-mono); font-size: 0.72rem; color: var(--fg-faint); }
  .tier.on .size { color: var(--accent); }

  .bar {
    margin-top: 0.6rem; height: 4px; border-radius: 999px;
    background: var(--bg-sunken); overflow: hidden;
  }
  .bar span {
    display: block; height: 100%;
    background: var(--accent-bg);
    transition: width var(--dur) var(--ease-out);
  }
  .note { margin-top: 0.4rem; font-size: 0.78rem; color: var(--fg-faint); }
  .note.warn { color: var(--gold-600); }
  .note.ok { color: var(--fg-muted); }
</style>
