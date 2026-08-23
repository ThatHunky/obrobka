import { basename, extname, join } from 'node:path';
import { glob, mkdir } from 'node:fs/promises';
import {
  fit, orient, runJob,
  type BlendMode, type FitMode, type Job, type Layer, type Op,
  type OutputFormat, type Tier,
} from '@obrobka/core';
import { withDecoder } from '@obrobka/codecs';
import { nodeCodec } from '@obrobka/codecs/node';
import { decodeHeic } from '@obrobka/heic';
import { readMetadata, readOrientation, stripMetadata, type Metadata } from '@obrobka/metadata';
import { createSegmenter, createUpscaler } from '@obrobka/onnx-node';
import { readImage, writeImage, parseColor } from './io.js';

export interface ToolResult {
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly format: OutputFormat;
}

/**
 * HEIC під'єднано збоку — libheif ліцензований під LGPL і важить 1,46 МБ,
 * тож вантажиться лише тоді, коли такий файл справді відкрили.
 */
const codec = withDecoder(nodeCodec, 'image/heic', decodeHeic);

const ctx = {
  codec,
  segmenter: createSegmenter,
  upscaler: createUpscaler,
  metadata: { readOrientation },
};

async function runAndReport(input: string, output: string, job: Job): Promise<ToolResult> {
  const { bytes, mime } = await readImage(input);
  const result = await runJob(bytes, mime, job, ctx);
  await writeImage(output, result);

  // Розмір читаємо з готового файлу, а не рахуємо: у режимах inside та
  // outside вихідні розміри навмисно не збігаються із запитаними.
  const written = await codec.decode(result, `image/${job.output.format}`);
  return {
    path: output,
    width: written.width,
    height: written.height,
    bytes: result.length,
    format: job.output.format,
  };
}

function outputOf(format: OutputFormat, quality: number | undefined): Job['output'] {
  return quality === undefined ? { format } : { format, quality };
}

export interface ConvertArgs {
  readonly input: string;
  readonly output: string;
  readonly format: OutputFormat;
  readonly quality?: number | undefined;
}

export async function convertImage(args: ConvertArgs): Promise<ToolResult> {
  return runAndReport(args.input, args.output, {
    ops: [],
    output: outputOf(args.format, args.quality),
  });
}

export interface ResizeArgs {
  readonly input: string;
  readonly output: string;
  readonly width: number;
  readonly height: number;
  readonly mode: FitMode;
  readonly pad?: string | undefined;
  readonly allowUpscale?: boolean | undefined;
  readonly format: OutputFormat;
  readonly quality?: number | undefined;
}

export async function resizeImage(args: ResizeArgs): Promise<ToolResult> {
  return runAndReport(args.input, args.output, {
    ops: [{
      type: 'fit',
      width: args.width,
      height: args.height,
      mode: args.mode,
      pad: args.pad === undefined ? 'transparent' : parseColor(args.pad),
      allowUpscale: args.allowUpscale ?? false,
    }],
    output: outputOf(args.format, args.quality),
  });
}

export interface RemoveBgArgs {
  readonly input: string;
  readonly output: string;
  readonly tier?: Tier | undefined;
  readonly feather?: number | undefined;
  readonly outlineWidth?: number | undefined;
  readonly outlineColor?: string | undefined;
  readonly format?: 'png' | 'webp' | 'avif' | undefined;
}

export async function removeBackground(args: RemoveBgArgs): Promise<ToolResult> {
  const ops: Op[] = [{
    type: 'removeBackground',
    tier: args.tier ?? 'fast',
    ...(args.feather === undefined ? {} : { feather: args.feather }),
  }];
  if (args.outlineWidth !== undefined && args.outlineWidth > 0) {
    ops.push({
      type: 'outline',
      width: args.outlineWidth,
      color: parseColor(args.outlineColor ?? '#ffffff'),
    });
  }
  // Формат мусить тримати альфу; у JPEG її немає, і фон вийшов би чорним.
  const format = args.format ?? 'png';
  if ((format as string) === 'jpeg') {
    throw new Error('JPEG не підтримує прозорість — оберіть png, webp або avif');
  }
  return runAndReport(args.input, args.output, { ops, output: { format } });
}

export interface SmartCropArgs {
  readonly input: string;
  readonly output: string;
  readonly aspectRatio: number;
  readonly padding?: number | undefined;
  readonly tier?: Tier | undefined;
  readonly format: OutputFormat;
  readonly quality?: number | undefined;
}

/**
 * Кадрує за суб'єктом, зберігаючи фон.
 *
 * Операції removeBackground у списку немає навмисно: маска будується від
 * самої наявності операції, що її потребує, а кадр вирізається з оригіналу.
 * Користувач просив обрізку, а не видалення фону.
 */
export async function smartCropImage(args: SmartCropArgs): Promise<ToolResult> {
  return runAndReport(args.input, args.output, {
    ops: [{
      type: 'smartCrop',
      aspectRatio: args.aspectRatio,
      tier: args.tier ?? 'fast',
      ...(args.padding === undefined ? {} : { padding: args.padding }),
    }],
    output: args.quality === undefined
      ? { format: args.format }
      : { format: args.format, quality: args.quality },
  });
}

export interface UpscaleArgs {
  readonly input: string;
  readonly output: string;
  readonly factor?: 2 | 4 | undefined;
  readonly format?: OutputFormat | undefined;
  readonly quality?: number | undefined;
}

/**
 * Збільшення нейромережею.
 *
 * Виконується тайлами, тож пам'ять не залежить від розміру зображення,
 * а от час — залежить прямо: приблизно 2,6 с на тайл 256×256 для ×2
 * і стільки ж на тайл 128×128 для ×4 на звичайному процесорі.
 */
export async function upscaleImage(args: UpscaleArgs): Promise<ToolResult> {
  const factor = args.factor ?? 2;
  const format = args.format ?? 'png';
  return runAndReport(args.input, args.output, {
    ops: [{ type: 'upscale', factor }],
    output: args.quality === undefined
      ? { format }
      : { format, quality: args.quality },
  });
}

export interface MetadataResult {
  readonly path: string;
  readonly metadata: Metadata;
  /** Чи є в файлі координати. Винесено нагору — це найчутливіше з усього. */
  readonly hasGps: boolean;
}

/**
 * Читає метадані, не змінюючи файл.
 *
 * Орієнтація віддається числом теґу EXIF (1..8), а не описом: саме за ним
 * решта інструментів повертає кадр.
 */
export async function readImageMetadata(args: { readonly input: string }): Promise<MetadataResult> {
  const { bytes } = await readImage(args.input);
  const metadata = await readMetadata(bytes);
  return { path: args.input, metadata, hasGps: metadata.gps !== undefined };
}

export interface StripResult {
  readonly path: string;
  readonly bytesBefore: number;
  readonly bytesAfter: number;
  /** Що саме зникло — щоб було видно, чи спрацювало. */
  readonly removed: readonly string[];
}

/**
 * Знімає метадані, не чіпаючи пікселі.
 *
 * Це не те саме, що конвертація. Конвертація малює зображення заново й
 * метадані втрачає сама собою — але разом із ними змінює кожен піксель.
 * Тут байти зображення лишаються ті самі, зникають лише блоки навколо них.
 */
export async function stripImageMetadata(args: {
  readonly input: string; readonly output: string;
}): Promise<StripResult> {
  const { bytes } = await readImage(args.input);
  const before = await readMetadata(bytes);
  const clean = await stripMetadata(bytes);
  await writeImage(args.output, clean);

  const after = await readMetadata(clean);
  const removed = Object.keys(before.tags).filter((k) => !(k in after.tags));
  return {
    path: args.output,
    bytesBefore: bytes.length,
    bytesAfter: clean.length,
    removed: removed.sort(),
  };
}

export interface BatchArgs {
  readonly pattern: string;
  readonly cwd?: string | undefined;
  readonly outputDir: string;
  readonly format: OutputFormat;
  readonly quality?: number | undefined;
  readonly width?: number | undefined;
  readonly height?: number | undefined;
  readonly mode?: FitMode | undefined;
  readonly allowUpscale?: boolean | undefined;
  readonly removeBackground?: boolean | undefined;
  readonly tier?: Tier | undefined;
  readonly upscale?: 2 | 4 | undefined;
  readonly limit?: number | undefined;
}

export interface BatchFailure {
  readonly input: string;
  readonly message: string;
}

export interface BatchResult {
  readonly outputs: readonly ToolResult[];
  readonly errors: readonly BatchFailure[];
  /** Скільки файлів відкинув ліміт — мовчазне обрізання гірше за число. */
  readonly skipped: number;
}

/** Стеля за замовчуванням: далі варто питати явно, а не запускати годинний прохід. */
const DEFAULT_LIMIT = 100;

function batchJob(args: BatchArgs): Job {
  const ops: Op[] = [];
  if (args.removeBackground === true) {
    ops.push({ type: 'removeBackground', tier: args.tier ?? 'fast' });
  }
  if (args.upscale === 2 || args.upscale === 4) {
    ops.push({ type: 'upscale', factor: args.upscale });
  }
  if (args.width !== undefined && args.height !== undefined) {
    ops.push({
      type: 'fit',
      width: args.width,
      height: args.height,
      mode: args.mode ?? 'inside',
      pad: 'transparent',
      allowUpscale: args.allowUpscale ?? false,
    });
  }
  return { ops, output: outputOf(args.format, args.quality) };
}

/**
 * Розводить збіги імен.
 *
 * Після зміни розширення `a/photo.jpg` і `b/photo.png` дають те саме
 * `photo.webp`. Мовчки затерти перший результат другим — найгірше з того,
 * що може зробити пакетна обробка.
 */
function uniqueName(taken: Set<string>, base: string, format: OutputFormat): string {
  const stem = basename(base, extname(base));
  let name = `${stem}.${format}`;
  let n = 2;
  while (taken.has(name)) name = `${stem}-${n++}.${format}`;
  taken.add(name);
  return name;
}

/**
 * Прогін за маскою файлів.
 *
 * Послідовно, і це свідомо. Двадцять фотографій по 12 Мп проходять за
 * 18 с в один потік; пул із чотирьох воркерів дав би близько 6 с — але
 * ціною другої точки входу в збірці. Виграш у дванадцять секунд на
 * фоновій задачі агента того не вартий. У вкладці рішення протилежне:
 * там на результат дивиться людина.
 *
 * Один битий файл не зупиняє решту — він потрапляє в errors. Порядок
 * результатів детермінований: інакше агент не зіставить їх із входом.
 */
export async function processBatch(args: BatchArgs): Promise<BatchResult> {
  const limit = args.limit ?? DEFAULT_LIMIT;
  const found: string[] = [];
  for await (const entry of glob(args.pattern, { cwd: args.cwd ?? process.cwd() })) {
    found.push(entry);
  }
  found.sort();

  const selected = found.slice(0, limit);
  await mkdir(args.outputDir, { recursive: true });

  const job = batchJob(args);
  const taken = new Set<string>();
  const outputs: ToolResult[] = [];
  const errors: BatchFailure[] = [];

  for (const entry of selected) {
    const input = args.cwd === undefined ? entry : join(args.cwd, entry);
    const output = join(args.outputDir, uniqueName(taken, entry, args.format));
    try {
      outputs.push(await runAndReport(input, output, job));
    } catch (e) {
      errors.push({ input, message: e instanceof Error ? e.message : String(e) });
    }
  }

  return { outputs, errors, skipped: found.length - selected.length };
}

/**
 * Межа роздільності накладеного зображення.
 *
 * Те саме число, що у браузері: повнорозмірний RGBA шар — це десятки
 * мегабайтів, а малюється він на частку кадру. 6000×4000 коштували б
 * 96 МБ на самий лише буфер, і стільки ж знову всередині resample.
 */
const MAX_OVERLAY_SIDE = 2048;

/** Декодує накладене: поворот за EXIF, потім межа роздільності. */
async function overlayImage(bytes: Uint8Array, mime: string) {
  let img = await codec.decode(bytes, mime);
  // HEIC — виняток: libheif застосовує поворот ще при декодуванні.
  if (mime !== 'image/heic') {
    try {
      img = orient(img, await readOrientation(bytes));
    } catch { /* биті EXIF не привід не накласти картинку */ }
  }
  return Math.max(img.width, img.height) > MAX_OVERLAY_SIDE
    ? fit(img, { width: MAX_OVERLAY_SIDE, height: MAX_OVERLAY_SIDE, mode: 'inside' })
    : img;
}

export interface CompositeOverlay {
  readonly path: string;
  /** Центр як частка ширини основи. Типово 0.5. */
  readonly x?: number | undefined;
  /** Центр як частка висоти основи. Типово 0.5. */
  readonly y?: number | undefined;
  /** Ширина як частка ширини основи. Типово 0.35. */
  readonly scale?: number | undefined;
  readonly rotation?: number | undefined;
  readonly opacity?: number | undefined;
  readonly blend?: BlendMode | undefined;
}

export interface CompositeArgs {
  readonly input: string;
  readonly output: string;
  readonly overlays: readonly CompositeOverlay[];
  readonly format?: OutputFormat | undefined;
  readonly quality?: number | undefined;
}

/**
 * Накладає зображення поверх іншого.
 *
 * Геометрія нормалізована, тож один виклик із тими самими числами дасть
 * той самий кадр на файлах різного розміру — це і є випадок водяного
 * знака на цілій теці.
 */
export async function compositeImages(args: CompositeArgs): Promise<ToolResult> {
  if (args.overlays.length === 0) {
    throw new Error('Потрібне хоча б одне накладене зображення');
  }
  const layers: Layer[] = [];
  for (const o of args.overlays) {
    const { bytes, mime } = await readImage(o.path);
    layers.push({
      image: await overlayImage(bytes, mime),
      x: o.x ?? 0.5,
      y: o.y ?? 0.5,
      scale: o.scale ?? 0.35,
      ...(o.rotation !== undefined ? { rotation: o.rotation } : {}),
      ...(o.opacity !== undefined ? { opacity: o.opacity } : {}),
      ...(o.blend !== undefined ? { blend: o.blend } : {}),
    });
  }
  const format = args.format ?? 'png';
  return runAndReport(args.input, args.output, {
    ops: [{ type: 'composite', layers }],
    output: outputOf(format, args.quality),
  });
}
