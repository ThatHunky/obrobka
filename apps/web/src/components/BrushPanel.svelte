<script lang="ts">
  import type { Dict } from '../lib/i18n.js';

  /**
   * Керування пензлем.
   *
   * Сам малюнок живе у сцені — тут лише те, чим малювати. Панель
   * навмисно не знає ні про маски, ні про полотна: вона перемикає режим
   * і просить очистити, а решта — справа сцени й віджета.
   */
  let { on, mode, size, dirty, t, onchange, onclear }: {
    on: boolean;
    mode: 'erase' | 'restore';
    size: number;
    /** Чи є вже мазки: поки їх немає, очищати нема чого. */
    dirty: boolean;
    t: Dict;
    onchange: (p: { on?: boolean; mode?: 'erase' | 'restore'; size?: number }) => void;
    onclear: () => void;
  } = $props();
</script>

<fieldset class="brush">
  <legend>{t.brush.section}</legend>

  <!-- Мітка, а не сам input: він схований, тож клікати можна лише по ній -->
  <label class="switch" data-testid="brush-toggle">
    <input
      type="checkbox"
      checked={on}
      onchange={(e) => onchange({ on: e.currentTarget.checked })}
    />
    <span class="track" aria-hidden="true"></span>
    {t.brush.on}
  </label>

  {#if on}
    <div class="row">
      {#each [
        { id: 'erase', label: t.brush.erase },
        { id: 'restore', label: t.brush.restore },
      ] as const as o (o.id)}
        <button
          type="button"
          class="chip"
          class:on={mode === o.id}
          aria-pressed={mode === o.id}
          data-testid={`brush-${o.id}`}
          onclick={() => onchange({ mode: o.id })}
        >{o.label}</button>
      {/each}

      <button
        type="button"
        class="chip clear"
        disabled={!dirty}
        data-testid="brush-clear"
        onclick={onclear}
      >{t.brush.clear}</button>
    </div>

    <label class="field">
      <span>{t.brush.size} <em>{size} px</em></span>
      <input
        type="range" min="4" max="160" value={size}
        data-testid="brush-size"
        oninput={(e) => onchange({ size: e.currentTarget.valueAsNumber })}
      />
    </label>
  {/if}
</fieldset>

<style>
  .brush { border: 0; padding: 0; margin: 0; min-width: 0; display: grid; gap: 0.6rem; }
  .brush legend {
    padding: 0; margin-bottom: 0.5rem;
    font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase; color: var(--fg-muted);
  }

  .switch {
    display: inline-flex; align-items: center; gap: 0.5rem;
    font-size: 0.88rem; cursor: pointer; user-select: none;
  }
  .switch input[type='checkbox'] { position: absolute; opacity: 0; width: 0; height: 0; }
  .track {
    width: 38px; height: 22px; border-radius: 999px;
    background: var(--line-strong); position: relative; flex: none;
    transition: background-color var(--dur) var(--ease-out);
  }
  .track::after {
    content: ''; position: absolute; top: 3px; left: 3px;
    width: 16px; height: 16px; border-radius: 50%;
    background: var(--bg-raised); box-shadow: var(--shadow-sm);
    transition: transform var(--dur) var(--ease-spring);
  }
  .switch input:checked + .track { background: var(--accent-bg); }
  .switch input:checked + .track::after { transform: translateX(16px); }
  .switch input:focus-visible + .track { box-shadow: 0 0 0 3px var(--accent-glow); }

  .row { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .chip {
    padding: 0.45rem 0.9rem;
    border: 1px solid var(--line); border-radius: 999px;
    background: var(--bg-raised);
    font-size: 0.85rem; font-weight: 600; cursor: pointer;
    transition: border-color var(--dur) var(--ease-out),
                background-color var(--dur) var(--ease-out);
  }
  .chip:hover:not(:disabled) { border-color: var(--line-strong); }
  .chip:disabled { opacity: 0.45; cursor: not-allowed; }
  .chip.on {
    border-color: var(--accent);
    background: color-mix(in oklab, var(--accent-bg) 14%, var(--bg-raised));
  }
  .clear { margin-inline-start: auto; }

  .field { display: grid; gap: 0.35rem; min-width: 0; max-width: 18rem; }
  .field > span {
    font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase; color: var(--fg-muted);
  }
  .field > span em {
    font-style: normal; font-family: var(--font-mono); color: var(--accent-text);
  }
  .field input[type='range'] { accent-color: var(--accent-bg); width: 100%; }
</style>
