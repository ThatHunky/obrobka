import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { pathOf } from '../lib/catalogue.js';

/**
 * llms.txt — те саме, що sitemap, але для мовної моделі.
 *
 * Сенс не в переліку адрес: їх видно і з sitemap. Сенс у тому, щоб агент
 * зрозумів межі інструмента, не витягуючи вісімдесят сторінок HTML —
 * що вміємо, чого не вміємо, і що є MCP-сервер, через який усе те саме
 * робиться без браузера взагалі.
 *
 * Генерується з тих самих даних, що й сторінки: окремий список неминуче
 * розійшовся б із дійсністю після першої ж правки.
 */

const SITE = 'https://obrobka.dobrovolskyi.com.ua';

export const GET: APIRoute = async () => {
  const entries = [...await getCollection('tools'), ...await getCollection('generated')];
  const uk = entries.filter((e) => e.data.locale === 'uk');
  const en = entries.filter((e) => e.data.locale === 'en');

  const group = (locale: 'uk' | 'en', g: 'task' | 'format' | 'preset'): string =>
    (locale === 'uk' ? uk : en)
      .filter((e) => e.data.group === g)
      .sort((a, b) => a.data.slug.localeCompare(b.data.slug))
      .map((e) => `- [${e.data.h1}](${SITE}${pathOf(e.data)}): ${e.data.description}`)
      .join('\n');

  const body = `# obrobka

> Обробка зображень, яка повністю виконується у браузері: конвертація,
> зміна розміру, видалення фону, збільшення нейромережею, пакетна робота.
> Файл не залишає пристрій — сервера для обробки немає взагалі.
> Українською в корені, англійською під /en/.

Безкоштовно, без реєстрації, без завантаження на сервер. Відкритий код: MIT.

## Що вміє

- Читає PNG, JPEG, WebP, AVIF і HEIC. Записує PNG, JPEG, WebP і AVIF.
- Приводить до точного розміру п'ятьма режимами: contain, cover, fill, inside, outside.
- Прибирає фон трьома рівнями моделей — від 4,4 МБ до 84 МБ.
- Малює обведення навколо суб'єкта, кадрує за суб'єктом, обрізає порожні краї.
- Збільшує нейромережею Swin2SR удвічі або вчетверо, тайлами.
- Читає EXIF і застосовує орієнтацію; знімає метадані без перестискання.
- Обробляє багато файлів за раз і віддає ZIP.

## Чого не вміє

- Не записує HEIC — використана бібліотека libheif уміє лише читати.
- Не знімає метадані з AVIF і HEIC без перекодування: там вони вплетені
  в структуру контейнера.
- Не працює з відео, GIF, TIFF, BMP і SVG.
- Не зберігає нічого на сервері: історії обробок не існує, бо обробка
  відбувається у вкладці.

## Для агентів

Є MCP-сервер, який робить те саме без браузера. Вісім інструментів:
convert_image, resize_image, remove_background, smart_crop, upscale_image,
read_metadata, strip_metadata, process_batch. Працює зі шляхами до файлів,
а не з base64 — зображення на 5 МБ у base64 з'їдає ~6,7 МБ контексту без
жодної користі.

\`\`\`
npx obrobka-mcp
\`\`\`

Код і документація: https://github.com/ThatHunky/obrobka

## Задачі

${group('uk', 'task')}

## Конвертація між форматами

${group('uk', 'format')}

## Розміри під платформи

${group('uk', 'preset')}

## English pages

${[...en].sort((a, b) => a.data.slug.localeCompare(b.data.slug))
    .map((e) => `- [${e.data.h1}](${SITE}${pathOf(e.data)}): ${e.data.description}`)
    .join('\n')}
`;

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
};
