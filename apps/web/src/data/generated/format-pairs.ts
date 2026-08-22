import {
  FORMATS, GRAPHIC_EDGE_ERROR, SOURCES, TARGETS, losesAlpha, relativeToJpeg,
  type SourceFormat, type TargetFormat,
} from '../formats.js';
import { KEEP_SIZE, biPage, decimal, type ToolEntry } from '../page.js';

/**
 * Сторінки «формат → формат».
 *
 * Породжені, але не однакові. Кожна пара має власну відповідь на власне
 * питання: PNG → JPEG втрачає прозорість, JPEG → PNG роздуває файл у
 * тринадцять разів і нічого не повертає, HEIC → будь-що потрібне тим,
 * кому айфон віддав файл, який не відкривається.
 *
 * Числа скрізь виміряні — див. scripts/measure-formats.mjs. Це і є
 * причина, чому ці сторінки мають право існувати: розмір і локальна
 * похибка на власному корпусі, а не переказ чужої таблиці.
 */

/** Слаги, які вже написані руками. Породжувати їх удруге не можна. */
const HAND_WRITTEN: ReadonlySet<string> = new Set(['heic-to-jpeg']);

const UK_CASE: Readonly<Record<SourceFormat, string>> = {
  png: 'PNG', jpeg: 'JPEG', webp: 'WebP', avif: 'AVIF', heic: 'HEIC',
};

function sizeLine(to: TargetFormat, locale: 'uk' | 'en'): string {
  const photo = FORMATS[to].photoKb;
  const graphic = FORMATS[to].graphicKb;
  const relPhoto = relativeToJpeg(to, 'photo');
  return locale === 'uk'
    ? `На нашому корпусі кадр 1200×800 у ${FORMATS[to].label} важить у середньому `
      + `${photo} КБ для фотографії та ${graphic} КБ для плаского графічного сюжету — `
      + `це ${relPhoto} % від JPEG тієї ж якості.`
    : `On our corpus a 1200×800 frame in ${FORMATS[to].label} averages `
      + `${photo} kB for a photograph and ${graphic} kB for flat graphics — `
      + `${relPhoto}% of what JPEG takes at the same quality.`;
}

function alphaFaq(from: SourceFormat, to: TargetFormat, locale: 'uk' | 'en') {
  return locale === 'uk'
    ? {
        q: 'Що станеться з прозорістю?',
        a: `JPEG не має альфа-каналу — прозорі місця стануть суцільним кольором. `
          + `Якщо прозорість потрібна, беріть PNG, WebP або AVIF: усі троє її тримають. `
          + `Колір заливки можна задати у віджеті.`,
      }
    : {
        q: 'What happens to transparency?',
        a: `JPEG has no alpha channel — transparent areas become a solid colour. `
          + `If you need transparency, pick PNG, WebP or AVIF; all three carry it. `
          + `The fill colour is yours to choose in the widget.`,
      };
}

function losslessFaq(from: SourceFormat, to: TargetFormat, locale: 'uk' | 'en') {
  const fromLossy = FORMATS[from].lossy;
  if (to === 'png') {
    return locale === 'uk'
      ? {
          q: 'Чи покращиться якість у PNG?',
          a: fromLossy
            ? `Ні. PNG зберігає без втрат те, що вже втрачено: артефакти ${UK_CASE[from]} `
              + `запишуться піксель у піксель. Файл при цьому виросте — на фотографіях `
              + `PNG виходить приблизно в тринадцять разів більшим за JPEG. `
              + `PNG варто брати, коли потрібна прозорість або подальше редагування.`
            : `Якість не зміниться: обидва формати зберігають без втрат.`,
        }
      : {
          q: 'Will PNG improve the quality?',
          a: fromLossy
            ? `No. PNG losslessly preserves what has already been lost — the ${FORMATS[from].label} `
              + `artefacts get written pixel for pixel. The file grows too: on photographs PNG `
              + `comes out roughly thirteen times larger than JPEG. Reach for PNG when you need `
              + `transparency or further editing.`
            : `Quality does not change — both formats are lossless.`,
        };
  }
  const e = GRAPHIC_EDGE_ERROR[to];
  return locale === 'uk'
    ? {
        q: 'Наскільки помітні втрати?',
        a: `На плоскій графіці при якості 80 ${FORMATS[to].label} дає максимальне відхилення `
          + `каналу ${e.maxDeviation} і ${decimal(e.visiblePercent, 2, 'uk')} % пікселів, `
          + `що помітно відхилились. `
          + `Для фотографії це нечутно, для схеми чи скріншота з різкими краями — вже видно, `
          + `і там надійніший PNG.`
      }
    : {
        q: 'How visible is the loss?',
        a: `On flat graphics at quality 80, ${FORMATS[to].label} reaches a peak channel deviation `
          + `of ${e.maxDeviation} with ${e.visiblePercent}% of pixels visibly off. On a photograph `
          + `that is imperceptible; on a diagram or screenshot with hard edges it shows, and PNG `
          + `is the safer choice there.`,
      };
}

function supportFaq(to: TargetFormat, locale: 'uk' | 'en') {
  const modern = to === 'avif' || to === 'webp';
  return locale === 'uk'
    ? {
        q: `Чи всюди відкриється ${FORMATS[to].label}?`,
        a: modern
          ? `${FORMATS[to].label} читають усі сучасні браузери. Спотикаються старі програми `
            + `для перегляду й частина месенджерів — якщо файл іде людині, а не в веб, `
            + `надійніший JPEG або PNG.`
          : `Так. ${FORMATS[to].label} відкриє будь-що — від браузера до принтера.`,
      }
    : {
        q: `Will ${FORMATS[to].label} open everywhere?`,
        a: modern
          ? `Every current browser reads ${FORMATS[to].label}. Older desktop viewers and some `
            + `messengers still trip over it — if the file is going to a person rather than to `
            + `the web, JPEG or PNG is safer.`
          : `Yes. ${FORMATS[to].label} opens anywhere, from a browser to a printer.`,
      };
}

function heicFaq(locale: 'uk' | 'en') {
  return locale === 'uk'
    ? {
        q: 'Чому HEIC узагалі треба конвертувати?',
        a: 'Айфон знімає у HEIC, бо той стискає вдвічі краще за JPEG. Але половина програм '
          + 'його не відкриває. Тут він розкодовується прямо у вкладці бібліотекою libheif — '
          + 'файл нікуди не надсилається. Записувати HEIC ми не вміємо: libheif уміє лише читати.',
      }
    : {
        q: 'Why does HEIC need converting at all?',
        a: 'The iPhone shoots HEIC because it compresses about twice as well as JPEG. Half the '
          + 'software out there will not open it. Here it is decoded inside your tab by libheif — '
          + 'the file is never sent anywhere. We cannot write HEIC: libheif only reads.',
      };
}

function orientationFaq(locale: 'uk' | 'en') {
  return locale === 'uk'
    ? {
        q: 'Чому фото з телефона іноді виходить набік?',
        a: 'Бо орієнтація записана окремим теґом EXIF, а не в самих пікселях, і більшість '
          + 'конвертерів його ігнорує. Тут теґ читається й застосовується до всього іншого, '
          + 'тож вертикальний знімок лишається вертикальним.',
      }
    : {
        q: 'Why do phone photos sometimes come out sideways?',
        a: 'Because the orientation lives in a separate EXIF tag rather than in the pixels, and '
          + 'most converters ignore it. Here the tag is read and applied before anything else, '
          + 'so a portrait shot stays portrait.',
      };
}

function metadataFaq(locale: 'uk' | 'en') {
  return locale === 'uk'
    ? {
        q: 'Чи лишаться в результаті координати й дані камери?',
        a: 'Ні. Зображення перемальовується з пікселів, а метадані лишаються у вхідному файлі. '
          + 'Що саме там було, видно в панелі під результатом.',
      }
    : {
        q: 'Will the coordinates and camera data survive?',
        a: 'No. The image is redrawn from pixels and the metadata stays behind in the input file. '
          + 'The panel under the result shows exactly what was in there.',
      };
}

function intro(from: SourceFormat, to: TargetFormat, locale: 'uk' | 'en'): string {
  if (from === 'heic') {
    return locale === 'uk'
      ? `Файл із айфона відкривається просто у вкладці й зберігається як ${FORMATS[to].label}. `
        + `Нічого не завантажується на сервер, а вертикальні знімки не лягають набік. `
        + sizeLine(to, locale)
      : `An iPhone file opens right in the tab and saves as ${FORMATS[to].label}. Nothing is `
        + `uploaded anywhere, and portrait shots do not come out sideways. ` + sizeLine(to, locale);
  }
  if (losesAlpha(from, to)) {
    // Троє джерел ведуть у JPEG, і спільний текст на всіх трьох був би
    // тим самим дублікатом. Різницю дає те, чим саме кожне з них є:
    // PNG прозорий без втрат, WebP і AVIF — уже стиснуті з втратами.
    const source = locale === 'uk'
      ? {
          png: 'PNG тримає прозорість без втрат, і саме її JPEG прийняти не може',
          webp: 'WebP уміє і прозорість, і стиснення з втратами — у JPEG переїде лише друге',
          avif: 'AVIF несе прозорість разом із найщільнішим стисненням; у JPEG лишиться саме стиснення',
        }[from as 'png' | 'webp' | 'avif']
      : {
          png: 'PNG carries transparency losslessly, and that is exactly what JPEG cannot accept',
          webp: 'WebP does both transparency and lossy compression — only the second survives the move',
          avif: 'AVIF carries transparency alongside the densest compression; only the compression survives',
        }[from as 'png' | 'webp' | 'avif'];

    return locale === 'uk'
      ? `${source}: місця без пікселів стануть суцільним кольором, який ви оберете. `
        + `Натомість файл стане помітно легшим. ${sizeLine(to, locale)}`
      : `${source}: empty areas become a solid colour of your choosing. In exchange the file `
        + `gets markedly lighter. ${sizeLine(to, locale)}`;
  }
  if (to === 'png' && FORMATS[from].lossy) {
    return locale === 'uk'
      ? `PNG зберігає без втрат — але зберігає те, що вже втрачено: артефакти ${UK_CASE[from]} `
        + `перейдуть у результат, а файл виросте. Це має сенс, коли далі буде редагування `
        + `або потрібна прозорість. ${sizeLine(to, locale)}`
      : `PNG is lossless — but it preserves what has already been lost: the ${FORMATS[from].label} `
        + `artefacts carry over and the file grows. It makes sense when editing comes next or `
        + `transparency is needed. ${sizeLine(to, locale)}`;
  }
  // Спільний вступ на всі пари означав би той самий текст під різними
  // адресами — рівно те, за що пошуковики й не люблять породжені сторінки.
  // Тому тут порівняння саме цієї пари: воно різне для кожної.
  const fromKb = FORMATS[from].photoKb;
  const toKb = FORMATS[to].photoKb;
  const ratio = fromKb > toKb ? fromKb / toKb : toKb / fromKb;
  const digits = ratio >= 10 ? 0 : 1;
  const times = fromKb > toKb
    ? `у ${decimal(ratio, digits, 'uk')} раза легшим`
    : `у ${decimal(ratio, digits, 'uk')} раза важчим`;
  const timesEn = `${decimal(ratio, digits, 'en')}× ${fromKb > toKb ? 'lighter' : 'heavier'}`;

  return locale === 'uk'
    ? `На тому самому знімку ${FORMATS[to].label} виходить ${times} за ${UK_CASE[from]}: `
      + `${toKb} КБ проти ${fromKb} КБ на кадрі 1200×800. Обробка виконується у вашій вкладці — `
      + `зображення не надсилається на жоден сервер.`
    : `On the same shot ${FORMATS[to].label} comes out ${timesEn} than ${FORMATS[from].label}: `
      + `${toKb} kB against ${fromKb} kB on a 1200×800 frame. The work happens inside your tab — `
      + `the image is never sent to a server.`;
}

function steps(from: SourceFormat, to: TargetFormat, locale: 'uk' | 'en'): string[] {
  const pick = locale === 'uk'
    ? `Оберіть файл ${UK_CASE[from]}, перетягніть його або вставте через Ctrl+V`
    : `Pick a ${FORMATS[from].label} file, drag it in, or paste with Ctrl+V`;
  const set = locale === 'uk'
    ? `Формат уже стоїть на ${FORMATS[to].label}${to === 'png' ? '' : ' — за потреби змініть якість'}`
    : `The format is already set to ${FORMATS[to].label}${to === 'png' ? '' : ' — adjust the quality if you like'}`;
  const take = locale === 'uk'
    ? 'Заберіть готовий файл. Кількох файлів разом теж можна — на виході буде ZIP'
    : 'Take the finished file. Several at once works too — you get a ZIP';
  return [pick, set, take];
}

export function formatPairPages(): ToolEntry[] {
  const out: ToolEntry[] = [];
  for (const from of SOURCES) {
    for (const to of TARGETS) {
      if ((from as string) === (to as string)) continue;
      const id = `${from}-to-${to}`;
      if (HAND_WRITTEN.has(id)) continue;

      out.push(...biPage(id, (locale) => {
        const faq = [
          locale === 'uk'
            ? { q: 'Наскільки менший вийде файл?', a: sizeLine(to, locale) }
            : { q: 'How much smaller will the file be?', a: sizeLine(to, locale) },
          losslessFaq(from, to, locale),
        ];
        if (losesAlpha(from, to)) faq.push(alphaFaq(from, to, locale));
        if (from === 'heic') faq.push(heicFaq(locale));
        else faq.push(supportFaq(to, locale));
        faq.push(from === 'jpeg' || from === 'heic'
          ? orientationFaq(locale)
          : metadataFaq(locale));

        return {
          group: 'format' as const,
          slug: locale === 'uk' ? `${from}-в-${to}` : `${from}-to-${to}`,
          title: locale === 'uk'
            ? `Конвертувати ${UK_CASE[from]} у ${FORMATS[to].label} онлайн — у браузері, без завантаження`
            : `Convert ${FORMATS[from].label} to ${FORMATS[to].label} online — in the browser, nothing uploaded`,
          // Опис — це те, що покаже пошук. Спільний шаблон на всі пари
          // дав би п'ятнадцять однакових рядків у видачі, тож тут
          // виміряне число саме цього переходу.
          description: locale === 'uk'
            ? `${UK_CASE[from]} → ${FORMATS[to].label}: ${FORMATS[to].photoKb} КБ проти `
              + `${FORMATS[from].photoKb || '—'} КБ на кадрі 1200×800. Просто у вкладці, `
              + `файл не залишає ваш пристрій.`
            : `${FORMATS[from].label} → ${FORMATS[to].label}: ${FORMATS[to].photoKb} kB against `
              + `${FORMATS[from].photoKb || '—'} kB on a 1200×800 frame. Right in your tab, `
              + `the file never leaves your device.`,
          h1: locale === 'uk'
            ? `${UK_CASE[from]} у ${FORMATS[to].label}`
            : `${FORMATS[from].label} to ${FORMATS[to].label}`,
          intro: intro(from, to, locale),
          preset: { ...KEEP_SIZE, format: to, padTransparent: to !== 'jpeg' },
          steps: steps(from, to, locale),
          faq,
        };
      }));
    }
  }
  return out;
}
