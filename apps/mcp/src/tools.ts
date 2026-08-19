import { runJob, type FitMode, type Job, type OutputFormat } from '@obrobka/core';
import { nodeCodec } from '@obrobka/codecs/node';
import { readImage, writeImage, parseColor } from './io.js';

export interface ToolResult {
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly format: OutputFormat;
}

const ctx = { codec: nodeCodec };

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
