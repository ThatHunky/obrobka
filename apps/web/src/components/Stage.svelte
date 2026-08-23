<script lang="ts">
  import type { FitMode, Mask, Position } from '@obrobka/core';
  import type { UiLayer } from '../lib/worker-api.js';
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
    src, dims, targetW, targetH, mode, position, zoom, meta = '',
    layers = [], selectedLayer = null, onlayermove,
    brush = { on: false, mode: 'erase', size: 40, clearToken: 0 }, onstroke,
    t, onchange,
  }: {
    src: string;
    dims: { w: number; h: number } | null;
    targetW: number;
    targetH: number;
    mode: FitMode;
    position: Position;
    zoom: number;
    /**
     * Підпис під кадром — розмір і вага оригіналу.
     *
     * Приходить готовим рядком, а не парою чисел: сцена — це один елемент
     * сітки «було → стало», і власний `<p>` поруч із нею зробив би
     * четверту колонку в тришпальтовій сітці.
     */
    meta?: string;
    /** Шари показуються поверх кадру, щоб їх було де тягнути. */
    layers?: readonly UiLayer[];
    selectedLayer?: number | null;
    onlayermove?: (id: number, x: number, y: number) => void;
    /** Стан пензля. clearToken росте, коли треба стерти всі мазки. */
    brush?: { on: boolean; mode: 'erase' | 'restore'; size: number; clearToken: number };
    onstroke?: (m: { keep: Mask | null; erase: Mask | null }) => void;
    t: Dict;
    onchange: (p: { position: Position; zoom: number }) => void;
  } = $props();

  /**
   * Пензель малює по оригіналу, а не по кадру.
   *
   * Сцена зазвичай показує кадр, тобто вже обрізане. Малювати по ньому
   * означало б не мати доступу до того, що поза кадром, і мати справу з
   * масштабом, який змінюється від наближення. Мазки ж лежать у
   * координатах оригіналу — тож у цьому режимі рамка показує оригінал
   * цілком, а кадрування й наближення на час малювання відступають.
   */
  const brushOn = $derived(brush.on && dims !== null);

  /**
   * Роздільність полотна мазків.
   *
   * Обмежена 1024 по більшій стороні: фотографія 4000×3000 коштувала б
   * 12 МБ на маску, а їх дві. Край мазка однаково м'який, тож зменшення
   * на ньому не видно — на відміну від накладеного зображення, де межу
   * взято вдвічі більшу саме заради різкості.
   */
  const MAX_STROKE_SIDE = 1024;
  const strokeSize = $derived.by(() => {
    if (dims === null) return { w: 1, h: 1 };
    const k = Math.min(1, MAX_STROKE_SIDE / Math.max(dims.w, dims.h));
    return { w: Math.max(1, Math.round(dims.w * k)), h: Math.max(1, Math.round(dims.h * k)) };
  });

  let eraseCanvas = $state<HTMLCanvasElement | null>(null);
  let keepCanvas = $state<HTMLCanvasElement | null>(null);
  let painting = false;
  let lastPoint: { x: number; y: number } | null = null;

  /** Чистимо мазки, коли панель просить, і коли змінюється розмір полотна. */
  $effect(() => {
    const token = brush.clearToken;
    const size = strokeSize;
    void token; void size;
    for (const c of [eraseCanvas, keepCanvas]) {
      if (c === null) continue;
      c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    }
  });

  /** Альфа полотна — це і є маска: колір там суто косметичний. */
  function toMask(canvas: HTMLCanvasElement | null): Mask | null {
    if (canvas === null) return null;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx === null) return null;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const out = new Uint8ClampedArray(canvas.width * canvas.height);
    let any = false;
    for (let p = 0, i = 3; p < out.length; p++, i += 4) {
      const a = data[i]!;
      out[p] = a;
      if (a > 0) any = true;
    }
    return any ? { data: out, width: canvas.width, height: canvas.height } : null;
  }

  function paintAt(e: PointerEvent): void {
    const rect = box();
    const canvas = brush.mode === 'erase' ? eraseCanvas : keepCanvas;
    if (rect === null || canvas === null) return;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;

    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    // Товщина задана в пікселях прев'ю — переводимо в пікселі полотна,
    // інакше на маленькому екрані мазок був би вдесятеро грубший.
    ctx.lineWidth = Math.max(1, brush.size * (canvas.width / rect.width));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Малюємо непрозорим: прозорість накидає CSS. Інакше альфа
    // накопичувалась би на перетинах мазка й маска виходила б плямиста.
    // Колір вільний — маскою стає альфа, а не він; тут він лише щоб було
    // видно, де стерто, а де повернуто.
    ctx.strokeStyle = brush.mode === 'erase' ? '#ff5f56' : '#3ecf8e';
    ctx.beginPath();
    if (lastPoint === null) ctx.moveTo(x, y);
    else ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastPoint = { x, y };
  }

  /** Обраний шар перехоплює жест: інакше його не було б чим рухати. */
  const activeLayer = $derived(
    selectedLayer === null
      ? null
      : layers.find((l) => l.id === selectedLayer && !l.hidden) ?? null,
  );
  const layerDrag = $derived(activeLayer !== null);

  /**
   * Чи є що робити жестом узагалі.
   *
   * Не те саме, що movable: у режимах без люфту кадр не рухається, але
   * обраний шар — рухається, і onPointerDown це вже враховує. Якби фокус
   * і далі залежав лише від movable, шар у режимі «розтягнути» можна було
   * б посунути мишею й ніяк — клавіатурою.
   */
  const interactive = $derived(movable || layerDrag);

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
   * Прямокутник рамки на час жесту.
   *
   * Читається раз, на початку: getBoundingClientRect змушує браузер
   * порахувати розкладку, а той самий обробник одразу пише нові
   * координати в стиль зображення. Читати його на кожен pointermove
   * означало б чергувати читання й запис у такт кадрам. Розмір рамки
   * посеред жесту однаково не змінюється.
   */
  let frameBox: DOMRect | null = null;

  function box(): DOMRect | null {
    if (frameBox !== null) return frameBox;
    return frame === undefined ? null : frame.getBoundingClientRect();
  }

  /**
   * Скільки пікселів прев'ю відповідає повному ходу частки.
   *
   * Це і є люфт: наскільки зображення більше або менше за кадр. Без нього
   * тягнення на маленькому прев'ю рухало б кадр так само, як на великому,
   * і жест не збігався б із тим, що видно.
   */
  function slack(): { x: number; y: number } {
    if (dims === null) return { x: 0, y: 0 };
    const rect = box();
    if (rect === null || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    const base = mode === 'cover'
      ? Math.max(rect.width / dims.w, rect.height / dims.h)
      : Math.min(rect.width / dims.w, rect.height / dims.h);
    const scale = base * z;
    return {
      x: Math.abs(dims.w * scale - rect.width),
      y: Math.abs(dims.h * scale - rect.height),
    };
  }

  const pointers = new Map<number, { x: number; y: number }>();
  let startFx = 0;
  let startFy = 0;
  let startZ = 1;
  let startSpread = 0;
  let startX = 0;
  let startY = 0;
  let startLx = 0;
  let startLy = 0;

  function spread(): number {
    const [a, b] = Array.from(pointers.values());
    if (a === undefined || b === undefined) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function onPointerDown(e: PointerEvent): void {
    if (brushOn) {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      if (frame !== undefined) frameBox = frame.getBoundingClientRect();
      painting = true;
      lastPoint = null;
      paintAt(e);
      return;
    }
    if (!movable && !layerDrag) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragging = true;
    if (frame !== undefined) frameBox = frame.getBoundingClientRect();
    anchor(e.clientX, e.clientY);
    if (pointers.size === 2) startSpread = spread();
  }

  /** Запам'ятовує, від чого рахувати зміщення далі. */
  function anchor(x: number, y: number): void {
    startFx = fx; startFy = fy; startZ = z;
    startX = x; startY = y;
    startLx = activeLayer?.x ?? 0.5;
    startLy = activeLayer?.y ?? 0.5;
  }

  function onPointerMove(e: PointerEvent): void {
    if (brushOn) {
      if (painting) paintAt(e);
      return;
    }
    if (!dragging || !pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size >= 2) {
      const now = spread();
      if (startSpread > 0 && now > 0) z = clampZoom(startZ * (now / startSpread));
      return;
    }
    // Обраний шар має пріоритет: людина щойно вибрала його в списку,
    // тож тягнення по кадру означає «посунь оце», а не «переклади кадр».
    if (layerDrag && selectedLayer !== null) {
      const rect = box();
      if (rect === null) return;
      onlayermove?.(
        selectedLayer,
        clamp01(startLx + (e.clientX - startX) / rect.width),
        clamp01(startLy + (e.clientY - startY) / rect.height),
      );
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
    if (brushOn) {
      if (!painting) return;
      painting = false;
      lastPoint = null;
      // Маски знімаємо на кінець мазка, не щокадру: та сама дисципліна,
      // що й у тягненні кадру — у воркер летить завершений жест.
      onstroke?.({ keep: toMask(keepCanvas), erase: toMask(eraseCanvas) });
      return;
    }
    pointers.delete(e.pointerId);
    if (pointers.size > 0) {
      // Пальців стало менше, а якорі лишились від початку жесту. Палець,
      // що лишився, за час зведення проїхав через пів екрана — і перший
      // же його рух посунув би кадр одразу на всю цю відстань. Тож
      // рахуємо далі від того місця, де він зараз.
      const [rest] = Array.from(pointers.values());
      if (rest !== undefined) anchor(rest.x, rest.y);
      if (pointers.size === 2) startSpread = spread();
      return;
    }
    dragging = false;
    frameBox = null;
    // Жест про шар кадру не стосується: commit() тут перевів би прив'язку
    // у власну, хоча людина її не чіпала.
    if (!layerDrag) commit();
  }

  function onWheel(e: WheelEvent): void {
    if (brushOn || !movable) return;
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

  /**
   * Пропорції рамки.
   *
   * У inside та outside вихід навмисно не дорівнює запитаному кадру: він
   * має пропорції оригіналу, і саме в цьому суть обох режимів. Малювати
   * там цільовий кадр означало б обіцяти форму, якої пайплайн не віддасть,
   * — 200×100 у режимі «без полів» із ціллю 512×512 дає 512×256, а рамка
   * показувала квадрат.
   */
  const showsSource = $derived(
    (brushOn || mode === 'inside' || mode === 'outside') && dims !== null,
  );
  const frameAspect = $derived(
    showsSource && dims !== null ? dims.w / dims.h : targetW / targetH,
  );
  const frameRatio = $derived(
    showsSource && dims !== null ? `${dims.w} / ${dims.h}` : `${targetW} / ${targetH}`,
  );

  /**
   * Геометрія прев'ю — та сама, що в place() всередині fit().
   *
   * Раніше тут стояли object-fit, object-position і transform: scale, і це
   * зовсім інша композиція. object-position розподіляє *ненаближений*
   * надлишок, а наближення накладалось трансформом поверх, від центра;
   * пайплайн же спершу масштабує, і лише потім вирізає кадр часткою від
   * *збільшеного* надлишку. Поки z = 1, обидва збігаються — тому й
   * непомітно було. Щойно наближено, прев'ю починало брехати: на
   * пейзажному кадрі ненаближений надлишок по вертикалі рівно нульовий,
   * тож вертикальне тягнення не рухало нічого взагалі, а горизонтальне
   * їхало приблизно на 15 % повільніше за палець.
   *
   * Розміри рахуються частками рамки, тож DOM міряти не треба: досить
   * пропорцій рамки й пропорцій оригіналу.
   */
  const preview = $derived.by(() => {
    if (dims === null) return null;
    // Малюємо по оригіналу — ні кадру, ні наближення тут немає
    if (brushOn) return { sw: 1, sh: 1, left: 0, top: 0 };
    const a = frameAspect;
    const f = dims.w / dims.h;
    const sw = mode === 'fill' ? z
      : mode === 'cover' ? z * Math.max(1, f / a)
      : z * Math.min(1, f / a);
    const sh = mode === 'fill' ? z
      : mode === 'cover' ? z * Math.max(1, a / f)
      : z * Math.min(1, a / f);
    // Те саме, що place(): зміщення — частка вільного місця. У cover воно
    // від'ємне (зображення більше за рамку), у contain додатне.
    return { sw, sh, left: (1 - sw) * fx, top: (1 - sh) * fy };
  });

  const sourceStyle = $derived(
    preview === null
      ? 'width: 100%; height: 100%; object-fit: contain;'
      : `left: ${(preview.left * 100).toFixed(4)}%;`
        + ` top: ${(preview.top * 100).toFixed(4)}%;`
        + ` width: ${(preview.sw * 100).toFixed(4)}%;`
        + ` height: ${(preview.sh * 100).toFixed(4)}%;`,
  );

  function onKeyDown(e: KeyboardEvent): void {
    if (brushOn) return;
    const step = e.shiftKey ? 0.1 : 0.02;

    // Обраний шар має пріоритет і з клавіатури — так само, як із мишею.
    // Інакше та сама стрілка робила б різне залежно від пристрою, а
    // посунути шар без миші було б неможливо взагалі.
    // Стрілки забирає шар, решта клавіш падає далі — інакше вибір шару
    // тихо вимикав би + і − , якими наближають кадр.
    const nudges: Record<string, readonly [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0],
      ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    const nudge = nudges[e.key];
    if (activeLayer !== null && selectedLayer !== null && nudge !== undefined) {
      e.preventDefault();
      onlayermove?.(
        selectedLayer,
        clamp01(activeLayer.x + nudge[0]),
        clamp01(activeLayer.y + nudge[1]),
      );
      return;
    }

    if (!movable) return;
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
    {#if movable && !brushOn}
      <button type="button" class="reset" data-testid="framing-reset"
              title={t.crop.reset} aria-label={t.crop.reset} onclick={reset}>⟲</button>
    {/if}
  </figcaption>

  <div
    class="frame checker"
    class:movable={movable && !brushOn}
    class:dragging
    class:painting={brushOn}
    bind:this={frame}
    style={`aspect-ratio: ${frameRatio}`}
    role={interactive ? 'slider' : undefined}
    tabindex={interactive ? 0 : undefined}
    aria-label={interactive ? (layerDrag ? t.layers.section : t.crop.drag) : undefined}
    aria-valuemin={interactive ? 0 : undefined}
    aria-valuemax={interactive ? 100 : undefined}
    aria-valuenow={interactive
      ? Math.round((activeLayer !== null ? activeLayer.x : fx) * 100)
      : undefined}
    data-testid="stage"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
    onwheel={onWheel}
    onkeydown={onKeyDown}
  >
    {#if src !== ''}
      <img class="source" {src} alt={t.before} draggable="false" style={sourceStyle} />
    {/if}

    {#if brushOn}
      <canvas
        bind:this={eraseCanvas}
        class="strokes erase"
        width={strokeSize.w}
        height={strokeSize.h}
        data-testid="brush-canvas-erase"
      ></canvas>
      <canvas
        bind:this={keepCanvas}
        class="strokes keep"
        width={strokeSize.w}
        height={strokeSize.h}
        data-testid="brush-canvas-keep"
      ></canvas>
    {/if}

    {#each layers as l (l.id)}
      {#if !l.hidden}
        <img
          class="ghost"
          class:on={l.id === selectedLayer}
          src={l.thumb}
          alt=""
          draggable="false"
          data-testid={`layer-ghost-${l.id}`}
          style={`left: ${l.x * 100}%; top: ${l.y * 100}%; width: ${l.scale * 100}%;
                  transform: translate(-50%, -50%) rotate(${l.rotation ?? 0}deg);
                  opacity: ${l.opacity ?? 1};`}
        />
      {/if}
    {/each}
  </div>

  {#if meta !== ''}<p class="meta">{meta}</p>{/if}
  {#if brushOn}
    <p class="hint">{t.brush.hint}</p>
  {:else if movable}
    <p class="hint">{t.crop.dragHint}</p>
  {/if}
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
  /*
   * Тільки джерело, не шари. Селектор `.frame img` мав вищу вагу за
   * `.ghost`, тож його height: 100% перебивав height: auto — прев'ю шару
   * розтягувалось на всю висоту кадру й не збігалося з результатом.
   */
  .frame .source {
    position: absolute;
    /* base.css ставить усім картинкам max-width: 100%; при наближенні
       воно тихо підрізало б ширину до рамки й ламало всю геометрію. */
    max-width: none;
    user-select: none; -webkit-user-drag: none;
  }
  /*
   * Мазки. Полотна лежать у своїй роздільності й розтягуються стилем на
   * всю рамку — саме тому альфа полотна прямо дорівнює масці, а колір
   * тут лише щоб людина бачила, де вже провела.
   */
  .strokes {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    max-width: none;
    pointer-events: none;
    opacity: 0.5;
    image-rendering: auto;
  }
  .frame.painting { cursor: crosshair; touch-action: none; }

  /*
   * Прев'ю шару. pointer-events: none навмисно — жест ловить кадр,
   * інакше півдороги тягнення губилося б на самому шарі.
   */
  .ghost {
    position: absolute;
    height: auto;
    pointer-events: none;
    user-select: none;
  }
  /* Обраний видно, що обраний: інакше незрозуміло, що саме рухатиметься */
  .ghost.on { outline: 1px dashed var(--accent); outline-offset: 2px; }

  .meta {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    color: var(--fg-muted);
  }
  .hint { font-size: 0.78rem; color: var(--fg-faint); max-width: 40ch; }
</style>
