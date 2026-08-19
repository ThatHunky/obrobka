# obrobka — універсальний медіаконвертер у браузері

**Дата:** 2026-08-19
**Статус:** затверджено, готово до планування
**Домен:** `obrobka.dobrovolskyi.com.ua`

Усі версії залежностей у цьому документі перевірені проти registry.npmjs.org,
ваги моделей — проти HuggingFace API **19 серпня 2026 року**.

---

## 1. Мета

Конвертер зображень (згодом — відео й аудіо), який виконує всю обробку
**в браузері користувача**. Файли не залишають пристрій.

Ukrainian-first: українська — мова за замовчуванням, англійська — друга.
Безкоштовний, публічний, з опційним посиланням на донат.

Та сама логіка обробки доступна агентам через MCP-сервер.

### Задача, з якої все почалося

PNG із прозорим фоном треба привести до точного розміру й співвідношення
сторін. У браузері простого способу немає. Це перше, що має запрацювати,
і воно ж — сторінка «стікер для Telegram» (512×512 PNG з прозорістю).

---

## 2. Рішення, ухвалені на етапі дизайну

| Рішення | Обґрунтування |
|---|---|
| Astro + Svelte-острівці | статичний HTML без JS на лендінгах; WASM вантажиться лише в острівці |
| Порти й адаптери | ядро без DOM і без Node працює і у вкладці, і в MCP-сервері |
| PWA і MCP паралельно | контрактні тести валідують межі ядра з першого тижня |
| Тільки MIT/Apache-моделі | донат — сіра зона для CC BY-NC; різниця в якості не варта ризику |
| Субдомен `obrobka.dobrovolskyi.com.ua` | рішення власника; SEO-стеля свідомо прийнята нижчою |
| Хостинг на Cloudflare Pages | статика й моделі роздаються глобальним CDN, не VPS |

### Свідомо прийняте обмеження

Субдомен країнного домену обмежує органічний трафік: Google трактує субдомени
як окремі сутності, `.com.ua` геотаргетований на Україну. SEO-шар усе одно
будується повністю — в Astro він майже безкоштовний — але очікування щодо
англомовного трафіку мають бути помірними.

---

## 3. Архітектура

Порти й адаптери. Ядро оперує простими буферами пікселів і отримує всі
зовнішні можливості через інтерфейси.

```
convpwa/                          pnpm workspace
├── packages/
│   ├── core/                     нуль DOM, нуль Node API
│   │   ├── src/
│   │   │   ├── types.ts          RasterImage, Mask, Job, Op
│   │   │   ├── ops/
│   │   │   │   ├── fit.ts        contain · cover · fill · inside · outside
│   │   │   │   ├── crop.ts       ручна обрізка за прямокутником
│   │   │   │   ├── mask.ts       bbox, threshold, feather, dilate
│   │   │   │   ├── smartCrop.ts  кадр за суб'єктом із маски
│   │   │   │   ├── outline.ts    дилатація маски + композиція
│   │   │   │   ├── resample.ts   вбудований bilinear/box
│   │   │   │   └── pipeline.ts   виконання Job
│   │   │   └── ports/
│   │   │       ├── Codec.ts      decode / encode
│   │   │       ├── Resampler.ts  опційний швидкий ресемплер
│   │   │       ├── Segmenter.ts  зображення → альфа-маска
│   │   │       ├── Upscaler.ts
│   │   │       └── Metadata.ts   EXIF read / strip
│   │   └── test/                 vitest, синтетичні зображення
│   ├── adapters-browser/         Worker · OffscreenCanvas · onnxruntime-web
│   ├── adapters-node/            onnxruntime-node · fs
│   └── contract-tests/           спільний набір для обох адаптерів
└── apps/
    ├── web/                      Astro + Svelte + PWA
    └── mcp/                      stdio MCP-сервер
```

### Чому саме так

`fit`, `crop`, `outline`, `smartCrop` — це арифметика над `Uint8ClampedArray`.
Вони не потребують ні канваса, ні файлової системи. Винесення їх у чисте ядро
означає, що один і той самий код обслуговує вкладку й агента, а тести
виконуються у звичайному Node за мілісекунди.

Розходяться лише реалізації портів: `Segmenter` у браузері використовує
`onnxruntime-web`, у Node — `onnxruntime-node`.

Кодеки `@jsquash/*` — це WASM-модулі, які працюють в обох середовищах,
тож порт `Codec` має спільну реалізацію з тонкою обгорткою над способом
завантаження `.wasm`.

---

## 4. Стек — перевірені версії

Дата перевірки: **2026-08-19**.

### Середовище

| | Версія | Примітка |
|---|---|---|
| Node | **24.19.0** LTS «Krypton» | локально стоїть 24.12.0 — оновити |
| pnpm | **11.22.0** | локально 10.33.0 — оновити |

Astro 7 вимагає `node >= 22.12.0`, vitest 4 — `^20 \|\| ^22 \|\| >=24`.
Лінія 24 LTS задовольняє обидва.

### Фреймворк і збірка

| Пакет | Версія |
|---|---|
| `astro` | **7.2.4** |
| `svelte` | **5.56.9** |
| `@astrojs/svelte` | **9.0.1** |
| `@astrojs/sitemap` | **3.7.3** |
| `vite` | **8.2.1** |
| `typescript` | **7.0.2** |
| `tailwindcss` | **4.3.3** |
| `@vite-pwa/astro` | **1.2.0** |

TypeScript 7 — це Go-порт компілятора. Швидкість збірки зростає в рази,
але окремі ESLint-плагіни й типові трансформери можуть ще не підтримувати
його повністю. **Ризик, який треба перевірити першим же комітом**;
запасний варіант — залишитись на лінії 5.9 до стабілізації екосистеми.

### Обробка зображень

| Пакет | Версія | Ліцензія |
|---|---|---|
| `@jsquash/png` | **3.1.1** | Apache-2.0 |
| `@jsquash/jpeg` | **1.6.0** | Apache-2.0 |
| `@jsquash/webp` | **1.5.0** | Apache-2.0 |
| `@jsquash/avif` | **2.1.1** | Apache-2.0 |
| `@jsquash/jxl` | **1.3.0** | Apache-2.0 |
| `@jsquash/resize` | **2.1.1** | Apache-2.0 |
| `libheif-js` | **1.19.8** | LGPL-3.0 |
| `exifr` | **7.1.3** | MIT |

`libheif-js` під LGPL — використовується як окремий динамічно завантажений
модуль без статичного лінкування, що вимогам LGPL відповідає.

### ML

| Пакет | Версія |
|---|---|
| `onnxruntime-web` | **1.27.0** |
| `onnxruntime-node` | **1.27.0** |

### MCP

| Пакет | Версія | Примітка |
|---|---|---|
| `@modelcontextprotocol/server` | **2.0.0** | ESM, `node >= 20` |
| `zod` | **4.4.3** | |

SDK v2 розділив пакети: `@modelcontextprotocol/server`, `/client`, `/node`.
Старий монопакет `@modelcontextprotocol/sdk` зупинився на 1.30.0.
**Беремо v2** — 3,2 млн завантажень на тиждень, API стабільний.

### Тести й утиліти

| Пакет | Версія |
|---|---|
| `vitest` | **4.1.11** |
| `@playwright/test` | **1.62.1** |
| `pixelmatch` | **7.2.0** |
| `pngjs` | **7.0.0** |
| `comlink` | **4.4.2** |
| `fflate` | **0.8.3** |

---

## 5. Моделі — результати дослідження

Ваги перевірені через HuggingFace API. **Початкова оцінка в дизайні була
заниженою втричі**: BiRefNet_lite у fp16 важить 109 МБ, а не 44 МБ, і
int8-експорту для нього не існує.

### Видалення фону

| Модель | Ліцензія | fp16 | int8 | Придатність |
|---|---|---|---|---|
| `onnx-community/mediapipe_selfie_segmentation` | Apache-2.0 | 0,2 МБ | 0,2 МБ | лише селфі |
| `BritishWerewolf/U-2-Netp` | Apache-2.0 | — | 4,4 МБ | слабко на волоссі |
| `Xenova/modnet` | Apache-2.0 | 12,4 МБ | **6,3 МБ** | портрети, добре |
| `onnx-community/ormbg-ONNX` | Apache-2.0 | 84 МБ | **42,3 МБ** | загальна, добре |
| `imgly/isnet-general-onnx` | MIT | 84,1 МБ | — | загальна, продакшн img.ly |
| `onnx-community/BiRefNet_lite` | MIT | 109,2 МБ | — | найкраща якість |
| `onnx-community/BiRefNet-ONNX` | MIT | 467 МБ | — | непридатна для вебу |

**Пастка:** `onnx-community/ISNet-ONNX` розповсюджується під **AGPL-3.0** —
вірусною ліцензією. Та сама архітектура доступна як `imgly/isnet-general-onnx`
під MIT. Переплутати легко, наслідки серйозні.

### Ухвалене рішення: три рівні замість однієї моделі

Одна модель не покриває діапазон «слабкий телефон ↔ десктоп з WebGPU».

| Рівень | Модель | Вага | Коли |
|---|---|---|---|
| **Швидко** | MODNet uint8 | 6,3 МБ | за замовчуванням; миттєве прев'ю |
| **Якісно** | ormbg int8 | 42,3 МБ | типовий вибір для експорту |
| **Максимум** | BiRefNet_lite fp16 | 109,2 МБ | явна згода, попередження про вагу |

Стратегія: прев'ю рахується «Швидко» одразу, паралельно доза­вантажується
обрана модель для фінального експорту. Користувач бачить результат через
секунду, а не через хвилину очікування завантаження.

Вибір рівня зберігається в `localStorage`, модель кешується в Cache Storage.

### Апскейл

Real-ESRGAN у чистому ONNX під відкритою ліцензією знайти не вдалося —
доступні складання важать 68 МБ і мають невизначене ліцензування.

| Модель | uint8 | Множник |
|---|---|---|
| `Xenova/swin2SR-lightweight-x2-64` | **5,3 МБ** | ×2 |
| `Xenova/swin2SR-realworld-sr-x4-64-bsrgan-psnr` | **18,1 МБ** | ×4 |

**Ліцензія Swin2SR — Apache-2.0**, підтверджено двічі: репозиторій
`mv-lab/swin2sr` віддає `Apache-2.0` через GitHub API, базові картки
`caidas/swin2SR-*` на HuggingFace мають тег `license:apache-2.0`.
Складання Xenova ліцензію в картці не вказують, але успадковують її від бази.

Обидві на порядок легші за Real-ESRGAN. Беремо їх.

### Визначення суб'єкта

Окрема модель не потрібна. Альфа-маска сегментації вже містить суб'єкт —
bounding box рахується прямим проходом по маскі з порогом. Розумна обрізка
є побічним ефектом видалення фону, а не окремим пайплайном.

---

## 6. API ядра

### Типи

```ts
export interface RasterImage {
  data: Uint8ClampedArray;   // RGBA, non-premultiplied
  width: number;
  height: number;
}

export interface Mask {
  data: Uint8ClampedArray;   // один канал, 0..255
  width: number;
  height: number;
}

export interface Rect { x: number; y: number; width: number; height: number }
export interface RGBA { r: number; g: number; b: number; a: number }

export type FitMode = 'contain' | 'cover' | 'fill' | 'inside' | 'outside';
```

### Операції

Усі операції — чисті функції. Жодного вводу-виводу, жодного глобального стану.

```ts
export function fit(img: RasterImage, opts: FitOptions): RasterImage;
export function crop(img: RasterImage, rect: Rect): RasterImage;

export function maskBBox(mask: Mask, threshold?: number): Rect;
export function featherMask(mask: Mask, radius: number): Mask;
export function dilateMask(mask: Mask, radius: number): Mask;

export function applyMask(img: RasterImage, mask: Mask): RasterImage;
export function smartCrop(img: RasterImage, mask: Mask, opts: SmartCropOptions): RasterImage;
export function outline(img: RasterImage, mask: Mask, opts: OutlineOptions): RasterImage;
```

```ts
export interface FitOptions {
  width: number;
  height: number;
  mode: FitMode;
  pad?: RGBA | 'transparent';
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right' | { x: number; y: number };
  allowUpscale?: boolean;      // за замовчуванням false
}

export interface SmartCropOptions {
  aspectRatio: number;         // ширина / висота
  padding?: number;            // частка від bbox суб'єкта, типово 0.1
  threshold?: number;          // поріг маски, типово 128
}

export interface OutlineOptions {
  width: number;               // у пікселях
  color: RGBA;
  feather?: number;
}
```

### Порти

```ts
export interface Codec {
  canDecode(mime: string): boolean;
  canEncode(format: OutputFormat): boolean;
  decode(bytes: Uint8Array, mime: string): Promise<RasterImage>;
  encode(img: RasterImage, opts: EncodeOptions): Promise<Uint8Array>;
}

export interface Segmenter {
  readonly id: string;
  readonly inputSize: number;                 // сторона квадрата входу
  load(onProgress?: (fraction: number) => void): Promise<void>;
  segment(img: RasterImage): Promise<Mask>;   // маска в роздільності входу
  dispose(): Promise<void>;
}

export interface Upscaler {
  readonly id: string;
  readonly factor: 2 | 4;
  readonly tileSize: number;
  load(onProgress?: (fraction: number) => void): Promise<void>;
  upscale(img: RasterImage): Promise<RasterImage>;
  dispose(): Promise<void>;
}

export interface Resampler {
  resize(img: RasterImage, width: number, height: number): RasterImage;
}

export interface MetadataPort {
  read(bytes: Uint8Array): Promise<Record<string, unknown>>;
  strip(bytes: Uint8Array): Promise<Uint8Array>;
}
```

`Resampler` опційний: ядро має вбудований bilinear/box, адаптери можуть
підставити `@jsquash/resize` з Lanczos3.

### Job — серіалізована одиниця роботи

```ts
export type Op =
  | ({ type: 'fit' } & FitOptions)
  | { type: 'crop'; rect: Rect }
  | ({ type: 'smartCrop' } & SmartCropOptions)
  | { type: 'removeBackground'; tier?: 'fast' | 'quality' | 'max'; feather?: number }
  | ({ type: 'outline' } & OutlineOptions)
  | { type: 'upscale'; factor: 2 | 4 }
  | { type: 'stripMetadata' };

export interface Job {
  ops: Op[];
  output: { format: OutputFormat; quality?: number };
}

export async function runJob(
  input: Uint8Array, mime: string, job: Job, ctx: Context
): Promise<Uint8Array>;
```

**`Job` — це чистий JSON.** Одна структура обслуговує три різні сценарії:

- YAML-пресет SEO-лендінгу описує `Job`
- MCP-інструмент приймає `Job`
- стан UI серіалізується в `Job` і кодується в URL для шерингу

Це головна об'єднавча властивість дизайну.

---

## 7. Веб-застосунок

### Потік даних

```
File → Worker (Comlink RPC)
  decode                  → RasterImage
  [segment]               → Mask          (ONNX, у тому ж воркері)
  [smartCrop / applyMask / outline]
  fit
  [upscale]               (тайлово)
  encode
  → Uint8Array → transferable → головний потік → Blob
```

Усе в одному воркері. Назад — через transferable buffers, без копіювання.

### Провайдери виконання ONNX

```ts
executionProviders: ['webgpu', 'wasm']
```

Ланцюг: `WebGPU → WASM SIMD+threads → WASM single-thread`.
Коли впали на найповільніший рівень — інтерфейс каже про це прямо.

**Критично:** `ort.env.wasm.proxy = true` **несумісний з WebGPU** —
GPU-буфери не є transferable. Тому ORT запускається у **нашому власному
воркері** з вимкненим проксі, а не через його вбудований механізм.

### Заголовки

`SharedArrayBuffer` для WASM-тредів вимагає crossOriginIsolated:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

`credentialless`, а не `require-corp`: він дає ті самі треди, але не ламає
вбудовування сторонніх ресурсів — банера донату, аналітики, зовнішніх картинок.

На Cloudflare Pages задається файлом `public/_headers`.

### Керування пам'яттю

wasm32 має стелю 4 ГБ, реально ~2 ГБ на вкладку. Фото 50 Мп у RGBA — 200 МБ
на буфер, і їх потрібно щонайменше два.

| Прийом | Ефект |
|---|---|
| Прев'ю максимум 2048 px; повна роздільність лише на експорті | інтерактивність не залежить від розміру файлу |
| Модель завжди отримує фіксований вхід, маска потім масштабується | **пам'ять моделі стала** незалежно від вхідного фото |
| Тайлова обробка апскейлу з перекриттям 16 px | єдиний спосіб не впертись у стелю |
| Явний `close()` на ImageBitmap, обнулення посилань | GC у воркерах лінивий |
| Жорсткий ліміт 100 Мп із зрозумілим поясненням | краще за мовчазний крах вкладки |

### Батч

Черга завдань, пул воркерів розміром `min(navigator.hardwareConcurrency - 1, 4)`.
Результат — ZIP через `fflate` у стрімовому режимі, щоб не тримати всі файли
в пам'яті одночасно.

Вхід: множинний вибір файлів; де підтримується — File System Access API
для роботи з папкою.

### PWA

`@vite-pwa/astro`, стратегія `injectManifest` — потрібен власний код сервісворкера
для кешування моделей.

- оболонка застосунку й кодеки — precache
- моделі — окремий кеш Cache Storage, cache-first, з явним керуванням
- сторінка з переліком закешованих моделей і кнопкою очищення

### Локалізація

```js
i18n: {
  locales: ['uk', 'en'],
  defaultLocale: 'uk',
  routing: { prefixDefaultLocale: false }
}
```

Українська в корені (`/видалити-фон`), англійська з префіксом (`/en/remove-background`).
`hreflang` на кожній сторінці плюс `x-default` на українську версію.

---

## 8. MCP-сервер

```ts
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod';
```

### Інструменти

| Інструмент | Призначення |
|---|---|
| `convert_image` | зміна формату та якості |
| `resize_image` | точний розмір, режим вписування, колір полів |
| `remove_background` | + опційний аутлайн, вибір рівня моделі |
| `smart_crop` | кадр за суб'єктом під задане співвідношення |
| `upscale_image` | ×2 або ×4 |
| `read_metadata` | EXIF, GPS, дані камери |
| `strip_metadata` | видалення метаданих |
| `process_batch` | glob → пайплайн → вихідна папка |

### Контракт

Інструменти оперують **шляхами до файлів**, не base64. Зображення на 5 МБ
у base64 — це ~6,7 МБ тексту, який з'їдає контекст агента без користі.

Вхід: абсолютний шлях або glob. Вихід: структурований результат зі шляхами,
розмірами до й після, застосованими операціями.

```ts
outputSchema: z.object({
  outputs: z.array(z.object({
    path: z.string(),
    width: z.number(),
    height: z.number(),
    bytes: z.number(),
    format: z.string(),
  })),
  skipped: z.array(z.object({ path: z.string(), reason: z.string() })),
})
```

Моделі в Node кешуються в `~/.cache/obrobka/models/`.

Запуск: `npx obrobka-mcp`.

---

## 9. SEO-шар

### Content collections

Astro 7 використовує `glob()`-лоадер, конфіг у `src/content.config.ts`:

```ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const tools = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/data/tools' }),
  schema: z.object({
    slug: z.string(),
    locale: z.enum(['uk', 'en']),
    title: z.string(),
    description: z.string(),
    h1: z.string(),
    preset: z.object({ ops: z.array(z.any()), output: z.any() }),
    faq: z.array(z.object({ q: z.string(), a: z.string() })),
    steps: z.array(z.string()),
    related: z.array(z.string()).default([]),
  }),
});
```

Приклад запису:

```yaml
# src/data/tools/telegram-sticker.uk.yaml
slug: стікер-для-телеграма
locale: uk
title: Зробити стікер для Telegram — 512×512 PNG онлайн і безкоштовно
h1: Стікер для Telegram із будь-якого фото
preset:
  ops:
    - { type: removeBackground, tier: quality }
    - { type: fit, width: 512, height: 512, mode: contain, pad: transparent }
  output: { format: png }
```

Один шаблон перетворює запис на сторінку з `FAQPage`, `HowTo` та
`SoftwareApplication` schema.org, парою `hreflang` і вбудованим віджетом,
уже налаштованим під цю задачу.

### Матриці сторінок

| Група | Приклади | Кількість |
|---|---|---|
| формат × формат | `png→webp`, `heic→jpg`, `jpg→avif` | ~40 |
| задача | видалити фон, обрізати, змінити розмір, стиснути, зняти EXIF, апскейл | ~12 |
| пресет платформи | інстаграм, ютуб, **стікер телеграма**, OG-image, аватар | ~15 |

× 2 локалі ≈ **130 сторінок** з одного шаблону.

### AI-видимість

- `llms.txt` у корені з переліком інструментів і того, що кожен робить
- `SoftwareApplication` + `Offer` (price: 0) на кожній сторінці
- семантичний HTML: справжні `<h1>`/`<h2>`, `<table>`, описові `alt`
- жодного контенту, який з'являється лише після виконання JS

---

## 10. Тестування

### Ядро

`vitest` над синтетичними зображеннями. Геометричні операції перевіряються
точно: вписування квадрата 100×100 у 200×100 у режимі `contain` має дати
рівно 50 px прозорих полів з кожного боку.

Golden-file порівняння через `pixelmatch` + `pngjs` для операцій, де точний
результат складно описати аналітично (feather, outline, ресемплінг).

### Контрактні тести

Головний виграш від паралельної розробки PWA і MCP. Один набір тестів
виконується проти обох адаптерів:

```ts
// packages/contract-tests/src/codec.contract.ts
export function testCodec(name: string, makeCodec: () => Promise<Codec>) {
  describe(`Codec: ${name}`, () => { /* спільні перевірки */ });
}
```

Node-адаптер ганяє його у vitest, браузерний — у Playwright. Якщо абстракція
протікає, це видно одразу, а не через місяць.

### E2E

Playwright на застосунку: завантаження файлу, обрізка, експорт, перевірка
розмірів результату. Окремий сценарій перевіряє `crossOriginIsolated === true`
і що обрано очікуваний провайдер виконання.

---

## 11. Хостинг і деплой

```
obrobka.dobrovolskyi.com.ua   CNAME →  <проєкт>.pages.dev
```

Cloudflare Pages: безкоштовно, глобальний CDN, `_headers` для COOP/COEP.
Caddy на VPS не задіяний — він продовжує обслуговувати боти.

### Розміщення моделей

**Cloudflare Pages має ліміт 25 MiB на один файл** (перевірено в документації
CF, безкоштовний план). Це розділяє моделі на дві групи:

| Модель | Вага | Де лежить |
|---|---|---|
| MODNet uint8 | 6,3 МБ | Pages, поруч зі статикою |
| Swin2SR ×2 uint8 | 5,3 МБ | Pages |
| Swin2SR ×4 uint8 | 18,1 МБ | Pages |
| ormbg int8 | 42,3 МБ | **R2** |
| BiRefNet_lite fp16 | 109,2 МБ | **R2** |

Це вдалий розподіл: усе, що потрібно за замовчуванням, лежить на тому самому
походженні, а через R2 йдуть лише моделі, які користувач свідомо вибирає.

**Cloudflare R2** — публічний бакет на `models.obrobka.dobrovolskyi.com.ua`.
Безкоштовний рівень: 10 ГБ сховища, нульовий egress. На бакеті задаються
CORS і `Cross-Origin-Resource-Policy: cross-origin` — без останнього
завантаження заблокує COEP.

Інші ліміти безкоштовного плану Pages: 20 000 файлів на проєкт, 500 збірок
на місяць, таймаут збірки 20 хвилин. Для ~130 сторінок запас великий.

---

## 12. Етапи

| Етап | Обсяг | Критерій готовності |
|---|---|---|
| **M1** | Монорепозиторій, `core` з геометрією, кодеки, браузерний і Node адаптери, контрактні тести, віджет, MCP з `convert_image`/`resize_image`, 3 SEO-сторінки як доказ шаблону | PNG без фону приводиться до 512×512 і у вкладці, і через агента |
| **M2** | `Segmenter`, три рівні моделей, видалення фону, аутлайн, розумна обрізка | фон знімається на всіх трьох рівнях, аутлайн налаштовується |
| **M3** | Батч, ZIP-експорт, HEIC на вхід, EXIF-панель | 20 файлів з айфона за один прохід |
| **M4** | `Upscaler`, тайлова обробка, WebGPU | ×2 і ×4 без вичерпання пам'яті на 12 Мп |
| **M5** | Повна SEO-матриця, `llms.txt`, PWA-поліш, i18n | ~130 сторінок, Lighthouse 100 |

Кожен етап завершується робочим станом і в PWA, і в MCP.

---

## 13. Ризики

| Ризик | Імовірність | Пом'якшення |
|---|---|---|
| TypeScript 7 не підтримується частиною інструментів | середня | перевірити першим комітом; відкат на 5.9 |
| iOS Safari падає на великих файлах | висока | нижчий ліміт мегапікселів для iOS, попередження |
| WebGPU відсутній у частини браузерів | середня | ланцюг відкату вже закладений; чесне повідомлення |
| 109 МБ моделі відлякують користувачів | висока | рівень «Швидко» за замовчуванням; вага показується до завантаження |
| Astro 7 / Vite 8 — свіжі мажори | середня | версії зафіксовані; оновлення лише свідомо |

---

## 14. Поза обсягом

- відео й аудіо (окрема фаза, окрема специфікація)
- будь-яка серверна обробка
- акаунти, історія, синхронізація
- редагування шарів, пензлі, ретуш
- моделі під некомерційними ліцензіями
