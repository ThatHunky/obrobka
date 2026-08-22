import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { generatedPages } from './data/generated/index.js';

const preset = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  mode: z.enum(['contain', 'cover', 'fill', 'inside', 'outside']),
  format: z.enum(['png', 'jpeg', 'webp', 'avif']),
  padTransparent: z.boolean().default(true),
  removeBg: z.boolean().default(false),
  tier: z.enum(['fast', 'portrait', 'quality']).default('fast'),
  outlineOn: z.boolean().default(false),
  outlineWidth: z.number().int().min(0).default(0),
});

const page = z.object({
  /** Формат→формат, розмір під платформу чи задача. Написані руками — задачі. */
  group: z.enum(['format', 'preset', 'task']).default('task'),
  slug: z.string(),
  locale: z.enum(['uk', 'en']),
  /** id парної сторінки в іншій локалі */
  pair: z.string(),
  title: z.string(),
  description: z.string(),
  h1: z.string(),
  intro: z.string(),
  preset,
  steps: z.array(z.string()).min(2),
  faq: z.array(z.object({ q: z.string(), a: z.string() })).min(1),
});

const tools = defineCollection({
  loader: glob({
    pattern: '**/*.yaml',
    base: './src/data/tools',
    // Типовий generateId зрізає обидва розширення, тож telegram-sticker.uk
    // і telegram-sticker.en отримали б однаковий id. Лишаємо суфікс локалі —
    // саме за ним записи знаходять свою пару.
    generateId: ({ entry }) => entry.replace(/\.yaml$/, ''),
  }),
  schema: page,
});

/**
 * Породжені сторінки — окремою колекцією, а не окремими файлами YAML.
 *
 * Вісімдесят згенерованих файлів у репозиторії створювали б ілюзію, що
 * їх писали руками, і кожна правка тексту тягла б за собою перегенерацію
 * та величезний diff. Джерело правди — код; колекція лише подає його
 * маршруту в тому самому вигляді, що й написані вручну сторінки.
 */
const generated = defineCollection({
  loader: () => generatedPages(),
  schema: page,
});

export const collections = { tools, generated };
