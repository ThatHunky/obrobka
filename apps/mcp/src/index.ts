#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod';
import {
  convertImage, resizeImage, removeBackground, smartCropImage, type ToolResult,
} from './tools.js';

const FORMAT = z.enum(['png', 'jpeg', 'webp', 'avif']);
const MODE = z.enum(['contain', 'cover', 'fill', 'inside', 'outside']);
const TIER = z.enum(['fast', 'portrait', 'quality']);

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

  server.registerTool('remove_background', {
    description:
      'Видаляє фон, лишаючи прозорість. Опційно малює кольорове обведення навколо ' +
      'суб\'єкта. Рівні моделі: fast — 4 МБ, будь-який сюжет; portrait — 6 МБ, ' +
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

  return server;
});
