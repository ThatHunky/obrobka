import type { Job, Mask, Op, RasterImage, Tier } from '../types.js';
import type { Context } from '../ports/index.js';
import { fit } from './fit.js';
import { crop } from './crop.js';
import { applyMask } from './applyMask.js';
import { outlineWithRing } from './outline.js';
import { composite } from './composite.js';
import { paint, paintMask } from './paint.js';
import { smartCrop } from './smartCrop.js';
import { trim } from './trim.js';
import { despeckleMask, erodeMask, featherMask, fillMaskHoles, resampleMask } from './mask.js';
import { upscaleTiled } from './upscale.js';
import { orient } from './orient.js';

const NEEDS_MASK: ReadonlySet<Op['type']> = new Set(['removeBackground', 'outline', 'smartCrop', 'trim']);

function tierOf(ops: readonly Op[]): Tier {
  for (const op of ops) {
    if (op.type === 'removeBackground' && op.tier !== undefined) return op.tier;
    if (op.type === 'smartCrop' && op.tier !== undefined) return op.tier;
    if (op.type === 'trim' && op.tier !== undefined) return op.tier;
  }
  return 'fast';
}

/**
 * Чистить маску одразу після моделі — до того, як її побачать усі операції.
 *
 * Робиться централізовано навмисно: обведення, розумна обрізка й видалення
 * фону мають спиратися на однакову маску. Якби чистка жила лише всередині
 * removeBackground, обведення обводило б хибні острівці, які вже прибрані
 * з видимого результату.
 *
 * Острівці й дірки міряються частками кадру, тож їм байдуже, в якій
 * роздільності маска, — і вони лишаються в дешевій роздільності моделі.
 * Стискання ж задане в пікселях, і це пікселі зображення: у 320² моделі
 * один піксель — це дванадцять пікселів дванадцятимегапіксельного фото.
 * Тож маска спершу доводиться до розміру кадру, а стискається вже там.
 */
function refineMask(mask: Mask, img: RasterImage, ops: readonly Op[]): Mask {
  const bg = ops.find((o) => o.type === 'removeBackground');
  const despeckle = bg?.type === 'removeBackground' ? bg.despeckle !== false : true;
  const fill = bg?.type === 'removeBackground' ? bg.fillHoles !== false : true;
  const shrink = bg?.type === 'removeBackground' ? bg.shrink ?? 1 : 0;

  let m = mask;
  if (despeckle) m = despeckleMask(m);
  if (fill) m = fillMaskHoles(m);
  m = toSize(m, img);
  if (shrink > 0) m = erodeMask(m, shrink);
  return m;
}

function toSize(mask: Mask, img: RasterImage): Mask {
  return mask.width === img.width && mask.height === img.height
    ? mask
    : resampleMask(mask, img.width, img.height);
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
    return refineMask(await seg.segment(img), img, job.ops);
  } finally {
    await seg.dispose();
  }
}

/**
 * Збільшення — єдина асинхронна операція: вона ходить у модель тайлами.
 * Решта лишається чистими синхронними функціями.
 */
async function applyUpscale(
  img: RasterImage, factor: 2 | 4, ctx: Context,
): Promise<RasterImage> {
  if (ctx.upscaler === undefined) {
    throw new Error(
      'Збільшення потребує апскейлера, але його не передано в контекст. ' +
      'Додайте ctx.upscaler.',
    );
  }
  const up = ctx.upscaler(factor);
  await up.load();
  try {
    return await upscaleTiled(img, up, (done, total) => {
      ctx.onProgress?.('upscale', done, total);
    });
  } finally {
    await up.dispose();
  }
}

/**
 * Повертає кадр за теґом EXIF — до всього іншого.
 *
 * Порядок принциповий. Маска, розумна обрізка й прив'язка полів працюють
 * у координатах, і людина задає їх, дивлячись на зображення таким, яким
 * його показує браузер, — тобто вже поверненим. Повернути кадр після них
 * означало б, що «вгорі ліворуч» опиниться не там, де його бачили.
 *
 * Помилка читання нічого не зупиняє: биті EXIF трапляються, і це не привід
 * не обробити фотографію.
 *
 * HEIC — виняток. Там орієнтація живе в самому контейнері (властивість
 * `irot`), і libheif застосовує її ще при декодуванні. Якби ми поверх
 * цього наклали ще й теґ EXIF, знімок із обома позначками виїхав би
 * на 180° від правильного.
 */
async function autoOrient(
  img: RasterImage, input: Uint8Array, mime: string, job: Job, ctx: Context,
): Promise<RasterImage> {
  if (job.autoOrient === false || ctx.metadata === undefined) return img;
  if (mime === 'image/heic') return img;
  try {
    return orient(img, await ctx.metadata.readOrientation(input));
  } catch {
    return img;
  }
}

/**
 * Крок пайплайна: нове зображення й маска, яка йому відповідає.
 *
 * Пензель і обведення міняють не лише пікселі, а й те, що вважати
 * суб'єктом, тож маску після них несемо далі оновленою.
 */
function applyOp(
  img: RasterImage, op: Op, mask: Mask | null,
): { img: RasterImage; mask: Mask | null } {
  switch (op.type) {
    case 'fit': return { img: fit(img, op), mask };
    case 'crop': return { img: crop(img, op.rect), mask };
    case 'removeBackground': {
      // Пом'якшення — у пікселях того кадру, з якого знімаємо фон
      const base = toSize(mask!, img);
      const m = op.feather !== undefined && op.feather > 0
        ? featherMask(base, op.feather)
        : base;
      return { img: applyMask(img, m), mask };
    }
    case 'outline': {
      const o = outlineWithRing(img, mask!, op);
      return { img: o.image, mask: o.ring };
    }
    case 'smartCrop': return { img: smartCrop(img, mask!, op), mask };
    case 'trim': return { img: trim(img, mask!, op), mask };
    case 'composite': return { img: composite(img, op.layers), mask };
    case 'paint':
      return { img: paint(img, op), mask: mask === null ? null : paintMask(toSize(mask, img), op) };
    case 'upscale':
      throw new Error('Збільшення виконується окремо — сюди воно не має потрапляти');
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

  let img = await autoOrient(await ctx.codec.decode(input, mime), input, mime, job, ctx);
  let mask = job.ops.some((o) => NEEDS_MASK.has(o.type))
    ? await buildMask(img, job, ctx)
    : null;

  for (const op of job.ops) {
    if (op.type === 'upscale') {
      img = await applyUpscale(img, op.factor, ctx);
      continue;
    }
    ({ img, mask } = applyOp(img, op, mask));
  }
  return ctx.codec.encode(img, job.output);
}
