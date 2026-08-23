import * as Comlink from 'comlink';
import type { FitMode, Job, Op, OutputFormat, Position, RGBA, Tier } from '@obrobka/core';
import type { Metadata } from '@obrobka/metadata';

export type Provider = 'webgpu' | 'wasm';

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
