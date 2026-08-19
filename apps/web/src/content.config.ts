import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const tools = defineCollection({
  loader: glob({
    pattern: '**/*.yaml',
    base: './src/data/tools',
    // Типовий generateId зрізає обидва розширення, тож telegram-sticker.uk
    // і telegram-sticker.en отримали б однаковий id. Лишаємо суфікс локалі —
    // саме за ним записи знаходять свою пару.
    generateId: ({ entry }) => entry.replace(/\.yaml$/, ''),
  }),
  schema: z.object({
    slug: z.string(),
    locale: z.enum(['uk', 'en']),
    /** id парної сторінки в іншій локалі */
    pair: z.string(),
    title: z.string(),
    description: z.string(),
    h1: z.string(),
    intro: z.string(),
    preset: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      mode: z.enum(['contain', 'cover', 'fill', 'inside', 'outside']),
      format: z.enum(['png', 'jpeg', 'webp', 'avif']),
      padTransparent: z.boolean().default(true),
      removeBg: z.boolean().default(false),
      tier: z.enum(['fast', 'portrait', 'quality']).default('fast'),
      outlineOn: z.boolean().default(false),
      outlineWidth: z.number().int().min(0).default(0),
    }),
    steps: z.array(z.string()).min(2),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).min(1),
  }),
});

export const collections = { tools };
