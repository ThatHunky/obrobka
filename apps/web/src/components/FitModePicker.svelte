<script lang="ts">
  import type { FitMode } from '@obrobka/core';
  import type { Dict } from '../lib/i18n.js';

  /**
   * Вибір режиму діаграмами, а не списком.
   *
   * Кожна іконка малюється окремо під свою поведінку: суцільна заливка —
   * те, що лишиться у результаті; напівпрозоре за рамкою — те, що
   * обріжеться; штрихована рамка — запитаний кадр, коли результат
   * навмисно має інший розмір.
   */
  let { value = $bindable<FitMode>('contain'), t, onchange }:
    { value: FitMode; t: Dict; onchange?: () => void } = $props();

  const order: FitMode[] = ['contain', 'cover', 'fill', 'inside', 'outside'];
  const options = $derived(order.map((id) => ({
    id, label: t.modes[id]!.label, hint: t.modes[id]!.hint,
  })));

  function pick(id: FitMode): void {
    value = id;
    onchange?.();
  }
</script>

<fieldset class="picker">
  <legend>{t.fitHow}</legend>
  <div class="row">
    {#each options as o (o.id)}
      <button
        type="button"
        class="opt"
        class:on={value === o.id}
        aria-pressed={value === o.id}
        title={o.hint}
        data-testid={`fit-${o.id}`}
        onclick={() => pick(o.id)}
      >
        <svg viewBox="0 0 44 44" aria-hidden="true">
          <defs>
            <clipPath id={`f-${o.id}`}><rect x="4" y="4" width="36" height="36" rx="4" /></clipPath>
          </defs>

          {#if o.id === 'contain'}
            <!-- Кадр із прозорими полями зверху й знизу -->
            <rect class="bed" x="4" y="4" width="36" height="36" rx="4" />
            <rect class="shot" x="4" y="15" width="36" height="14" />
            <rect class="frame" x="4" y="4" width="36" height="36" rx="4" />

          {:else if o.id === 'cover'}
            <!-- Ширше за кадр: усередині суцільне, зовні — обрізане -->
            <rect class="ghost-fill" x="-4" y="4" width="52" height="36" />
            <g clip-path={`url(#f-${o.id})`}>
              <rect class="shot" x="-4" y="4" width="52" height="36" />
            </g>
            <rect class="frame" x="4" y="4" width="36" height="36" rx="4" />
            <path class="cut" d="M4 2v40M40 2v40" />

          {:else if o.id === 'fill'}
            <!-- Кадр заповнено, стрілки показують спотворення -->
            <g clip-path={`url(#f-${o.id})`}>
              <rect class="shot" x="4" y="4" width="36" height="36" />
            </g>
            <rect class="frame" x="4" y="4" width="36" height="36" rx="4" />
            <path class="arrow" d="M22 13V7m0 0-2.5 2.5M22 7l2.5 2.5M22 31v6m0 0-2.5-2.5M22 37l2.5-2.5" />

          {:else if o.id === 'inside'}
            <!-- Штрихований — запитаний кадр, суцільний — менший результат -->
            <rect class="asked" x="4" y="4" width="36" height="36" rx="4" />
            <rect class="shot" x="7" y="15" width="30" height="14" rx="2" />

          {:else}
            <!-- Результат більший за запитаний кадр -->
            <rect class="shot" x="2" y="2" width="40" height="40" rx="3" />
            <rect class="asked" x="10" y="10" width="24" height="24" rx="3" />
          {/if}
        </svg>
        <span class="name">{o.label}</span>
      </button>
    {/each}
  </div>
  <p class="hint">{options.find((o) => o.id === value)?.hint}</p>
</fieldset>

<style>
  .picker { border: 0; padding: 0; margin: 0; min-width: 0; }
  legend {
    padding: 0;
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--fg-muted);
    margin-bottom: 0.5rem;
  }

  .row {
    display: grid;
    /*
     * 78, а не 88: у двоколонковій розкладці віджета на цю сітку
     * лишається близько 456 px, і при 88 п'ять режимів ламались на 4+1 —
     * «Покрити» звисало саме в другий рядок. Іконка тут 44 px, тож
     * вужча клітинка нічого не тисне.
     */
    grid-template-columns: repeat(auto-fit, minmax(78px, 1fr));
    gap: 0.5rem;
  }

  .opt {
    display: grid;
    justify-items: center;
    gap: 0.35rem;
    padding: 0.6rem 0.3rem;
    background: var(--bg-raised);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    cursor: pointer;
    transition:
      transform var(--dur-fast) var(--ease-spring),
      border-color var(--dur) var(--ease-out),
      background-color var(--dur) var(--ease-out);
  }
  .opt:hover { transform: translateY(-2px); border-color: var(--line-strong); }
  .opt.on {
    border-color: var(--accent);
    background: color-mix(in oklab, var(--accent-bg) 12%, var(--bg-raised));
    box-shadow: 0 0 0 1px var(--accent), 0 6px 18px var(--accent-glow);
  }

  svg { width: 44px; height: 44px; overflow: visible; }

  .bed { fill: var(--bg-sunken); }
  .shot { fill: var(--accent-bg); }
  .opt.on .shot { fill: var(--accent); }
  /* Те, що не влізло в кадр і буде обрізане */
  .ghost-fill { fill: var(--accent-bg); opacity: 0.22; }
  .frame { fill: none; stroke: var(--line-strong); stroke-width: 1.6; }
  /* Штрихована рамка — запитаний кадр, коли результат має інший розмір */
  .asked {
    fill: none;
    stroke: var(--fg-muted);
    stroke-width: 1.6;
    stroke-dasharray: 3.5 3;
  }
  .cut { stroke: var(--danger); stroke-width: 1.4; stroke-dasharray: 2.5 2.5; opacity: 0.75; }
  .arrow { stroke: var(--fg); stroke-width: 1.6; fill: none; stroke-linecap: round; opacity: 0.75; }

  .name {
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1.15;
    text-align: center;
    color: var(--fg-muted);
  }
  .opt.on .name { color: var(--fg); }

  .hint {
    margin-top: 0.5rem;
    font-size: 0.8rem;
    color: var(--fg-faint);
    min-height: 2.4em;
  }
</style>
