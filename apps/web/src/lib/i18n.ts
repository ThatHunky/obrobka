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
  crop: {
    section: string;
    ratio: string;
    ratioFree: string;
    swap: string;
    anchor: string;
    anchorHint: string;
    framing: string;
    framingNone: string;
    framingSmart: string;
    framingSmartHint: string;
    framingTrim: string;
    framingTrimHint: string;
    padding: string;
    needsModel: string;
  };
  positions: Record<string, string>;
  upscale: {
    section: string;
    off: string;
    x2: string;
    x4: string;
    note: string;
    slowWarning: string;
    tiles: (done: number, total: number) => string;
    estimate: (seconds: number) => string;
  };
  stats: {
    title: string;
    runs: string;
    cities: string;
    note: string;
    empty: string;
    ops: Record<string, string>;
  };
  batch: {
    title: string;
    files: (n: number) => string;
    processing: (done: number, total: number) => string;
    statuses: Record<'queued' | 'working' | 'done' | 'error', string>;
    run: string;
    rerun: string;
    downloadZip: string;
    total: string;
    cancel: string;
    clear: string;
    failed: (n: number) => string;
    modelIsSerial: string;
    settingsApply: string;
  };
  storage: {
    reading: string;
    empty: string;
    total: string;
    clear: string;
    clearing: string;
    offlineReady: string;
    offlineNot: string;
    quota: (used: string, total: string) => string;
    errRead: string;
    errClear: string;
  };
  exif: {
    title: string;
    none: string;
    camera: string;
    taken: string;
    settings: string;
    gps: string;
    gpsWarning: string;
    map: string;
    orientation: string;
    orientationApplied: string;
    software: string;
    cleanResult: string;
    more: (n: number) => string;
  };
}

/**
 * Українська має три форми множини, і «3 файлів» замість «3 файли» —
 * саме та дрібниця, за якою видно машинний переклад.
 */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
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
  errUnknownFormat: 'Не вдалося розпізнати формат. Підтримуються PNG, JPEG, WebP, AVIF і HEIC.',
  errProcess: 'Не вдалося обробити зображення',
  errModel: 'Не вдалося завантажити модель',
  errClipboard: 'Не вдалося прочитати буфер. Дозвольте доступ або натисніть Ctrl+V.',
  errNoImage: 'У буфері обміну немає зображення.',
  errNoClipboardApi: 'Браузер не дає читати буфер обміну. Натисніть Ctrl+V або Cmd+V.',
  units: { kb: 'КБ', mb: 'МБ', ms: 'мс' },
  crop: {
    section: 'Обрізка',
    ratio: 'Співвідношення',
    ratioFree: 'вільно',
    swap: 'Поміняти сторони місцями',
    anchor: 'Прив’язка',
    anchorHint: 'Куди тягнути вміст, коли він не заповнює кадр або не вміщується',
    framing: 'Кадрування',
    framingNone: 'Не обрізати',
    framingSmart: 'За суб’єктом',
    framingSmartHint: 'Кадр будується навколо того, що модель визнала головним',
    framingTrim: 'Прибрати порожні краї',
    framingTrimHint: 'Обрізає до прямокутника суб’єкта, без нав’язаного співвідношення',
    padding: 'Запас',
    needsModel: 'потрібна модель',
  },
  positions: {
    'top-left': 'вгорі ліворуч', top: 'вгорі', 'top-right': 'вгорі праворуч',
    left: 'ліворуч', center: 'по центру', right: 'праворуч',
    'bottom-left': 'внизу ліворуч', bottom: 'внизу', 'bottom-right': 'внизу праворуч',
  },
  upscale: {
    section: 'Збільшення',
    off: 'Не збільшувати',
    x2: 'удвічі',
    x4: 'учетверо',
    note: 'Нейромережа домальовує деталі, яких немає в оригіналі. Працює тайлами, '
      + 'тож пам’ять не залежить від розміру — а от час залежить прямо.',
    slowWarning: 'На процесорі це помітно повільно. Якщо є WebGPU, буде значно швидше.',
    tiles: (d, n) => `Тайл ${d} з ${n}`,
    estimate: (sec) => sec < 60
      ? `приблизно ${Math.round(sec)} с`
      : `приблизно ${Math.round(sec / 60)} хв`,
  },
  stats: {
    title: 'Скільки цим користуються',
    runs: 'обробок',
    cities: 'Звідки заходять',
    note: 'Рахуються лише суми: скільки разів виконано операцію і в якому місті. '
      + 'Ні кук, ні ідентифікаторів, ні IP-адрес. Зображення сюди не потрапляють — '
      + 'вони взагалі не покидають вашу вкладку.',
    empty: 'Поки що тиша. Обробіть щось — і лічильник зрушить.',
    ops: {
      resize: 'зміна розміру', convert: 'конвертація',
      removeBackground: 'видалення фону', outline: 'обведення',
      smartCrop: 'розумна обрізка', trim: 'обрізка країв',
    },
  },
  batch: {
    title: 'Пакет',
    files: (n) => `${n} ${plural(n, 'файл', 'файли', 'файлів')}`,
    processing: (d, t) => `Обробляю ${d} з ${t}`,
    statuses: { queued: 'у черзі', working: 'обробляю', done: 'готово', error: 'помилка' },
    run: 'Обробити',
    rerun: 'Налаштування змінились — обробити наново',
    downloadZip: 'Завантажити ZIP',
    total: 'разом',
    cancel: 'Спинити',
    clear: 'Очистити',
    failed: (n) => `${n} ${plural(n, 'файл не вдалося', 'файли не вдалося', 'файлів не вдалося')}`,
    modelIsSerial: 'З моделлю файли йдуть по одному: чотири сесії з’їли б понад гігабайт '
      + 'пам’яті, а швидше стало б лише вдвічі.',
    settingsApply: 'Налаштування нижче діють на всі файли пакета.',
  },
  storage: {
    reading: 'Дивлюся, що збережено…',
    empty: 'Моделей у кеші немає. Вони з’являться, коли ви скористаєтесь '
      + 'видаленням фону або збільшенням.',
    total: 'Разом',
    clear: 'Очистити кеш моделей',
    clearing: 'Очищаю…',
    offlineReady: 'Оболонку збережено — сайт відкриється без мережі.',
    offlineNot: 'Оболонку ще не збережено. Перезавантажте сторінку, '
      + 'і вона стане доступною без мережі.',
    quota: (used, total) => `Цей сайт займає ${used} з приблизно ${total}, `
      + 'доступних йому у вашому браузері.',
    errRead: 'Не вдалося прочитати кеш',
    errClear: 'Не вдалося очистити кеш',
  },
  exif: {
    title: 'Що записано у файлі',
    none: 'Метаданих немає',
    camera: 'Камера',
    taken: 'Знято',
    settings: 'Параметри',
    gps: 'Координати',
    gpsWarning: 'У цьому файлі записано, де його зняли.',
    map: 'на карті',
    orientation: 'Орієнтація',
    orientationApplied: 'застосовано автоматично',
    software: 'Програма',
    cleanResult: 'У результат нічого з цього не потрапить: зображення перемальовується '
      + 'з нуля, і метадані не переносяться.',
    more: (n) => `ще ${n} ${plural(n, 'теґ', 'теґи', 'теґів')}`,
  },
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
  errUnknownFormat: 'Could not recognise the format. PNG, JPEG, WebP, AVIF and HEIC are supported.',
  errProcess: 'Could not process the image',
  errModel: 'Could not download the model',
  errClipboard: 'Could not read the clipboard. Allow access or press Ctrl+V.',
  errNoImage: 'There is no image in the clipboard.',
  errNoClipboardApi: 'This browser will not read the clipboard. Press Ctrl+V or Cmd+V.',
  units: { kb: 'kB', mb: 'MB', ms: 'ms' },
  crop: {
    section: 'Cropping',
    ratio: 'Aspect ratio',
    ratioFree: 'free',
    swap: 'Swap sides',
    anchor: 'Anchor',
    anchorHint: 'Where to pull the content when it does not fill the frame, or overflows it',
    framing: 'Framing',
    framingNone: 'No cropping',
    framingSmart: 'On the subject',
    framingSmartHint: 'The frame is built around whatever the model considers the subject',
    framingTrim: 'Trim empty edges',
    framingTrimHint: 'Crops to the subject rectangle, with no aspect ratio imposed',
    padding: 'Margin',
    needsModel: 'needs a model',
  },
  positions: {
    'top-left': 'top left', top: 'top', 'top-right': 'top right',
    left: 'left', center: 'centre', right: 'right',
    'bottom-left': 'bottom left', bottom: 'bottom', 'bottom-right': 'bottom right',
  },
  upscale: {
    section: 'Upscaling',
    off: 'No upscaling',
    x2: '2×',
    x4: '4×',
    note: 'The network invents detail that is not in the original. It works in tiles, '
      + 'so memory does not depend on image size — but time does, directly.',
    slowWarning: 'This is noticeably slow on a CPU. With WebGPU it is far quicker.',
    tiles: (d, n) => `Tile ${d} of ${n}`,
    estimate: (sec) => sec < 60
      ? `about ${Math.round(sec)} s`
      : `about ${Math.round(sec / 60)} min`,
  },
  stats: {
    title: 'How much this gets used',
    runs: 'runs',
    cities: 'Where from',
    note: 'Only totals are counted: how often an operation ran and in which city. '
      + 'No cookies, no identifiers, no IP addresses. Images never reach this counter — '
      + 'they never leave your tab at all.',
    empty: 'Nothing yet. Process something and the counter will move.',
    ops: {
      resize: 'resize', convert: 'convert',
      removeBackground: 'background removal', outline: 'outline',
      smartCrop: 'smart crop', trim: 'trim edges',
    },
  },
  batch: {
    title: 'Batch',
    files: (n) => `${n} ${n === 1 ? 'file' : 'files'}`,
    processing: (d, t) => `Processing ${d} of ${t}`,
    statuses: { queued: 'queued', working: 'working', done: 'done', error: 'failed' },
    run: 'Process',
    rerun: 'Settings changed — process again',
    downloadZip: 'Download ZIP',
    total: 'total',
    cancel: 'Stop',
    clear: 'Clear',
    failed: (n) => `${n} ${n === 1 ? 'file' : 'files'} failed`,
    modelIsSerial: 'With a model, files go one at a time: four sessions would eat over a '
      + 'gigabyte of memory and only run twice as fast.',
    settingsApply: 'The settings below apply to every file in the batch.',
  },
  storage: {
    reading: 'Checking what is stored…',
    empty: 'No models cached. They appear once you use background removal or upscaling.',
    total: 'Total',
    clear: 'Clear the model cache',
    clearing: 'Clearing…',
    offlineReady: 'The shell is stored — the site will open without a network.',
    offlineNot: 'The shell is not stored yet. Reload the page and it will become '
      + 'available offline.',
    quota: (used, total) => `This site takes ${used} of roughly ${total} available to it `
      + 'in your browser.',
    errRead: 'Could not read the cache',
    errClear: 'Could not clear the cache',
  },
  exif: {
    title: 'What the file records',
    none: 'No metadata',
    camera: 'Camera',
    taken: 'Taken',
    settings: 'Settings',
    gps: 'Coordinates',
    gpsWarning: 'This file records where the photo was taken.',
    map: 'on a map',
    orientation: 'Orientation',
    orientationApplied: 'applied automatically',
    software: 'Software',
    cleanResult: 'None of this reaches the result: the image is redrawn from scratch, '
      + 'and metadata is not carried over.',
    more: (n) => `${n} more ${n === 1 ? 'tag' : 'tags'}`,
  },
};

export const DICTS: Record<Locale, Dict> = { uk, en };

export function dict(locale: Locale): Dict {
  return DICTS[locale] ?? uk;
}
