import type { FitMode, OutputFormat } from '@obrobka/core';
import { biPage, type Bi, type ToolEntry } from '../page.js';

/**
 * Сторінки під розміри платформ.
 *
 * Кожен запис — це насамперед співвідношення сторін, і саме воно тут
 * стабільне: майданчики час від часу підкручують рекомендовані пікселі,
 * але квадрат лишається квадратом, а сторіс — дев'ять на шістнадцять.
 * Тому в тексті скрізь сказано, що розмір можна змінити руками, і в
 * питаннях це проговорено прямо, а не сховано.
 *
 * Режим підбирається за змістом. Обкладинка чи прев'ю мусять заповнити
 * кадр повністю — там cover, і надлишок обрізається. Стікер або логотип
 * обрізати не можна — там contain із прозорими полями.
 */

interface PresetSpec {
  readonly id: string;
  readonly slug: Bi;
  readonly width: number;
  readonly height: number;
  readonly mode: FitMode;
  readonly format: OutputFormat;
  readonly padTransparent: boolean;
  readonly name: Bi;
  /** Навіщо саме такий кадр — одне речення, різне для кожного запису. */
  readonly why: Bi;
}

const PRESETS: readonly PresetSpec[] = [
  {
    id: 'instagram-post',
    slug: { uk: 'фото-для-інстаграму', en: 'instagram-post-size' },
    width: 1080, height: 1080, mode: 'cover', format: 'jpeg', padTransparent: false,
    name: { uk: 'Квадратний допис в Instagram', en: 'Square Instagram post' },
    why: {
      uk: 'Квадрат — найстаріший і найбезпечніший кадр стрічки: він однаково лягає '
        + 'і в профіль, і в сітку, і в чужу репост-історію.',
      en: 'The square is the oldest and safest feed frame: it survives the profile grid, '
        + 'the feed and somebody else’s reshare alike.',
    },
  },
  {
    id: 'instagram-portrait',
    slug: { uk: 'вертикальне-фото-для-інстаграму', en: 'instagram-portrait-size' },
    width: 1080, height: 1350, mode: 'cover', format: 'jpeg', padTransparent: false,
    // «формат 4:5» шукають 3 600 разів на місяць — саме так, а не «вертикальний допис».
    name: { uk: 'Формат 4:5 для Instagram', en: 'Portrait Instagram post' },
    why: {
      uk: 'Співвідношення 4:5 займає у стрічці найбільше висоти з дозволених — '
        + 'тому вертикальні дописи візуально «більші» за квадратні.',
      en: 'A 4:5 frame takes the most vertical space the feed allows, which is why '
        + 'portrait posts read as bigger than square ones.',
    },
  },
  {
    id: 'story',
    slug: { uk: 'фото-для-сторіс', en: 'story-size' },
    width: 1080, height: 1920, mode: 'cover', format: 'jpeg', padTransparent: false,
    name: { uk: 'Сторіс і Reels', en: 'Stories and Reels' },
    why: {
      uk: 'Дев’ять на шістнадцять — це весь екран телефона. Пам’ятайте, що зверху '
        + 'і знизу частину кадру перекриють підписи й кнопки.',
      en: 'Nine by sixteen is the whole phone screen. Keep in mind that captions and '
        + 'buttons will cover part of the top and bottom.',
    },
  },
  {
    id: 'youtube-thumbnail',
    slug: { uk: 'обкладинка-для-ютуба', en: 'youtube-thumbnail-size' },
    width: 1280, height: 720, mode: 'cover', format: 'jpeg', padTransparent: false,
    name: { uk: 'Обкладинка відео на YouTube', en: 'YouTube video thumbnail' },
    why: {
      uk: 'Шістнадцять на дев’ять із запасом роздільності: у списку рекомендацій '
        + 'ця картинка стискається до кількох сотень пікселів, і дрібний текст на ній зникає.',
      en: 'Sixteen by nine with room to spare: in the recommendation rail this image shrinks '
        + 'to a few hundred pixels, and small text on it disappears.',
    },
  },
  {
    id: 'og-image',
    slug: { uk: 'og-image', en: 'og-image-size' },
    width: 1200, height: 630, mode: 'cover', format: 'jpeg', padTransparent: false,
    name: { uk: 'Картинка для посилання', en: 'Link preview image' },
    why: {
      uk: 'Те, що показує месенджер або соцмережа замість голого посилання. '
        + 'Співвідношення 1.91:1 розуміють і Facebook, і Telegram, і LinkedIn, і X.',
      en: 'What a messenger or social network shows instead of a bare link. The 1.91:1 frame '
        + 'is understood by Facebook, Telegram, LinkedIn and X alike.',
    },
  },
  {
    id: 'x-post',
    slug: { uk: 'картинка-для-x', en: 'x-post-image-size' },
    width: 1600, height: 900, mode: 'cover', format: 'jpeg', padTransparent: false,
    name: { uk: 'Картинка для допису в X', en: 'X post image' },
    why: {
      uk: 'Стрічка обрізає високі картинки до приблизно шістнадцяти на дев’ять — '
        + 'простіше віддати такий кадр одразу, ніж дозволити обрізати навмання.',
      en: 'The timeline crops tall images to roughly sixteen by nine — simpler to hand it '
        + 'that frame than to let it crop at random.',
    },
  },
  {
    id: 'linkedin-banner',
    slug: { uk: 'банер-для-linkedin', en: 'linkedin-banner-size' },
    width: 1584, height: 396, mode: 'cover', format: 'jpeg', padTransparent: false,
    name: { uk: 'Банер профілю LinkedIn', en: 'LinkedIn profile banner' },
    why: {
      uk: 'Дуже витягнута смуга: чотири до одного. Усе важливе тримайте по центру — '
        + 'на вузькому екрані краї підуть під обрізку.',
      en: 'A very wide strip, four to one. Keep anything that matters in the middle — '
        + 'on a narrow screen the edges get cropped away.',
    },
  },
  {
    id: 'pinterest-pin',
    slug: { uk: 'пін-для-pinterest', en: 'pinterest-pin-size' },
    width: 1000, height: 1500, mode: 'cover', format: 'jpeg', padTransparent: false,
    name: { uk: 'Пін для Pinterest', en: 'Pinterest pin' },
    why: {
      uk: 'Два до трьох — той кадр, який стрічка Pinterest показує повністю, '
        + 'не обрізаючи ані згори, ані знизу.',
      en: 'Two to three is the frame the Pinterest feed shows in full, cropping neither '
        + 'top nor bottom.',
    },
  },
  {
    id: 'avatar',
    slug: { uk: 'аватар', en: 'avatar-size' },
    width: 400, height: 400, mode: 'cover', format: 'png', padTransparent: false,
    name: { uk: 'Аватарка', en: 'Avatar' },
    why: {
      uk: 'Квадрат, який майже скрізь показується колом. Тому обличчя чи логотип '
        + 'мають бути в центрі: кути однаково зріжуться.',
      en: 'A square that is shown as a circle almost everywhere. Put the face or logo in the '
        + 'centre — the corners get cut off regardless.',
    },
  },
  {
    id: 'discord-emoji',
    slug: { uk: 'емодзі-для-discord', en: 'discord-emoji-size' },
    width: 128, height: 128, mode: 'contain', format: 'png', padTransparent: true,
    name: { uk: 'Емодзі для Discord', en: 'Discord emoji' },
    why: {
      uk: 'Крихітний квадрат із прозорим тлом. Обрізати тут не можна — тому режим '
        + '«вписати», а вільне місце лишається прозорим.',
      en: 'A tiny square on a transparent background. Nothing may be cropped here, hence '
        + '“contain” — the leftover space stays transparent.',
    },
  },
  {
    id: 'viber-sticker',
    slug: { uk: 'стікер-для-viber', en: 'viber-sticker-size' },
    width: 490, height: 490, mode: 'contain', format: 'png', padTransparent: true,
    name: { uk: 'Стікер для Viber', en: 'Viber sticker' },
    why: {
      uk: 'Квадрат із прозорим тлом. Найзручніше поєднати з видаленням фону: '
        + 'вмикайте «Прибрати фон» — і стікер вийде за один прохід.',
      en: 'A square on a transparent background. Easiest paired with background removal: '
        + 'turn on “Remove background” and the sticker comes out in one pass.',
    },
  },
  {
    id: 'wallpaper-fhd',
    slug: { uk: 'шпалери-full-hd', en: 'full-hd-wallpaper' },
    width: 1920, height: 1080, mode: 'cover', format: 'jpeg', padTransparent: false,
    name: { uk: 'Шпалери Full HD', en: 'Full HD wallpaper' },
    why: {
      uk: 'Звичайний екран ноутбука чи монітора. Режим «заповнити» гарантує, '
        + 'що полів не буде — надлишок обріжеться по коротшій стороні.',
      en: 'An ordinary laptop or monitor screen. “Cover” guarantees no letterboxing — the '
        + 'overflow is cropped along the shorter side.',
    },
  },
  {
    id: 'wallpaper-4k',
    slug: { uk: 'шпалери-4k', en: '4k-wallpaper' },
    width: 3840, height: 2160, mode: 'cover', format: 'jpeg', padTransparent: false,
    name: { uk: 'Шпалери 4K', en: '4K wallpaper' },
    why: {
      uk: 'Учетверо більше пікселів за Full HD. Якщо оригінал менший, увімкніть '
        + 'збільшення нейромережею — просте розтягування тут виглядатиме мильним.',
      en: 'Four times the pixels of Full HD. If the original is smaller, turn on neural '
        + 'upscaling — a plain stretch will look soft here.',
    },
  },
  {
    id: 'favicon-source',
    slug: { uk: 'вихідник-для-favicon', en: 'favicon-source-size' },
    width: 512, height: 512, mode: 'contain', format: 'png', padTransparent: true,
    name: { uk: 'Вихідник для favicon', en: 'Favicon source' },
    why: {
      uk: 'З цього квадрата потім ріжуться всі дрібні розміри. Прозоре тло '
        + 'обов’язкове: інакше іконка отримає білу пляму на темній темі.',
      en: 'Every smaller icon is cut from this square later. A transparent background is '
        + 'essential — otherwise the icon gets a white patch in dark mode.',
    },
  },
];

function faq(p: PresetSpec, locale: 'uk' | 'en') {
  const uk = locale === 'uk';
  const rows = [
    uk
      ? {
          q: 'А якщо потрібен інший розмір?',
          a: `Поля ширини й висоти можна змінити просто у віджеті — ${p.width}×${p.height} `
            + 'це лише готове значення. Майданчики час від часу підкручують свої рекомендації, '
            + 'і співвідношення сторін тут надійніше за конкретні пікселі.',
        }
      : {
          q: 'What if I need a different size?',
          a: `The width and height fields are editable right in the widget — ${p.width}×${p.height} `
            + 'is just a starting value. Platforms adjust their recommendations from time to time, '
            + 'and the aspect ratio is the more durable part.',
        },
    p.mode === 'cover'
      ? (uk
          ? {
              q: 'Чому частина зображення обрізається?',
              a: 'Бо стоїть режим «заповнити»: кадр має бути заповнений повністю, і надлишок '
                + 'по довшій стороні йде під ніж. Якщо різати не можна, перемкніть на «вписати» — '
                + 'вільне місце стане полями. Куди тягнути вміст, задає прив’язка.',
            }
          : {
              q: 'Why is part of the image cropped?',
              a: 'Because the mode is “cover”: the frame must be filled completely, so the overflow '
                + 'along the longer side is cut. If nothing may be cropped, switch to “contain” — the '
                + 'leftover space becomes padding. The anchor decides which way the content is pulled.',
            })
      : (uk
          ? {
              q: 'Чому навколо зображення порожньо?',
              a: 'Бо стоїть режим «вписати»: нічого не обрізається, а вільне місце лишається '
                + 'прозорим. Якщо порожнечі бути не має, перемкніть на «заповнити».',
            }
          : {
              q: 'Why is there empty space around the image?',
              a: 'Because the mode is “contain”: nothing gets cropped and the leftover space stays '
                + 'transparent. If you want no empty space, switch to “cover”.',
            }),
    uk
      ? {
          q: 'Кадр можна побудувати навколо суб’єкта?',
          a: 'Так. У розділі обрізки є «За суб’єктом»: модель знаходить головне на знімку, '
            + 'і кадр будується навколо нього, а не навколо геометричного центру.',
        }
      : {
          q: 'Can the frame be built around the subject?',
          a: 'Yes. Under cropping there is “On the subject”: the model finds what matters in the '
            + 'shot and the frame is built around that rather than around the geometric centre.',
        },
    uk
      ? {
          q: 'Куди йде мій файл?',
          a: 'Нікуди. Обробка виконується у вкладці, зображення не залишає ваш пристрій. '
            + 'Метадані — координати, камера, дата — у результат теж не переносяться.',
        }
      : {
          q: 'Where does my file go?',
          a: 'Nowhere. The work happens in your tab and the image never leaves your device. '
            + 'Metadata — coordinates, camera, date — is not carried over either.',
        },
  ];
  return rows;
}

export function presetPages(): ToolEntry[] {
  return PRESETS.flatMap((p) => biPage(p.id, (locale) => {
    const uk = locale === 'uk';
    const name = p.name[locale];
    const size = `${p.width}×${p.height}`;
    return {
      group: 'preset' as const,
      slug: p.slug[locale],
      title: uk
        ? `${name} — ${size} онлайн і безкоштовно, без завантаження на сервер`
        : `${name} — ${size} online and free, nothing uploaded`,
      description: uk
        ? `${name} — ${size}: приведіть будь-яке зображення до цього розміру просто у браузері. `
          + `Файл не залишає ваш пристрій.`
        : `Bring any image to ${size} for a ${name.toLowerCase()}, right in the browser. `
          + `The file never leaves your device.`,
      h1: uk ? `${name} — ${size}` : `${name} — ${size}`,
      intro: `${p.why[locale]} ${uk
        ? 'Обробка виконується у вашій вкладці, без завантаження на сервер.'
        : 'The work happens inside your tab, with nothing uploaded.'}`,
      preset: {
        width: p.width, height: p.height, mode: p.mode,
        format: p.format, padTransparent: p.padTransparent,
      },
      steps: uk
        ? [
            'Оберіть зображення, перетягніть його або вставте через Ctrl+V',
            `Розмір уже стоїть ${size} — за потреби змініть співвідношення чи прив’язку`,
            'Заберіть готовий файл. Кількох файлів разом теж можна — на виході буде ZIP',
          ]
        : [
            'Pick an image, drag it in, or paste with Ctrl+V',
            `The size is already ${size} — change the ratio or the anchor if you need to`,
            'Take the finished file. Several at once works too — you get a ZIP',
          ],
      faq: faq(p, locale),
    };
  }));
}
