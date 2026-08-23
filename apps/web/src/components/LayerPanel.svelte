<script lang="ts">
  import type { BlendMode } from '@obrobka/core';
  import type { UiLayer } from '../lib/worker-api.js';
  import type { Dict } from '../lib/i18n.js';

  /**
   * Список шарів і налаштування обраного.
   *
   * Список показується згори вниз від найвищого шару, як у будь-якому
   * редакторі, — тобто у зворотному порядку до масиву, який задає
   * накладання знизу вгору.
   */
  let { layers, selected, t, onadd, onpatch, onremove, onmove, onselect }: {
    layers: readonly UiLayer[];
    selected: number | null;
    t: Dict;
    onadd: (files: readonly File[]) => void;
    onpatch: (id: number, patch: Partial<UiLayer>) => void;
    onremove: (id: number) => void;
    onmove: (id: number, delta: -1 | 1) => void;
    onselect: (id: number | null) => void;
  } = $props();

  const BLENDS: BlendMode[] = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten'];
  const top = $derived([...layers].reverse());
  const current = $derived(layers.find((l) => l.id === selected) ?? null);
</script>

<fieldset class="layers">
  <legend>{t.layers.section}</legend>

  <label class="add btn">
    {t.layers.add}
    <input
      type="file"
      multiple
      accept="image/png,image/jpeg,image/webp,image/avif"
      data-testid="layer-add"
      onchange={(e) => {
        const files = Array.from(e.currentTarget.files ?? []);
        e.currentTarget.value = '';
        if (files.length > 0) onadd(files);
      }}
    />
  </label>

  {#if layers.length === 0}
    <p class="empty">{t.layers.empty}</p>
  {:else}
    <ul class="list">
      {#each top as l (l.id)}
        <li class="item" class:on={l.id === selected}>
          <button
            type="button"
            class="pick"
            data-testid={`layer-${l.id}`}
            onclick={() => onselect(l.id === selected ? null : l.id)}
          >
            <img class="thumb checker" src={l.thumb} alt="" />
            <span class="name">{l.name}</span>
          </button>
          <button type="button" class="icon" title={l.hidden ? t.layers.show : t.layers.hide}
                  aria-label={l.hidden ? t.layers.show : t.layers.hide}
                  data-testid={`layer-hide-${l.id}`}
                  onclick={() => onpatch(l.id, { hidden: !l.hidden })}
          >{l.hidden ? '○' : '●'}</button>
          <button type="button" class="icon" title={t.layers.up} aria-label={t.layers.up}
                  data-testid={`layer-up-${l.id}`}
                  onclick={() => onmove(l.id, 1)}>↑</button>
          <button type="button" class="icon" title={t.layers.down} aria-label={t.layers.down}
                  data-testid={`layer-down-${l.id}`}
                  onclick={() => onmove(l.id, -1)}>↓</button>
          <button type="button" class="icon" title={t.layers.remove} aria-label={t.layers.remove}
                  data-testid={`layer-remove-${l.id}`}
                  onclick={() => onremove(l.id)}>✕</button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if current !== null}
    <div class="controls">
      <label class="field">
        <span>{t.layers.size} <em>{Math.round(current.scale * 100)} %</em></span>
        <input type="range" min="2" max="200" value={Math.round(current.scale * 100)}
               data-testid="layer-scale"
               oninput={(e) => onpatch(current.id, {
                 scale: e.currentTarget.valueAsNumber / 100,
               })} />
      </label>
      <label class="field">
        <span>{t.layers.opacity} <em>{Math.round((current.opacity ?? 1) * 100)} %</em></span>
        <input type="range" min="0" max="100" value={Math.round((current.opacity ?? 1) * 100)}
               data-testid="layer-opacity"
               oninput={(e) => onpatch(current.id, {
                 opacity: e.currentTarget.valueAsNumber / 100,
               })} />
      </label>
      <label class="field">
        <span>{t.layers.rotation} <em>{Math.round(current.rotation ?? 0)}°</em></span>
        <input type="range" min="-180" max="180" value={Math.round(current.rotation ?? 0)}
               data-testid="layer-rotation"
               oninput={(e) => onpatch(current.id, {
                 rotation: e.currentTarget.valueAsNumber,
               })} />
      </label>
      <label class="field">
        <span>{t.layers.blend}</span>
        <select value={current.blend ?? 'normal'} data-testid="layer-blend"
                onchange={(e) => onpatch(current.id, {
                  blend: e.currentTarget.value as BlendMode,
                })}>
          {#each BLENDS as m (m)}
            <option value={m}>{t.layers.modes[m]}</option>
          {/each}
        </select>
      </label>
    </div>
  {/if}
</fieldset>

<style>
  .layers { border: 0; padding: 0; margin: 0; min-width: 0; display: grid; gap: 0.6rem; }
  .layers legend {
    padding: 0; margin-bottom: 0.5rem;
    font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase; color: var(--fg-muted);
  }
  .add { position: relative; overflow: hidden; justify-self: start; }
  .add input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .empty { font-size: 0.8rem; color: var(--fg-faint); max-width: 44ch; }

  .list { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.35rem; }
  .item {
    display: flex; align-items: center; gap: 0.35rem;
    padding: 0.3rem 0.4rem;
    border: 1px solid var(--line); border-radius: var(--r-sm);
    background: var(--bg-sunken);
  }
  .item.on { border-color: var(--accent); }
  .pick {
    display: flex; align-items: center; gap: 0.5rem;
    flex: 1; min-width: 0;
    border: 0; background: none; cursor: pointer; text-align: start;
  }
  .thumb {
    width: 2rem; height: 2rem; object-fit: contain;
    border-radius: 4px; --checker-size: 8px; flex: none;
  }
  .name {
    font-size: 0.8rem; overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap;
  }
  .icon {
    width: 1.7rem; height: 1.7rem; flex: none;
    display: grid; place-items: center;
    border: 1px solid var(--line); border-radius: var(--r-sm);
    background: var(--bg-raised); cursor: pointer; line-height: 1;
    font-size: 0.75rem;
  }
  .icon:hover { border-color: var(--accent); }

  .controls {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.8rem;
  }
  .field { display: grid; gap: 0.35rem; }
  .field > span {
    font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase; color: var(--fg-muted);
  }
  .field > span em {
    font-style: normal; font-family: var(--font-mono); color: var(--accent-text);
  }
  .field input[type='range'] { accent-color: var(--accent-bg); width: 100%; }
  .field select {
    padding: 0.5rem 0.6rem;
    border: 1px solid var(--line-strong); border-radius: var(--r-sm);
    background: var(--bg-sunken);
  }
</style>
