<script lang="ts">
  import type { FitMode, Position } from '@obrobka/core';
  import type { Dict } from '../lib/i18n.js';

  /**
   * Кадр, яким керують пальцем або мишею.
   *
   * Живий відгук — це CSS на `<img>`: жодного декодування й жодного
   * повідомлення у воркер. Справжній Job перезапускається один раз, на
   * завершення жесту. Інакше кожен рух пальця запускав би повний
   * пайплайн, а з увімкненою моделлю — ще й сесію ONNX.
   */
  let {
    src, dims, targetW, targetH, mode, position, zoom, t, onchange,
  }: {
    src: string;
    dims: { w: number; h: number } | null;
    targetW: number;
    targetH: number;
    mode: FitMode;
    position: Position;
    zoom: number;
    t: Dict;
    onchange: (p: { position: Position; zoom: number }) => void;
  } = $props();

  /** Кадрувати можна лише там, де є вільне місце. */
  const movable = $derived(mode === 'contain' || mode === 'cover');

  /** Частки, з якими працює жест. Іменована прив'язка переводиться в них. */
  const NAMED: Record<string, [number, number]> = {
    'top-left': [0, 0], top: [0.5, 0], 'top-right': [1, 0],
    left: [0, 0.5], center: [0.5, 0.5], right: [1, 0.5],
    'bottom-left': [0, 1], bottom: [0.5, 1], 'bottom-right': [1, 1],
  };

  function toFractions(p: Position): [number, number] {
    if (typeof p === 'object') return 'fx' in p ? [p.fx, p.fy] : [0.5, 0.5];
    return NAMED[p] ?? [0.5, 0.5];
  }

  let fx = $state(0.5);
  let fy = $state(0.5);
  let z = $state(1);
  let dragging = $state(false);
  let frame: HTMLDivElement;

  // Стан ззовні — джерело правди, поки жест не почався.
  $effect(() => {
    if (dragging) return;
    const [a, b] = toFractions(position);
    fx = a; fy = b; z = zoom;
  });

  /**
   * Скільки пікселів прев'ю відповідає повному ходу частки.
   *
   * Це і є люфт: наскільки зображення більше або менше за кадр. Без нього
   * тягнення на маленькому прев'ю рухало б кадр так само, як на великому,
   * і жест не збігався б із тим, що видно.
   */
  function slack(): { x: number; y: number } {
    if (dims === null || frame === undefined) return { x: 0, y: 0 };
    const box = frame.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return { x: 0, y: 0 };
    const base = mode === 'cover'
      ? Math.max(box.width / dims.w, box.height / dims.h)
      : Math.min(box.width / dims.w, box.height / dims.h);
    const scale = base * z;
    return {
      x: Math.abs(dims.w * scale - box.width),
      y: Math.abs(dims.h * scale - box.height),
    };
  }

  const pointers = new Map<number, { x: number; y: number }>();
  let startFx = 0;
  let startFy = 0;
  let startZ = 1;
  let startSpread = 0;
  let startX = 0;
  let startY = 0;

  function spread(): number {
    const [a, b] = Array.from(pointers.values());
    if (a === undefined || b === undefined) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function onPointerDown(e: PointerEvent): void {
    if (!movable) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragging = true;
    startFx = fx; startFy = fy; startZ = z;
    startX = e.clientX; startY = e.clientY;
    if (pointers.size === 2) startSpread = spread();
  }

  function onPointerMove(e: PointerEvent): void {
    if (!dragging || !pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size >= 2) {
      const now = spread();
      if (startSpread > 0 && now > 0) z = clampZoom(startZ * (now / startSpread));
      return;
    }
    // У contain зображення менше за полотно, тож рух пальця й рух кадру
    // збігаються; у cover ми рухаємо вікно по зображенню, тобто навпаки.
    const sign = mode === 'cover' ? 1 : -1;
    const room = slack();
    if (room.x > 0) fx = clamp01(startFx + (sign * (startX - e.clientX)) / room.x);
    if (room.y > 0) fy = clamp01(startFy + (sign * (startY - e.clientY)) / room.y);
  }

  function onPointerUp(e: PointerEvent): void {
    pointers.delete(e.pointerId);
    if (pointers.size > 0) return;
    dragging = false;
    commit();
  }

  function onWheel(e: WheelEvent): void {
    if (!movable) return;
    e.preventDefault();
    z = clampZoom(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    schedule();
  }

  /**
   * Колесо приходить чергою подій без «кінця жесту», тож перезапуск
   * відкладається: інакше один прокрут дав би півсотні прогонів.
   */
  let timer: ReturnType<typeof setTimeout> | null = null;
  function schedule(): void {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; commit(); }, 180);
  }

  function commit(): void {
    onchange({ position: { fx, fy }, zoom: z });
  }

  function reset(): void {
    fx = 0.5; fy = 0.5; z = 1;
    commit();
  }

  function clamp01(v: number): number { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function clampZoom(v: number): number { return v < 1 ? 1 : v > 8 ? 8 : v; }

  /** Прев'ю позиціюється тими самими частками, що підуть у Job. */
  const objectPosition = $derived(`${(fx * 100).toFixed(2)}% ${(fy * 100).toFixed(2)}%`);
  const objectFit = $derived(mode === 'cover' || mode === 'fill' ? mode : 'contain');

  function onKeyDown(e: KeyboardEvent): void {
    if (!movable) return;
    const step = e.shiftKey ? 0.1 : 0.02;
    const moves: Record<string, () => void> = {
      ArrowLeft: () => { fx = clamp01(fx - step); },
      ArrowRight: () => { fx = clamp01(fx + step); },
      ArrowUp: () => { fy = clamp01(fy - step); },
      ArrowDown: () => { fy = clamp01(fy + step); },
      '+': () => { z = clampZoom(z * 1.1); },
      '=': () => { z = clampZoom(z * 1.1); },
      '-': () => { z = clampZoom(z / 1.1); },
    };
    const move = moves[e.key];
    if (move === undefined) return;
    e.preventDefault();
    move();
    schedule();
  }
</script>

<figure class="stage-pane">
  <figcaption>
    <span class="tag">{t.crop.drag}</span>
    {#if z > 1}
      <span class="zoom" data-testid="zoom-value">{z.toFixed(1)}×</span>
    {/if}
    {#if movable}
      <button type="button" class="reset" data-testid="framing-reset"
              title={t.crop.reset} aria-label={t.crop.reset} onclick={reset}>⟲</button>
    {/if}
  </figcaption>

  <div
    class="frame checker"
    class:movable
    class:dragging
    bind:this={frame}
    style={`aspect-ratio: ${targetW} / ${targetH}`}
    role={movable ? 'slider' : undefined}
    tabindex={movable ? 0 : undefined}
    aria-label={movable ? t.crop.drag : undefined}
    aria-valuemin={movable ? 0 : undefined}
    aria-valuemax={movable ? 100 : undefined}
    aria-valuenow={movable ? Math.round(fx * 100) : undefined}
    data-testid="stage"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
    onwheel={onWheel}
    onkeydown={onKeyDown}
  >
    {#if src !== ''}
      <img
        {src}
        alt={t.before}
        draggable="false"
        style={`object-fit: ${objectFit}; object-position: ${objectPosition}; transform: scale(${z});`}
      />
    {/if}
  </div>

  {#if movable}<p class="hint">{t.crop.dragHint}</p>{/if}
</figure>

<style>
  .stage-pane { display: grid; gap: 0.45rem; min-width: 0; }
  .stage-pane figcaption { display: flex; align-items: center; gap: 0.5rem; }
  .zoom {
    font-family: var(--font-mono); font-size: 0.72rem; color: var(--fg-muted);
    font-variant-numeric: tabular-nums;
  }
  .reset {
    margin-inline-start: auto;
    width: 1.6rem; height: 1.6rem;
    display: grid; place-items: center;
    border: 1px solid var(--line-strong); border-radius: var(--r-sm);
    background: var(--bg-sunken); cursor: pointer; line-height: 1;
  }
  .reset:hover { border-color: var(--accent); }

  .frame {
    position: relative;
    overflow: hidden;
    display: grid;
    place-items: center;
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    --checker-size: 14px;
  }
  /* Без цього палець гортає сторінку замість кадру. */
  .frame.movable { cursor: grab; touch-action: none; }
  .frame.dragging { cursor: grabbing; }
  .frame img {
    width: 100%; height: 100%;
    user-select: none; -webkit-user-drag: none;
  }
  .hint { font-size: 0.78rem; color: var(--fg-faint); max-width: 40ch; }
</style>
