<script lang="ts">
  import { sniffMime } from '@obrobka/codecs';
  import type { FitMode, OutputFormat } from '@obrobka/core';
  import { buildJob, getWorker, type WidgetState } from '../lib/worker-api.js';

  interface PresetInput {
    width: number; height: number; mode: FitMode;
    format: OutputFormat; padTransparent: boolean;
  }
  interface Preset { label: string; width: number; height: number; mode: FitMode }

  const { preset }: { preset?: PresetInput } = $props();

  const presets: Preset[] = [
    { label: 'Стікер Telegram 512×512', width: 512, height: 512, mode: 'contain' },
    { label: 'Аватар 400×400', width: 400, height: 400, mode: 'cover' },
    { label: 'OG-image 1200×630', width: 1200, height: 630, mode: 'cover' },
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

  let sourceName = $state('');
  let resultUrl = $state('');
  let resultSize = $state(0);
  let busy = $state(false);
  let error = $state('');
  let dragging = $state(false);
  let sourceBytes: Uint8Array | null = null;
  let sourceMime = '';

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
    sourceName = file.name.replace(/\.[^.]+$/, '');
    await process();
  }

  async function process(): Promise<void> {
    if (sourceBytes === null) return;
    busy = true;
    error = '';
    try {
      const copy = sourceBytes.slice();
      const out = await getWorker().process(copy.buffer, sourceMime, buildJob(state));
      if (resultUrl !== '') URL.revokeObjectURL(resultUrl);
      const blob = new Blob([out], { type: `image/${state.format}` });
      resultUrl = URL.createObjectURL(blob);
      resultSize = blob.size;
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
  class="widget"
  class:dragging
  ondragover={(e) => { e.preventDefault(); dragging = true; }}
  ondragleave={() => (dragging = false)}
  ondrop={onDrop}
>
  <label class="pick">
    Обрати зображення
    <input
      type="file"
      accept="image/png,image/jpeg,image/webp,image/avif"
      onchange={(e) => {
        const f = e.currentTarget.files?.[0];
        if (f !== undefined) void accept(f);
      }}
    />
  </label>
  <p class="hint">або перетягніть файл сюди. Він не залишить ваш пристрій.</p>

  <div class="presets">
    {#each presets as p (p.label)}
      <button type="button" onclick={() => applyPreset(p)}>{p.label}</button>
    {/each}
  </div>

  <div class="controls">
    <label>Ширина
      <input type="number" min="1" bind:value={state.width} onchange={process} />
    </label>
    <label>Висота
      <input type="number" min="1" bind:value={state.height} onchange={process} />
    </label>
    <label>Режим
      <select bind:value={state.mode} onchange={process}>
        <option value="contain">Вписати з полями</option>
        <option value="cover">Заповнити з обрізкою</option>
        <option value="fill">Розтягнути</option>
        <option value="inside">Вписати без полів</option>
        <option value="outside">Покрити без обрізки</option>
      </select>
    </label>
    <label>Формат
      <select bind:value={state.format} onchange={process}>
        <option value="png">PNG</option>
        <option value="jpeg">JPEG</option>
        <option value="webp">WebP</option>
        <option value="avif">AVIF</option>
      </select>
    </label>
    <label class="check">
      <input type="checkbox" bind:checked={state.padTransparent} onchange={process} />
      Прозорі поля
    </label>
    {#if !state.padTransparent}
      <label>Колір полів
        <input type="color" bind:value={state.padColor} onchange={process} />
      </label>
    {/if}
    <label class="check">
      <input type="checkbox" bind:checked={state.allowUpscale} onchange={process} />
      Дозволити збільшення
    </label>
  </div>

  {#if error !== ''}<p class="error" role="alert">{error}</p>{/if}
  {#if busy}<p class="status" aria-live="polite">Обробляю…</p>{/if}

  {#if resultUrl !== ''}
    <figure class="result">
      <img src={resultUrl} alt="Результат обробки" data-testid="result" />
      <figcaption>{state.width}×{state.height} · {(resultSize / 1024).toFixed(1)} КБ</figcaption>
    </figure>
    <a
      class="download"
      href={resultUrl}
      download={`${sourceName || 'image'}-${state.width}x${state.height}.${state.format}`}
      data-testid="download"
    >Завантажити</a>
  {/if}
</section>

<style>
  .widget { display: grid; gap: 1rem; max-width: 40rem; }
  .widget.dragging { outline: 2px dashed currentColor; outline-offset: 0.5rem; }
  .controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: 0.75rem; }
  .controls label { display: grid; gap: 0.25rem; font-size: 0.875rem; }
  .controls label.check { grid-template-columns: auto 1fr; align-items: center; gap: 0.5rem; }
  .presets { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .result img { max-width: 100%; height: auto; }
  .error { color: #b00020; }
</style>
