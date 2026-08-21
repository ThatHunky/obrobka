import type { Tier } from '@obrobka/core';

export type Locale = 'uk' | 'en';

/**
 * Словник інтерфейсу.
 *
 * Тексти живуть тут, а не в @obrobka/models: той пакет ділиться з
 * MCP-сервером, якому інтерфейсні рядки ні до чого.
 */
export interface Dict {
  pick: string;
  preparing: string;
  paste: string;
  dropHint: string;
  dropHintStrong: string;
  presets: { sticker: string; avatar: string; og: string; fullhd: string };
  width: string;
  height: string;
  format: string;
  formats: { png: string; webp: string; jpeg: string; avif: string };
  quality: string;
  padTransparent: string;
  padColour: string;
  allowUpscale: string;
  removeBg: string;
  model: string;
  tiers: Record<Tier, { label: string; scope: string }>;
  downloading: (label: string, pct: number) => string;
  onGpu: string;
  onCpu: string;
  shrink: string;
  feather: string;
  edgeTip: string;
  despeckle: string;
  outline: string;
  thickness: string;
  colour: string;
  fitHow: string;
  modes: Record<string, { label: string; hint: string }>;
  before: string;
  after: string;
  busy: string;
  download: string;
  errUnknownFormat: string;
  errProcess: string;
  errModel: string;
  errClipboard: string;
  errNoImage: string;
  errNoClipboardApi: string;
  units: { kb: string; mb: string; ms: string };
}

const uk: Dict = {
  pick: 'Обрати зображення',
  preparing: 'Готуємо інструмент…',
  paste: 'Вставити',
  dropHint: 'перетягніть сюди або вставте через Ctrl+V · ',
  dropHintStrong: 'файл не залишає ваш пристрій',
  presets: { sticker: 'Стікер Telegram', avatar: 'Аватар', og: 'OG-image', fullhd: 'Full HD' },
  width: 'Ширина',
  height: 'Висота',
  format: 'Формат',
  formats: {
    png: 'PNG · без втрат', webp: 'WebP · компактний',
    jpeg: 'JPEG · сумісний', avif: 'AVIF · найменший',
  },
  quality: 'Якість',
  padTransparent: 'Прозорі поля',
  padColour: 'Колір полів',
  allowUpscale: 'Дозволити збільшення',
  removeBg: 'Прибрати фон',
  model: 'Модель',
  tiers: {
    fast: { label: 'Швидко', scope: 'Будь-який сюжет' },
    portrait: { label: 'Портрет', scope: 'Портрети — найкраще тримає волосся' },
    quality: { label: 'Якісно', scope: 'Будь-який сюжет, чіткіші краї' },
  },
  downloading: (l, p) => `Завантажую ${l} — ${p} %`,
  onGpu: 'Рахую на відеокарті',
  onCpu: 'WebGPU недоступний — рахую на процесорі. Це помітно повільніше.',
  shrink: 'Стиснути край',
  feather: "Пом'якшити край",
  edgeTip: 'Кольоровий ореол по контуру — це пікселі, колір яких змішаний із фоном. '
    + 'Стиснення краю підтягує межу всередину й прибирає їх.',
  despeckle: 'Прибирати хибні плями',
  outline: 'Обведення',
  thickness: 'Товщина',
  colour: 'Колір',
  fitHow: 'Як вписати',
  modes: {
    contain: { label: 'Вписати', hint: 'Ціле зображення, вільне місце стає прозорими полями' },
    cover: { label: 'Заповнити', hint: 'Кадр заповнено повністю, що не вмістилось — обрізано' },
    fill: { label: 'Розтягнути', hint: 'Точний кадр, але пропорції спотворюються' },
    inside: { label: 'Без полів', hint: 'Вписує й віддає менший розмір — полів не буде' },
    outside: { label: 'Покрити', hint: 'Віддає більший розмір — нічого не обрізається' },
  },
  before: 'Було',
  after: 'Стало',
  busy: 'Обробляю',
  download: 'Завантажити',
  errUnknownFormat: 'Не вдалося розпізнати формат. Підтримуються PNG, JPEG, WebP і AVIF.',
  errProcess: 'Не вдалося обробити зображення',
  errModel: 'Не вдалося завантажити модель',
  errClipboard: 'Не вдалося прочитати буфер. Дозвольте доступ або натисніть Ctrl+V.',
  errNoImage: 'У буфері обміну немає зображення.',
  errNoClipboardApi: 'Браузер не дає читати буфер обміну. Натисніть Ctrl+V або Cmd+V.',
  units: { kb: 'КБ', mb: 'МБ', ms: 'мс' },
};

const en: Dict = {
  pick: 'Choose an image',
  preparing: 'Getting ready…',
  paste: 'Paste',
  dropHint: 'drop it here or paste with Ctrl+V · ',
  dropHintStrong: 'the file never leaves your device',
  presets: { sticker: 'Telegram sticker', avatar: 'Avatar', og: 'OG image', fullhd: 'Full HD' },
  width: 'Width',
  height: 'Height',
  format: 'Format',
  formats: {
    png: 'PNG · lossless', webp: 'WebP · compact',
    jpeg: 'JPEG · compatible', avif: 'AVIF · smallest',
  },
  quality: 'Quality',
  padTransparent: 'Transparent padding',
  padColour: 'Padding colour',
  allowUpscale: 'Allow upscaling',
  removeBg: 'Remove background',
  model: 'Model',
  tiers: {
    fast: { label: 'Fast', scope: 'Any subject' },
    portrait: { label: 'Portrait', scope: 'People — best on hair' },
    quality: { label: 'Precise', scope: 'Any subject, crisper edges' },
  },
  downloading: (l, p) => `Downloading ${l} — ${p}%`,
  onGpu: 'Running on the GPU',
  onCpu: 'WebGPU unavailable — running on the CPU. This is noticeably slower.',
  shrink: 'Shrink edge',
  feather: 'Soften edge',
  edgeTip: 'A coloured halo along the contour is pixels whose colour is already blended with '
    + 'the background. Shrinking the edge pulls the boundary inward and removes them.',
  despeckle: 'Remove stray patches',
  outline: 'Outline',
  thickness: 'Thickness',
  colour: 'Colour',
  fitHow: 'How to fit',
  modes: {
    contain: { label: 'Contain', hint: 'Whole image; leftover space becomes transparent padding' },
    cover: { label: 'Cover', hint: 'Frame filled completely; the overflow is cropped' },
    fill: { label: 'Stretch', hint: 'Exact frame, but the aspect ratio is distorted' },
    inside: { label: 'Inside', hint: 'Fits and returns the smaller size — no padding' },
    outside: { label: 'Outside', hint: 'Returns the larger size — nothing is cropped' },
  },
  before: 'Before',
  after: 'After',
  busy: 'Working',
  download: 'Download',
  errUnknownFormat: 'Could not recognise the format. PNG, JPEG, WebP and AVIF are supported.',
  errProcess: 'Could not process the image',
  errModel: 'Could not download the model',
  errClipboard: 'Could not read the clipboard. Allow access or press Ctrl+V.',
  errNoImage: 'There is no image in the clipboard.',
  errNoClipboardApi: 'This browser will not read the clipboard. Press Ctrl+V or Cmd+V.',
  units: { kb: 'kB', mb: 'MB', ms: 'ms' },
};

export const DICTS: Record<Locale, Dict> = { uk, en };

export function dict(locale: Locale): Dict {
  return DICTS[locale] ?? uk;
}
