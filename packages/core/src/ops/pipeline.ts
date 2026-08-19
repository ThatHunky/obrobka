import type { Job, Op, RasterImage } from '../types.js';
import type { Context } from '../ports/index.js';
import { fit } from './fit.js';
import { crop } from './crop.js';

function applyOp(img: RasterImage, op: Op): RasterImage {
  switch (op.type) {
    case 'fit': return fit(img, op);
    case 'crop': return crop(img, op.rect);
    default: {
      const unknown = op as { type: string };
      throw new Error(`Невідома операція: ${unknown.type}`);
    }
  }
}

/** Виконує Job: декодування → операції по черзі → кодування. */
export async function runJob(
  input: Uint8Array, mime: string, job: Job, ctx: Context,
): Promise<Uint8Array> {
  if (!ctx.codec.canDecode(mime)) {
    throw new Error(`Формат ${mime} не підтримується для читання`);
  }
  if (!ctx.codec.canEncode(job.output.format)) {
    throw new Error(`Формат ${job.output.format} не підтримується для запису`);
  }

  let img = await ctx.codec.decode(input, mime);
  for (const op of job.ops) img = applyOp(img, op);
  return ctx.codec.encode(img, job.output);
}
