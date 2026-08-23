import * as Comlink from 'comlink';
import type {
  FitMode, Job, Layer, Mask, Op, OutputFormat, Position, RasterImage, RGBA, Tier,
} from '@obrobka/core';
import type { Metadata } from '@obrobka/metadata';

export type Provider = 'webgpu' | 'wasm';

/**
 * Шар разом із тим, що потрібно лише інтерфейсу.
 *
 * id, назва, мініатюра й ознака видимості живуть у списку панелі й до
 * ядра не мають стосунку — у Job їде сам Layer і нічого більше.
 */
export interface UiLayer extends Layer {
  readonly id: number;
  readonly name: string;
  /** Прихований шар лишається в списку, але не потрапляє в Job. */
  readonly hidden: boolean;
  /** objectURL мініатюри для списку. */
  readonly thumb: string;
}

export interface WidgetState {
  readonly width: number;
  readonly height: number;
  readonly mode: FitMode;
  readonly padTransparent: boolean;
  readonly padColor: string;
  readonly allowUpscale: boolean;
  readonly format: OutputFormat;
  readonly quality: number;
  readonly removeBg: boolean;
  readonly tier: Tier;
  readonly feather: number;
  readonly shrink: number;
  readonly despeckle: boolean;
  readonly position: Position;
  /** Ні / кадр за суб'єктом / обрізка порожніх країв. */
  readonly framing: 'none' | 'smart' | 'trim';
  readonly framingPadding: number;
  /** 1 — без збільшення. */
  readonly upscale: 1 | 2 | 4;
  /** Наближення кадру, 1 — без наближення. */
  readonly zoom: number;
  readonly outlineOn: boolean;
  readonly outlineWidth: number;
  readonly outlineColor: string;
  readonly layers: readonly UiLayer[];
  /** Мазки пензля в координатах оригіналу. null — не малювали. */
  readonly paint: { readonly keep: Mask | null; readonly erase: Mask | null };
}

export function parseHexColor(hex: string): RGBA {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (m === null) return { r: 255, g: 255, b: 255, a: 255 };
  const h = m[1]!;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    a: 255,
  };
}

/**
 * Копії піксельних буферів шарів.
 *
 * Ключ — сам RasterImage, і це не дрібниця: patchLayer перебудовує об'єкт
 * шару на кожен рух повзунка, але картинку лишає ту саму. Без кеша копія
 * робилася б наново щоразу — 16 МБ і близько 5 мс на шар 2048×2048, і ще
 * стільки ж, коли Comlink клонує його у воркер. Одне протягування
 * повзунка прозорості коштувало сотні мегабайтів заради зміни однієї
 * дробової величини.
 *
 * WeakMap, а не Map: щойно шар вилучено, копія йде за оригіналом сама.
 */
const plainImages = new WeakMap<object, RasterImage>();

function plainImage(img: RasterImage): RasterImage {
  const hit = plainImages.get(img);
  if (hit !== undefined) return hit;
  const copy: RasterImage = {
    data: new Uint8ClampedArray(img.data),
    width: img.width,
    height: img.height,
  };
  plainImages.set(img, copy);
  return copy;
}

/**
 * Шар як звичайні дані.
 *
 * Та сама причина, що й у plainPosition, але глибша: у стані проксі стає
 * і сам шар, і його RasterImage, і навіть Uint8ClampedArray усередині —
 * structured clone не переживає жодного з них.
 */
function plainLayer(l: UiLayer): Layer {
  return {
    image: plainImage(l.image),
    x: l.x,
    y: l.y,
    scale: l.scale,
    ...(l.rotation !== undefined ? { rotation: l.rotation } : {}),
    ...(l.opacity !== undefined ? { opacity: l.opacity } : {}),
    ...(l.blend !== undefined ? { blend: l.blend } : {}),
  };
}

/** Маска мазка як звичайні дані — та сама причина, що й у plainLayer. */
function plainMask(m: Mask): Mask {
  return { data: new Uint8ClampedArray(m.data), width: m.width, height: m.height };
}

/**
 * Прив'язка як звичайний об'єкт.
 *
 * Стан віджета — реактивний проксі Svelte 5, і об'єкт, покладений у нього,
 * теж стає проксі. Job їде у воркер через structured clone, який проксі не
 * переживає: перше ж тягнення падало з «could not be cloned». Іменована
 * прив'язка — рядок, її копіювати нема потреби.
 */
function plainPosition(p: Position): Position {
  if (typeof p !== 'object') return p;
  return 'fx' in p ? { fx: p.fx, fy: p.fy } : { x: p.x, y: p.y };
}

/**
 * Перетворює стан інтерфейсу на серіалізований Job.
 *
 * Порядок навмисний: фон знімається з оригіналу, а вписування в кадр
 * відбувається вже з готовою прозорістю. Навпаки поля рамки з'їли б
 * частину суб'єкта ще до сегментації.
 */
export function buildJob(s: WidgetState): Job {
  const ops: Op[] = [];

  if (s.removeBg) {
    ops.push({
      type: 'removeBackground',
      tier: s.tier,
      feather: s.feather,
      shrink: s.shrink,
      despeckle: s.despeckle,
    });
    if (s.outlineOn && s.outlineWidth > 0) {
      ops.push({
        type: 'outline',
        width: s.outlineWidth,
        color: parseHexColor(s.outlineColor),
      });
    }
  }

  // Пензель — одразу після моделі й до всього, що рухає геометрію.
  // Мазки лежать у координатах оригіналу: якби операція йшла після
  // кадрування чи збільшення, вони поїхали б разом із кадром.
  if (s.paint.keep !== null || s.paint.erase !== null) {
    ops.push({
      type: 'paint',
      ...(s.paint.keep !== null ? { keep: plainMask(s.paint.keep) } : {}),
      ...(s.paint.erase !== null ? { erase: plainMask(s.paint.erase) } : {}),
    });
  }

  // Кадрування — після зняття фону, але до приведення в розмір: інакше
  // поля рамки вже з'їли б частину кадру, з якого ми обрізаємо.
  if (s.framing === 'smart') {
    ops.push({
      type: 'smartCrop',
      aspectRatio: s.width / s.height,
      padding: s.framingPadding,
      tier: s.tier,
    });
  } else if (s.framing === 'trim') {
    ops.push({ type: 'trim', padding: s.framingPadding, tier: s.tier });
  }

  // Збільшення — після кадрування й до приведення в розмір: інакше ми
  // ганяли б модель по пікселях, які потім однаково обріжуться.
  if (s.upscale === 2 || s.upscale === 4) {
    ops.push({ type: 'upscale', factor: s.upscale });
  }

  // Одиничне наближення в Job не кладемо: воно нічого не змінює, а в
  // пакетному режимі зайве поле робило б два однакові прогони різними.
  ops.push({
    type: 'fit',
    width: s.width,
    height: s.height,
    mode: s.mode,
    pad: s.padTransparent ? 'transparent' : parseHexColor(s.padColor),
    allowUpscale: s.allowUpscale,
    position: plainPosition(s.position),
    ...(s.zoom > 1 ? { zoom: s.zoom } : {}),
  });

  // Шари — останні, вже по готовому полотну. Водяний знак має лягти на те
  // зображення, яке людина завантажить, і в те місце, яке вона бачила:
  // до fit його перемолов би ресемплер, до upscale — нейромережа
  // домальовувала б деталі логотипу, якого в оригіналі не було.
  const visible = s.layers.filter((l) => !l.hidden);
  if (visible.length > 0) {
    ops.push({ type: 'composite', layers: visible.map(plainLayer) });
  }

  return {
    ops,
    output: s.format === 'png' ? { format: 'png' } : { format: s.format, quality: s.quality },
  };
}

/**
 * Чи потрібна модель для поточного стану.
 *
 * Збільшення теж рахується: Swin2SR — така сама сесія ONNX, як і
 * сегментатор. Без нього пакет зі збільшенням вважався б вільним від
 * моделі й розходився на чотири воркери, кожен зі своєю сесією та
 * власним завантаженням ваг.
 */
export function needsModel(s: WidgetState): boolean {
  return s.removeBg || s.framing !== 'none' || s.upscale !== 1;
}

export interface TileProgress { stage: string; done: number; total: number }

export interface WorkerApi {
  process(
    bytes: ArrayBuffer, mime: string, job: Job,
    onTile?: (p: TileProgress) => void,
  ): Promise<ArrayBuffer>;
  metadata(bytes: ArrayBuffer): Promise<Metadata>;
  preview(
    bytes: ArrayBuffer, mime: string, maxSide: number,
  ): Promise<{ buf: ArrayBuffer; width: number; height: number }>;
  warmUp(tier: Tier, onProgress: (fraction: number) => void): Promise<Provider | null>;
  warmUpUpscaler(
    factor: 2 | 4, onProgress: (fraction: number) => void,
  ): Promise<Provider | null>;
  decodeOverlay(
    bytes: ArrayBuffer, mime: string,
  ): Promise<{ data: ArrayBuffer; width: number; height: number }>;
}

const workers: Comlink.Remote<WorkerApi>[] = [];

function spawn(): Comlink.Remote<WorkerApi> {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  return Comlink.wrap<WorkerApi>(worker);
}

/** Створює воркер один раз і перевикористовує його. */
export function getWorker(): Comlink.Remote<WorkerApi> {
  return getWorkerSlot(0);
}

/**
 * Воркер під конкретний слот пулу.
 *
 * Пул росте на вимогу й ніколи не зменшується: кожен воркер тримає
 * скомпільовані модулі WASM, і закривати його, щоб за хвилину відкрити
 * знову, означало б платити за компіляцію двічі. Слот нуль — той самий
 * воркер, яким користується одиночна обробка.
 */
export function getWorkerSlot(slot: number): Comlink.Remote<WorkerApi> {
  while (workers.length <= slot) workers.push(spawn());
  return workers[slot]!;
}
