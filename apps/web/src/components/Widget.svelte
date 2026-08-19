<script lang="ts">
  import { sniffMime } from '@obrobka/codecs';
  import type { FitMode, OutputFormat } from '@obrobka/core';
  import { buildJob, getWorker, type WidgetState } from '../lib/worker-api.js';
  import FitModePicker from './FitModePicker.svelte';

  interface PresetInput {
    width: number; height: number; mode: FitMode;
    format: OutputFormat; padTransparent: boolean;
  }
  interface Preset { label: string; width: number; height: number; mode: FitMode }

  const { preset }: { preset?: PresetInput } = $props();

  const presets: Preset[] = [
    { label: 'Стікер Telegram', width: 512, height: 512, mode: 'contain' },
    { label: 'Аватар', width: 400, height: 400, mode: 'cover' },
    { label: 'OG-image', width: 1200, height: 630, mode: 'cover' },
    { label: 'Full HD', width: 1920, height: 1080, mode: 'contain' },
  ];

  let state = $state<WidgetState>({
    width: preset?.width ?? 512,
    height: preset?.height ?? 512,
    mode: preset?.mode ?? 'contain',
    padTransparent: preset?.padTransparent ?? true,
    padColor: '#ffffff',
    allowUpscale: false,
    format: preset?.format ?? 'png',
    quality: 80,
  });

  /**
   * До гідратації острівця обробник change ще не навішений: користувач міг би
   * вибрати файл і не отримати нічого. Тому контроли вимкнені до монтування.
   */
  let ready = $state(false);
  $effect(() => { ready = true; });

  let sourceName = $state('');
  let sourceUrl = $state('');
  let sourceDims = $state<{ w: number; h: number } | null>(null);
  let sourceSize = $state(0);
  let resultUrl = $state('');
  let resultSize = $state(0);
  let busy = $state(false);
  let error = $state('');
  let dragging = $state(false);
  let elapsed = $state(0);

  let sourceBytes: Uint8Array | null = null;
  let sourceMime = '';

  const ratio = $derived(
    sourceSize > 0 && resultSize > 0 ? resultSize / sourceSize : 0,
  );

  function kb(bytes: number): string {
    return bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} КБ`
      : `${(bytes / 1048576).toFixed(2)} МБ`;
  }

  async function accept(file: File): Promise<void> {
    error = '';
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = sniffMime(bytes);
    if (mime === null) {
      error = 'Не вдалося розпізнати формат. Підтримуються PNG, JPEG, WebP і AVIF.';
      return;
    }
    sourceBytes = bytes;
    sourceMime = mime;
    sourceSize = bytes.length;
    sourceName = file.name.replace(/\.[^.]+$/, '');

    if (sourceUrl !== '') URL.revokeObjectURL(sourceUrl);
    sourceUrl = URL.createObjectURL(new Blob([bytes.slice()], { type: mime }));
    sourceDims = await new Promise((resolve) => {
      const probe = new Image();
      probe.onload = () => resolve({ w: probe.naturalWidth, h: probe.naturalHeight });
      probe.onerror = () => resolve(null);
      probe.src = sourceUrl;
    });

    await process();
  }

  /**
   * Вставка з буфера обміну.
   *
   * Основний шлях — подія paste: працює скрізь і не питає дозволу.
   * Кнопка потрібна для телефонів, де Ctrl+V натиснути нема чим, і для
   * випадків на кшталт стікерів із Google Photos, які можна лише скопіювати.
   */
  async function pasteFromClipboard(): Promise<void> {
    error = '';
    const clip = navigator.clipboard as Clipboard & { read?: () => Promise<ClipboardItem[]> };
    if (typeof clip?.read !== 'function') {
      error = 'Браузер не дає читати буфер обміну. Натисніть Ctrl+V або Cmd+V.';
      return;
    }
    try {
      for (const item of await clip.read()) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (type === undefined) continue;
        const blob = await item.getType(type);
        await accept(new File([blob], 'clipboard', { type: blob.type || type }));
        return;
      }
      error = 'У буфері обміну немає зображення.';
    } catch {
      error = 'Не вдалося прочитати буфер. Дозвольте доступ або натисніть Ctrl+V.';
    }
  }

  $effect(() => {
    const onPaste = (e: ClipboardEvent): void => {
      const item = Array.from(e.clipboardData?.items ?? [])
        .find((i) => i.kind === 'file' && i.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (file === null || file === undefined) return;
      e.preventDefault();
      void accept(file);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  });

  async function process(): Promise<void> {
    if (sourceBytes === null) return;
    busy = true;
    error = '';
    const started = performance.now();
    try {
      const copy = sourceBytes.slice();
      const out = await getWorker().process(copy.buffer, sourceMime, buildJob(state));
      if (resultUrl !== '') URL.revokeObjectURL(resultUrl);
      const blob = new Blob([out], { type: `image/${state.format}` });
      resultUrl = URL.createObjectURL(blob);
      resultSize = blob.size;
      elapsed = Math.round(performance.now() - started);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Не вдалося обробити зображення';
    } finally {
      busy = false;
    }
  }

  function applyPreset(p: Preset): void {
    state = { ...state, width: p.width, height: p.height, mode: p.mode };
    void process();
  }

  function onDrop(e: DragEvent): void {
    e.preventDefault();
    dragging = false;
    const file = e.dataTransfer?.files?.[0];
    if (file !== undefined) void accept(file);
  }
</script>

<section
  class="widget card"
  class:dragging
  ondragover={(e) => { e.preventDefault(); dragging = true; }}
  ondragleave={() => (dragging = false)}
  ondrop={onDrop}
>
  <!-- Зона прийому файлу -->
  <div class="drop" class:has={sourceUrl !== ''}>
    <div class="actions">
      <label class="pick btn btn-accent">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
           stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <path d="M12 16V4m0 0L7 9m5-5 5 5" /><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
      </svg>
      {ready ? 'Обрати зображення' : 'Готуємо інструмент…'}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        disabled={!ready}
        data-ready={ready}
        onchange={(e) => {
          const f = e.currentTarget.files?.[0];
          if (f !== undefined) void accept(f);
        }}
      />
      </label>

      <button
        type="button"
        class="btn paste"
        disabled={!ready}
        data-testid="paste"
        onclick={pasteFromClipboard}
      >
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round"
             stroke-linejoin="round" aria-hidden="true">
          <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z" />
          <path d="M8 6H6a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-2" />
        </svg>
        Вставити
      </button>
    </div>

    <p class="drop-hint">
      перетягніть сюди або вставте через Ctrl+V · <strong>файл не залишає ваш пристрій</strong>
    </p>
  </div>

  <!-- Пресети -->
  <div class="presets">
    {#each presets as p (p.label)}
      <button
        type="button"
        class="chip"
        class:on={state.width === p.width && state.height === p.height}
        disabled={!ready}
        onclick={() => applyPreset(p)}
      >
        {p.label}
        <em>{p.width}×{p.height}</em>
      </button>
    {/each}
  </div>

  <FitModePicker bind:value={state.mode} onchange={process} />

  <!-- Числові налаштування -->
  <div class="controls">
    <label class="field">
      <span>Ширина</span>
      <input type="number" min="1" max="20000" bind:value={state.width} onchange={process} />
    </label>
    <label class="field">
      <span>Висота</span>
      <input type="number" min="1" max="20000" bind:value={state.height} onchange={process} />
    </label>
    <label class="field">
      <span>Формат</span>
      <select bind:value={state.format} onchange={process}>
        <option value="png">PNG · без втрат</option>
        <option value="webp">WebP · компактний</option>
        <option value="jpeg">JPEG · сумісний</option>
        <option value="avif">AVIF · найменший</option>
      </select>
    </label>
    {#if state.format !== 'png'}
      <label class="field">
        <span>Якість <em>{state.quality}</em></span>
        <input type="range" min="1" max="100" bind:value={state.quality} onchange={process} />
      </label>
    {/if}
  </div>

  <div class="toggles">
    <label class="switch">
      <input type="checkbox" bind:checked={state.padTransparent} onchange={process} />
      <span class="track" aria-hidden="true"></span>
      Прозорі поля
    </label>
    {#if !state.padTransparent}
      <label class="switch color">
        <input type="color" bind:value={state.padColor} onchange={process} />
        Колір полів
      </label>
    {/if}
    <label class="switch">
      <input type="checkbox" bind:checked={state.allowUpscale} onchange={process} />
      <span class="track" aria-hidden="true"></span>
      Дозволити збільшення
    </label>
  </div>

  {#if error !== ''}
    <p class="error" role="alert">{error}</p>
  {/if}

  <!-- Результат -->
  {#if sourceUrl !== '' || busy}
    <div class="stage" class:busy>
      <figure class="pane">
        <figcaption><span class="tag">Було</span></figcaption>
        <div class="canvas checker">
          {#if sourceUrl !== ''}<img src={sourceUrl} alt="Вихідне зображення" />{/if}
        </div>
        <p class="meta">
          {#if sourceDims}{sourceDims.w}×{sourceDims.h}{/if} · {kb(sourceSize)}
        </p>
      </figure>

      <div class="arrow" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M4 12h16m0 0-6-6m6 6-6 6" />
        </svg>
      </div>

      <figure class="pane">
        <figcaption>
          <span class="tag accent">Стало</span>
          {#if busy}<span class="spinner" aria-label="Обробляю"></span>{/if}
        </figcaption>
        <div class="canvas checker">
          {#if resultUrl !== ''}
            <img src={resultUrl} alt="Результат обробки" data-testid="result" />
          {/if}
        </div>
        <p class="meta">
          {state.width}×{state.height} · {kb(resultSize)}
          {#if ratio > 0}
            <span class="delta" class:good={ratio < 1}>
              {ratio < 1 ? '−' : '+'}{Math.abs(Math.round((1 - ratio) * 100))}%
            </span>
          {/if}
          {#if elapsed > 0}<span class="ms">{elapsed} мс</span>{/if}
        </p>
      </figure>
    </div>

    {#if resultUrl !== ''}
      <a
        class="btn btn-accent download"
        href={resultUrl}
        download={`${sourceName || 'image'}-${state.width}x${state.height}.${state.format}`}
        data-testid="download"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M12 4v12m0 0 5-5m-5 5-5-5" /><path d="M4 18v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1" />
        </svg>
        Завантажити
      </a>
    {/if}
  {/if}
</section>

<style>
  .widget {
    display: grid;
    gap: 1.5rem;
    padding: clamp(1.1rem, 3vw, 1.9rem);
    position: relative;
    transition: border-color var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out);
  }
  .widget.dragging {
    border-color: var(--accent);
    box-shadow: 0 0 0 4px var(--accent-glow), var(--shadow-lg);
  }

  /* Зона прийому */
  .drop {
    display: grid;
    justify-items: center;
    gap: 0.6rem;
    padding: clamp(1.2rem, 4vw, 2.2rem) 1rem;
    border: 2px dashed var(--line-strong);
    border-radius: var(--r-md);
    background: var(--bg-sunken);
    transition: padding var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out);
  }
  .drop.has { padding: 1rem; }
  .dragging .drop { border-color: var(--accent); }

  .actions { display: flex; flex-wrap: wrap; gap: 0.6rem; justify-content: center; }
  .pick { position: relative; overflow: hidden; }
  .pick input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .pick input:disabled { cursor: not-allowed; }

  .drop-hint { font-size: 0.85rem; color: var(--fg-muted); text-align: center; }
  .drop-hint strong { color: var(--fg); font-weight: 600; }

  /* Пресети */
  .presets { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .chip {
    display: inline-flex;
    align-items: baseline;
    gap: 0.45rem;
    padding: 0.45rem 0.9rem;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--bg-raised);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      transform var(--dur-fast) var(--ease-spring),
      border-color var(--dur) var(--ease-out),
      background-color var(--dur) var(--ease-out);
  }
  .chip em {
    font-style: normal;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--fg-faint);
  }
  .chip:hover:not(:disabled) { transform: translateY(-2px); border-color: var(--line-strong); }
  .chip:disabled { opacity: 0.45; cursor: not-allowed; }
  .chip.on {
    border-color: var(--accent);
    background: color-mix(in oklab, var(--accent-bg) 14%, var(--bg-raised));
  }
  .chip.on em { color: var(--accent); }

  /* Поля */
  .controls {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.8rem;
  }
  .field { display: grid; gap: 0.35rem; }
  .field > span {
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--fg-muted);
  }
  .field > span em {
    font-style: normal;
    font-family: var(--font-mono);
    color: var(--accent);
  }
  .field input[type='number'], .field select {
    padding: 0.55rem 0.7rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--r-sm);
    background: var(--bg-sunken);
    font-variant-numeric: tabular-nums;
    transition: border-color var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out);
  }
  .field input[type='number']:focus, .field select:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
    outline: none;
  }
  .field input[type='range'] { accent-color: var(--accent-bg); width: 100%; }

  /* Перемикачі */
  .toggles { display: flex; flex-wrap: wrap; gap: 1.1rem; }
  .switch {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.88rem;
    cursor: pointer;
    user-select: none;
  }
  .switch input[type='checkbox'] { position: absolute; opacity: 0; width: 0; height: 0; }
  .track {
    width: 38px;
    height: 22px;
    border-radius: 999px;
    background: var(--line-strong);
    position: relative;
    transition: background-color var(--dur) var(--ease-out);
    flex: none;
  }
  .track::after {
    content: '';
    position: absolute;
    top: 3px; left: 3px;
    width: 16px; height: 16px;
    border-radius: 50%;
    background: var(--bg-raised);
    box-shadow: var(--shadow-sm);
    transition: transform var(--dur) var(--ease-spring);
  }
  .switch input:checked + .track { background: var(--accent-bg); }
  .switch input:checked + .track::after { transform: translateX(16px); }
  .switch input:focus-visible + .track { box-shadow: 0 0 0 3px var(--accent-glow); }
  .switch.color input[type='color'] {
    width: 38px; height: 24px;
    padding: 0;
    border: 1px solid var(--line-strong);
    border-radius: var(--r-sm);
    background: none;
    cursor: pointer;
  }

  .error {
    padding: 0.7rem 0.9rem;
    border-radius: var(--r-sm);
    background: color-mix(in oklab, var(--danger) 12%, transparent);
    border: 1px solid color-mix(in oklab, var(--danger) 40%, transparent);
    color: var(--danger);
    font-size: 0.9rem;
  }

  /* Сцена «було → стало» */
  .stage {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 0.8rem;
  }
  @media (max-width: 34rem) {
    .stage { grid-template-columns: 1fr; }
    .arrow { transform: rotate(90deg); justify-self: center; }
  }

  .pane { display: grid; gap: 0.45rem; min-width: 0; }
  .pane figcaption { display: flex; align-items: center; gap: 0.5rem; }
  .tag.accent { border-color: var(--accent); color: var(--accent); }

  .canvas {
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    overflow: hidden;
    --checker-size: 14px;
  }
  .canvas img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    animation: pop var(--dur-slow) var(--ease-spring);
  }
  @keyframes pop {
    from { opacity: 0; transform: scale(0.94); }
    to   { opacity: 1; transform: scale(1); }
  }

  .arrow { color: var(--fg-faint); }

  .meta {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    color: var(--fg-muted);
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: baseline;
  }
  .delta {
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    background: color-mix(in oklab, var(--danger) 15%, transparent);
    color: var(--danger);
    font-weight: 600;
  }
  .delta.good {
    background: color-mix(in oklab, var(--cyan-400) 18%, transparent);
    color: color-mix(in oklab, var(--cyan-400) 75%, var(--fg));
  }
  .ms { color: var(--fg-faint); }

  .spinner {
    width: 13px; height: 13px;
    border: 2px solid var(--line-strong);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .stage.busy .pane:last-child .canvas { opacity: 0.55; transition: opacity var(--dur) var(--ease-out); }

  .download { justify-self: start; }
</style>
