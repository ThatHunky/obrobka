import type { Job, Mask, Op, RasterImage, Tier } from '../types.js';
import type { Context } from '../ports/index.js';
import { fit } from './fit.js';
import { crop } from './crop.js';
import { applyMask } from './applyMask.js';
import { outline } from './outline.js';
import { smartCrop } from './smartCrop.js';
import { featherMask } from './mask.js';

const NEEDS_MASK: ReadonlySet<Op['type']> = new Set(['removeBackground', 'outline', 'smartCrop']);

function tierOf(ops: readonly Op[]): Tier {
  for (const op of ops) {
    if (op.type === 'removeBackground' && op.tier !== undefined) return op.tier;
    if (op.type === 'smartCrop' && op.tier !== undefined) return op.tier;
  }
  return 'fast';
}

/**
 * Готує маску один раз на весь Job.
 *
 * Видалення фону, аутлайн і розумна обрізка спираються на ту саму маску.
 * Рахувати її тричі означало б утричі довше чекати найдорожчий крок
 * пайплайна — для isnet це 665 мс проти двох секунд.
 */
async function buildMask(img: RasterImage, job: Job, ctx: Context): Promise<Mask> {
  if (ctx.segmenter === undefined) {
    throw new Error(
      'Операція потребує маски, але сегментатор не переданий у контекст. ' +
      'Додайте ctx.segmenter — без нього доступні лише геометричні операції.',
    );
  }
  const seg = ctx.segmenter(tierOf(job.ops));
  await seg.load();
  try {
    return await seg.segment(img);
  } finally {
    await seg.dispose();
  }
}

function applyOp(img: RasterImage, op: Op, mask: Mask | null): RasterImage {
  switch (op.type) {
    case 'fit': return fit(img, op);
    case 'crop': return crop(img, op.rect);
    case 'removeBackground': {
      const m = op.feather !== undefined && op.feather > 0
        ? featherMask(mask!, op.feather)
        : mask!;
      return applyMask(img, m);
    }
    case 'outline': return outline(img, mask!, op);
    case 'smartCrop': return smartCrop(img, mask!, op);
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
  const mask = job.ops.some((o) => NEEDS_MASK.has(o.type))
    ? await buildMask(img, job, ctx)
    : null;

  for (const op of job.ops) img = applyOp(img, op, mask);
  return ctx.codec.encode(img, job.output);
}
