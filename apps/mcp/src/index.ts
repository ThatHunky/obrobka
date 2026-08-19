#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod';
import { convertImage, resizeImage, type ToolResult } from './tools.js';

const FORMAT = z.enum(['png', 'jpeg', 'webp', 'avif']);
const MODE = z.enum(['contain', 'cover', 'fill', 'inside', 'outside']);

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

  return server;
});
