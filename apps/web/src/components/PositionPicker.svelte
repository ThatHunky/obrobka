<script lang="ts">
  import { POSITIONS, type Position } from '@obrobka/core';
  import type { Dict } from '../lib/i18n.js';

  /**
   * Прив'язка вмісту в кадрі — сітка 3×3, як у будь-якому редакторі.
   *
   * Має сенс лише для contain і cover: у перших полях вирішує, куди
   * притиснути зображення, у другому — яку частину лишити. Для fill,
   * inside та outside прив'язка ні на що не впливає, тож компонент
   * там просто не показується.
   */
  let { value = $bindable<Position>('center'), t, onchange }:
    { value: Position; t: Dict; onchange?: () => void } = $props();
</script>

<fieldset class="anchor">
  <legend>{t.crop.anchor}</legend>
  <div class="grid" role="radiogroup" aria-label={t.crop.anchor}>
    {#each POSITIONS as p (p)}
      <button
        type="button"
        role="radio"
        aria-checked={value === p}
        aria-label={t.positions[p]}
        title={t.positions[p]}
        class:on={value === p}
        data-testid={`anchor-${p}`}
        onclick={() => { value = p; onchange?.(); }}
      ><span></span></button>
    {/each}
  </div>
  <p class="hint">{t.crop.anchorHint}</p>
</fieldset>

<style>
  .anchor { border: 0; padding: 0; margin: 0; min-width: 0; }
  legend {
    padding: 0; margin-bottom: 0.5rem;
    font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase; color: var(--fg-muted);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1.6rem);
    gap: 3px;
    padding: 4px;
    width: max-content;
    border: 1px solid var(--line-strong);
    border-radius: var(--r-sm);
    background: var(--bg-sunken);
  }
  button {
    width: 1.6rem; height: 1.6rem;
    display: grid; place-items: center;
    border: 0; border-radius: 4px;
    background: transparent;
    cursor: pointer;
    transition: background-color var(--dur-fast) var(--ease-out);
  }
  button:hover { background: color-mix(in oklab, var(--accent-bg) 22%, transparent); }
  button span {
    width: 7px; height: 7px; border-radius: 2px;
    background: var(--fg-faint);
    transition: transform var(--dur) var(--ease-spring), background-color var(--dur) var(--ease-out);
  }
  button.on { background: var(--accent-bg); }
  button.on span { background: var(--accent-fg); transform: scale(1.35); }
  .hint { margin-top: 0.4rem; font-size: 0.78rem; color: var(--fg-faint); max-width: 40ch; }
</style>
