#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod';
import {
  convertImage, resizeImage, removeBackground, smartCropImage, upscaleImage,
  readImageMetadata, stripImageMetadata, processBatch, compositeImages,
  type ToolResult,
} from './tools.js';

const FORMAT = z.enum(['png', 'jpeg', 'webp', 'avif']);
const MODE = z.enum(['contain', 'cover', 'fill', 'inside', 'outside']);
const TIER = z.enum(['fast', 'portrait', 'quality']);
const BLEND = z.enum(['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten']);

const RESULT = z.object({
  path: z.string(),
  width: z.number(),
  height: z.number(),
  bytes: z.number(),
  format: z.string(),
});

function report(r: ToolResult) {
  return {
    content: [{
      type: 'text' as const,
      text: `Записано ${r.path} — ${r.width}×${r.height}, ${r.format}, ${r.bytes} байт`,
    }],
    structuredContent: { ...r },
  };
}

serveStdio(() => {
  const server = new McpServer({ name: 'obrobka', version: '0.1.0' });

  server.registerTool('convert_image', {
    description:
      'Конвертує зображення в інший формат без зміни розміру. ' +
      'Працює локально, файл нікуди не надсилається.',
    inputSchema: z.object({
      input: z.string().describe('Абсолютний шлях до вхідного файлу'),
      output: z.string().describe('Абсолютний шлях для запису результату'),
      format: FORMAT.describe('Цільовий формат'),
      quality: z.number().int().min(1).max(100).optional()
        .describe('Якість 1..100. Ігнорується для png. Типово 80.'),
    }),
    outputSchema: RESULT,
  }, async (args) => report(await convertImage(args)));

  server.registerTool('resize_image', {
    description:
      'Приводить зображення до точного розміру. ' +
      'contain вписує цілком і доповнює полями; cover заповнює кадр і обрізає надлишок; ' +
      'fill розтягує; inside вписує без полів; outside покриває без обрізки.',
    inputSchema: z.object({
      input: z.string().describe('Абсолютний шлях до вхідного файлу'),
      output: z.string().describe('Абсолютний шлях для запису результату'),
      width: z.number().int().positive().describe('Цільова ширина в пікселях'),
      height: z.number().int().positive().describe('Цільова висота в пікселях'),
      mode: MODE.describe('Режим приведення'),
      pad: z.string().optional()
        .describe('Колір полів для contain як #rrggbb або #rrggbbaa. Типово прозорий.'),
      allowUpscale: z.boolean().optional()
        .describe('Чи дозволено збільшувати. Діє для contain та inside. Типово false.'),
      format: FORMAT.describe('Формат результату'),
      quality: z.number().int().min(1).max(100).optional().describe('Якість 1..100'),
    }),
    outputSchema: RESULT,
  }, async (args) => report(await resizeImage(args)));

  server.registerTool('composite_images', {
    description:
      'Накладає одне або кілька зображень поверх основи — логотип, наклейку, ' +
      'водяний знак. Геометрія задається частками сторін основи, а не пікселями: ' +
      'ті самі числа дадуть той самий кадр на файлах будь-якого розміру, ' +
      'тож один набір значень годиться для цілої теки.',
    inputSchema: z.object({
      input: z.string().describe('Абсолютний шлях до основи'),
      output: z.string().describe('Абсолютний шлях для запису результату'),
      overlays: z.array(z.object({
        path: z.string().describe('Абсолютний шлях до накладеного зображення'),
        x: z.number().min(0).max(1).optional()
          .describe('Центр як частка ширини основи. Типово 0.5.'),
        y: z.number().min(0).max(1).optional()
          .describe('Центр як частка висоти основи. Типово 0.5.'),
        scale: z.number().positive().max(4).optional()
          .describe('Ширина як частка ширини основи. Висота — з власного '
            + 'співвідношення. Типово 0.35.'),
        rotation: z.number().min(-360).max(360).optional()
          .describe('Градуси за годинниковою стрілкою. Типово 0.'),
        opacity: z.number().min(0).max(1).optional().describe('0..1. Типово 1.'),
        blend: BLEND.optional().describe('Режим накладання. Типово normal.'),
      })).min(1)
        .describe('Порядок списку — порядок накладання: перший лежить найнижче'),
      format: FORMAT.optional().describe('Формат результату. Типово png.'),
      quality: z.number().int().min(1).max(100).optional().describe('Якість 1..100'),
    }),
    outputSchema: RESULT,
  }, async (args) => report(await compositeImages(args)));

  server.registerTool('remove_background', {
    description:
      'Видаляє фон, лишаючи прозорість. Опційно малює кольорове обведення навколо ' +
      'суб\'єкта. Рівні моделі: fast — 4,4 МБ, будь-який сюжет; portrait — 12,4 МБ, ' +
      'лише люди, краще тримає волосся; quality — 84 МБ, чіткіші краї. ' +
      'Модель кешується локально після першого завантаження.',
    inputSchema: z.object({
      input: z.string().describe('Абсолютний шлях до вхідного файлу'),
      output: z.string().describe('Абсолютний шлях для запису результату'),
      tier: TIER.optional().describe('Рівень моделі. Типово fast.'),
      feather: z.number().min(0).max(20).optional()
        .describe('Пом\'якшення краю маски в пікселях. Типово 0.'),
      outlineWidth: z.number().int().min(0).max(200).optional()
        .describe('Товщина обведення в пікселях. 0 або відсутнє — без обведення.'),
      outlineColor: z.string().optional()
        .describe('Колір обведення як #rrggbb або #rrggbbaa. Типово білий.'),
      format: z.enum(['png', 'webp', 'avif']).optional()
        .describe('Формат результату. JPEG недоступний — він не має альфа-каналу.'),
    }),
    outputSchema: RESULT,
  }, async (args) => report(await removeBackground(args)));

  server.registerTool('smart_crop', {
    description:
      'Кадрує зображення під задане співвідношення сторін, тримаючи суб\'єкт у кадрі. ' +
      'Фон зберігається — модель використовується лише щоб знайти суб\'єкт.',
    inputSchema: z.object({
      input: z.string().describe('Абсолютний шлях до вхідного файлу'),
      output: z.string().describe('Абсолютний шлях для запису результату'),
      aspectRatio: z.number().positive()
        .describe('Ширина поділена на висоту, напр. 1 або 1.7778'),
      padding: z.number().min(0).max(2).optional()
        .describe('Запас навколо суб\'єкта як частка його розміру. Типово 0.08.'),
      tier: TIER.optional().describe('Рівень моделі для пошуку суб\'єкта. Типово fast.'),
      format: FORMAT.describe('Формат результату'),
      quality: z.number().int().min(1).max(100).optional().describe('Якість 1..100'),
    }),
    outputSchema: RESULT,
  }, async (args) => report(await smartCropImage(args)));

  server.registerTool('upscale_image', {
    description:
      'Збільшує зображення нейромережею Swin2SR — удвічі або вчетверо. ' +
      'Виконується тайлами, тож пам\'ять не залежить від розміру, а час залежить ' +
      'прямо: близько 2,6 с на тайл на звичайному процесорі. Для великих ' +
      'зображень це хвилини.',
    inputSchema: z.object({
      input: z.string().describe('Абсолютний шлях до вхідного файлу'),
      output: z.string().describe('Абсолютний шлях для запису результату'),
      factor: z.union([z.literal(2), z.literal(4)]).optional()
        .describe('Множник збільшення. Типово 2.'),
      format: FORMAT.optional().describe('Формат результату. Типово png.'),
      quality: z.number().int().min(1).max(100).optional().describe('Якість 1..100'),
    }),
    outputSchema: RESULT,
  }, async (args) => report(await upscaleImage(args)));

  server.registerTool('read_metadata', {
    description:
      'Читає метадані зображення, не змінюючи файл: камера, дата зйомки, ' +
      'параметри експозиції, орієнтація та координати GPS. Орієнтація віддається ' +
      'числом теґу EXIF (1..8). Читає JPEG, PNG, TIFF, HEIC та AVIF. ' +
      'Файл без метаданих дає порожній результат, а не помилку.',
    inputSchema: z.object({
      input: z.string().describe('Абсолютний шлях до файлу'),
    }),
    outputSchema: z.object({
      path: z.string(),
      hasGps: z.boolean(),
      metadata: z.object({
        orientation: z.number().optional(),
        camera: z.object({
          make: z.string().optional(),
          model: z.string().optional(),
          lens: z.string().optional(),
        }).optional(),
        shot: z.object({
          takenAt: z.string().optional(),
          exposureTime: z.number().optional(),
          fNumber: z.number().optional(),
          iso: z.number().optional(),
          focalLength: z.number().optional(),
        }).optional(),
        gps: z.object({
          latitude: z.number(),
          longitude: z.number(),
          altitude: z.number().optional(),
        }).optional(),
        software: z.string().optional(),
        tags: z.record(z.string(), z.unknown()),
      }),
    }),
  }, async (args) => {
    const r = await readImageMetadata(args);
    const found = Object.keys(r.metadata.tags).length;
    return {
      content: [{
        type: 'text' as const,
        text: found === 0
          ? `У ${r.path} метаданих немає`
          : `У ${r.path} знайдено ${found} теґів` +
            (r.hasGps
              ? `, серед них координати ${r.metadata.gps!.latitude.toFixed(5)}, ` +
                `${r.metadata.gps!.longitude.toFixed(5)}`
              : ', координат немає'),
      }],
      structuredContent: { ...r },
    };
  });

  server.registerTool('strip_metadata', {
    description:
      'Знімає метадані, не перестискаючи зображення: байти пікселів лишаються ' +
      'ті самі. Підтримує JPEG, PNG і WebP. Профіль ICC зберігається — він задає ' +
      'кольори, а не описує автора. Для AVIF і HEIC скористайтесь convert_image: ' +
      'при перекодуванні метадані не переносяться взагалі.',
    inputSchema: z.object({
      input: z.string().describe('Абсолютний шлях до вхідного файлу'),
      output: z.string().describe('Абсолютний шлях для запису результату'),
    }),
    outputSchema: z.object({
      path: z.string(),
      bytesBefore: z.number(),
      bytesAfter: z.number(),
      removed: z.array(z.string()),
    }),
  }, async (args) => {
    const r = await stripImageMetadata(args);
    return {
      content: [{
        type: 'text' as const,
        text: r.removed.length === 0
          ? `${r.path}: знімати не було чого`
          : `${r.path}: прибрано ${r.removed.length} теґів ` +
            `(${r.removed.slice(0, 6).join(', ')}${r.removed.length > 6 ? '…' : ''}), ` +
            `${r.bytesBefore} → ${r.bytesAfter} байт`,
      }],
      structuredContent: { ...r },
    };
  });

  server.registerTool('process_batch', {
    description:
      'Проганяє всі файли за маскою через один набір операцій і складає ' +
      'результати в теку. Формат обов\'язковий; розмір, видалення фону та ' +
      'збільшення — за бажанням. Орієнтація EXIF застосовується сама, тож ' +
      'вертикальні знімки з телефона не лягають набік. HEIC читається. ' +
      'Виконується послідовно: двадцять фотографій по 12 Мп — близько 18 с ' +
      'без моделі, значно довше зі збільшенням. Битий файл не зупиняє решту, ' +
      'а потрапляє в errors.',
    inputSchema: z.object({
      pattern: z.string().describe('Маска файлів, напр. "*.heic" або "photos/**/*.jpg"'),
      cwd: z.string().optional().describe('Тека, відносно якої діє маска. Типово поточна.'),
      outputDir: z.string().describe('Тека для результатів. Створюється за потреби.'),
      format: FORMAT.describe('Формат результатів'),
      quality: z.number().int().min(1).max(100).optional().describe('Якість 1..100'),
      width: z.number().int().positive().optional()
        .describe('Цільова ширина. Діє лише разом із height.'),
      height: z.number().int().positive().optional()
        .describe('Цільова висота. Діє лише разом із width.'),
      mode: MODE.optional().describe('Режим приведення. Типово inside — без полів.'),
      allowUpscale: z.boolean().optional().describe('Чи дозволено збільшувати. Типово false.'),
      removeBackground: z.boolean().optional().describe('Прибрати фон на кожному файлі'),
      tier: TIER.optional().describe('Рівень моделі. Типово fast.'),
      upscale: z.union([z.literal(2), z.literal(4)]).optional()
        .describe('Збільшити нейромережею. Дуже повільно на великому наборі.'),
      limit: z.number().int().positive().max(1000).optional()
        .describe('Скільки файлів обробити щонайбільше. Типово 100.'),
    }),
    outputSchema: z.object({
      outputs: z.array(RESULT),
      errors: z.array(z.object({ input: z.string(), message: z.string() })),
      skipped: z.number(),
    }),
  }, async (args) => {
    const r = await processBatch(args);
    const parts = [`Оброблено ${r.outputs.length}`];
    if (r.errors.length > 0) parts.push(`помилок ${r.errors.length}`);
    if (r.skipped > 0) parts.push(`пропущено за лімітом ${r.skipped}`);
    return {
      content: [{ type: 'text' as const, text: parts.join(', ') }],
      structuredContent: { ...r },
    };
  });

  return server;
});
