import { runJob, type FitMode, type Job, type Op, type OutputFormat, type Tier } from '@obrobka/core';
import { nodeCodec } from '@obrobka/codecs/node';
import { createSegmenter, createUpscaler } from '@obrobka/onnx-node';
import { readImage, writeImage, parseColor } from './io.js';

export interface ToolResult {
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly format: OutputFormat;
}

const ctx = { codec: nodeCodec, segmenter: createSegmenter, upscaler: createUpscaler };

async function runAndReport(input: string, output: string, job: Job): Promise<ToolResult> {
  const { bytes, mime } = await readImage(input);
  const result = await runJob(bytes, mime, job, ctx);
  await writeImage(output, result);

  // Розмір читаємо з готового файлу, а не рахуємо: у режимах inside та
  // outside вихідні розміри навмисно не збігаються із запитаними.
  const written = await nodeCodec.decode(result, `image/${job.output.format}`);
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
