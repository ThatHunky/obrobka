import { KEEP_SIZE, biPage, type ToolEntry } from '../page.js';

/**
 * Сторінки-задачі.
 *
 * На відміну від матриці форматів, тут кожен запис написаний окремо:
 * задач небагато, а спільного між «стиснути» і «прибрати порожні краї»
 * рівно стільки, скільки між будь-якими двома різними справами.
 * Породжується лише пара локалей.
 */

export function taskPages(): ToolEntry[] {
  return [
    ...biPage('compress-image', (locale) => locale === 'uk' ? {
      slug: 'стиснути-зображення',
      title: 'Стиснути фото онлайн — зменшити розмір і вагу зображення без сервера',
      description: 'Як зменшити розмір фото просто у браузері. Виміряно: WebP забирає 75 % '
        + 'від JPEG тієї ж якості, AVIF — 40 %. Файл не залишає пристрій.',
      h1: 'Стиснути фото',
      intro: 'Найбільше ваги віддає не повзунок якості, а сам формат. На нашому корпусі '
        + 'кадр 1200×800 важить 113 КБ у JPEG, 85 КБ у WebP і 45 КБ у AVIF — при однаковій '
        + 'заданій якості 80. Тобто зміна формату дає більше, ніж будь-яке підкручування.',
      preset: { ...KEEP_SIZE, format: 'webp', padTransparent: true },
      steps: [
        'Оберіть зображення, перетягніть його або вставте через Ctrl+V',
        'Формат уже стоїть на WebP — спробуйте ще AVIF, він удвічі легший',
        'Порівняйте «Було» і «Стало»: під результатом видно виграш у відсотках',
      ],
      faq: [
        { q: 'Який формат обрати?',
          a: 'Для вебу — AVIF: 40 % від ваги JPEG. Якщо файл іде людині або в стару програму, '
            + 'беріть WebP чи JPEG: AVIF читають усі сучасні браузери, але не все інше.' },
        { q: 'Наскільки опускати якість?',
          a: 'Нижче 60 артефакти стають помітними на плавних переходах — небо, шкіра, тіні. '
            + 'Замість цього спершу спробуйте змінити формат: перехід з JPEG на AVIF дає '
            + 'більше, ніж падіння якості з 80 до 50, і без видимих втрат.' },
        { q: 'А якщо потрібно без втрат?',
          a: 'Тоді PNG — але на фотографіях він виходить приблизно втринадцятеро більшим '
            + 'за JPEG. Без втрат має сенс для схем, скріншотів і логотипів, не для знімків.' },
        { q: 'Розмір у пікселях змінюється?',
          a: 'Ні. Стоїть режим «без полів» із межею, більшою за будь-яке фото, і збільшення '
            + 'вимкнено — зображення проходить у своїй роздільності. Зменшити сторони теж '
            + 'можна, і саме це зазвичай дає найбільший виграш.' },
        { q: 'Як стиснути фото до 1 МБ?',
          a: 'Окремого поля «цільова вага» тут немає, тож ідіть двома кроками. Спершу формат: '
            + 'AVIF важить 40 % від JPEG, тож знімок, що в JPEG займає 2 МБ, в AVIF зазвичай '
            + 'менший за мегабайт. Якщо й так забагато — зменште довшу сторону до 2000 пікселів: '
            + 'вага спадає приблизно з квадратом сторони. Під результатом видно, скільки файл '
            + 'важить тепер.' },
      ],
    } : {
      slug: 'compress-image',
      title: 'Compress an image online — nothing uploaded to a server',
      description: 'Cut a photo’s weight in the browser. Measured: WebP takes 75% of what '
        + 'JPEG takes at the same quality, AVIF takes 40%.',
      h1: 'Compress an image',
      intro: 'Most of the weight is decided by the format, not by the quality slider. On our '
        + 'corpus a 1200×800 frame weighs 113 kB as JPEG, 85 kB as WebP and 45 kB as AVIF — at '
        + 'the same requested quality of 80. Changing the format buys more than any amount of '
        + 'slider tuning.',
      preset: { ...KEEP_SIZE, format: 'webp', padTransparent: true },
      steps: [
        'Pick an image, drag it in, or paste with Ctrl+V',
        'The format is already WebP — try AVIF too, it is about half again lighter',
        'Compare “Before” and “After”: the gain in percent is shown under the result',
      ],
      faq: [
        { q: 'Which format should I pick?',
          a: 'For the web, AVIF: 40% of JPEG’s weight. If the file is going to a person or into '
            + 'older software, pick WebP or JPEG — every current browser reads AVIF, but not '
            + 'everything else does.' },
        { q: 'How far can I drop the quality?',
          a: 'Below 60 the artefacts start showing on smooth gradients — sky, skin, shadows. Try '
            + 'changing the format first: JPEG to AVIF buys more than dropping quality from 80 to '
            + '50, and without anything visible.' },
        { q: 'What if I need lossless?',
          a: 'Then PNG — but on photographs it comes out roughly thirteen times larger than JPEG. '
            + 'Lossless makes sense for diagrams, screenshots and logos, not for photos.' },
        { q: 'Does the pixel size change?',
          a: 'No. The mode is “inside” with a bound larger than any photo and upscaling off, so '
            + 'the image passes through at its own resolution. Shrinking the sides is possible '
            + 'too, and that is usually where the biggest win is.' },
      ],
    }),

    ...biPage('upscale-image', (locale) => locale === 'uk' ? {
      slug: 'збільшити-зображення',
      title: 'Покращити якість фото онлайн — збільшити вдвічі або вчетверо нейромережею',
      description: 'Мале фото стає більшим і чіткішим: Swin2SR домальовує деталі замість '
        + 'простого розтягування. Працює у браузері, знімок не завантажується на сервер.',
      h1: 'Покращити якість фото',
      intro: 'Просте розтягування лише розмазує наявні пікселі. Нейромережа домальовує деталі, '
        + 'яких у файлі немає — виміряно, це дає від 1,5 до 2,9 дБ проти білінійного збільшення '
        + 'удвічі. Учетверо результат нерівний: на гладких поверхнях +2,7 дБ, на листі й квітах '
        + 'майже нічого.',
      preset: { ...KEEP_SIZE, format: 'png', padTransparent: true },
      steps: [
        'Оберіть зображення, перетягніть його або вставте через Ctrl+V',
        'У розділі «Збільшення» оберіть удвічі або вчетверо — модель завантажиться один раз',
        'Дочекайтесь тайлів: під прев’ю видно, скільки їх лишилось і скільки це триватиме',
      ],
      faq: [
        { q: 'Скільки це триває?',
          a: 'Близько 2,6 с на тайл на звичайному процесорі. Для великого знімка це хвилини. '
            + 'Якщо браузер має WebGPU, виходить приблизно вдесятеро швидше — під час роботи '
            + 'видно, на чому саме рахує.' },
        { q: 'Чому тайлами?',
          a: 'Щоб пам’ять не залежала від розміру зображення. Виміряно: тайл 256×256 для ×2 дає '
            + 'пік 561 МБ, удвічі більший тайл — уже близько 1,8 ГБ, а це за практичною стелею '
            + 'вкладки. Стики зшиваються лінійним переходом, інакше на них лишалися б шви.' },
        { q: 'Чи можна повернути втрачені деталі?',
          a: 'Ні. Мережа домальовує правдоподібне, а не справжнє. Для тексту й облич це варто '
            + 'перевіряти очима: результат буває переконливим і при цьому неправильним.' },
        { q: 'Скільки важить модель?',
          a: '×2 — 7,7 МБ, ×4 — 18,1 МБ. Завантажується один раз і далі береться з кеша браузера.' },
      ],
    } : {
      slug: 'upscale-image',
      title: 'Upscale an image with a neural network — 2× or 4×, in the browser',
      description: 'Swin2SR invents detail instead of plainly stretching. Works in tiles, so '
        + 'memory does not depend on how big the shot is.',
      h1: 'Upscale an image',
      intro: 'A plain stretch only smears the pixels you already have. The network invents detail '
        + 'that is not in the file — measured, that is worth 1.5 to 2.9 dB over bilinear at 2×. '
        + 'At 4× the result is uneven: +2.7 dB on smooth surfaces, almost nothing on foliage.',
      preset: { ...KEEP_SIZE, format: 'png', padTransparent: true },
      steps: [
        'Pick an image, drag it in, or paste with Ctrl+V',
        'Under “Upscaling” choose 2× or 4× — the model downloads once',
        'Wait for the tiles: the preview shows how many are left and how long it should take',
      ],
      faq: [
        { q: 'How long does it take?',
          a: 'About 2.6 s per tile on an ordinary CPU. For a large shot that is minutes. If the '
            + 'browser has WebGPU it is roughly ten times faster — the interface says which one '
            + 'is doing the work.' },
        { q: 'Why tiles?',
          a: 'So that memory does not depend on image size. Measured: a 256×256 tile at 2× peaks '
            + 'at 561 MB; double the tile and it reaches about 1.8 GB, past what a tab can hold. '
            + 'The seams are blended linearly — without that they would stay visible.' },
        { q: 'Can it recover lost detail?',
          a: 'No. The network invents something plausible, not something true. For text and faces '
            + 'check with your eyes: the result can be convincing and wrong at the same time.' },
        { q: 'How large is the model?',
          a: '7.7 MB for 2×, 18.1 MB for 4×. It downloads once and is then served from your '
            + 'browser cache.' },
      ],
    }),

    ...biPage('trim-edges', (locale) => locale === 'uk' ? {
      slug: 'обрізати-порожні-краї',
      title: 'Обрізати порожні краї зображення онлайн — автоматично, у браузері',
      description: 'Прибирає прозорі або порожні поля навколо суб’єкта, лишаючи щільний кадр. '
        + 'Без нав’язаного співвідношення сторін.',
      h1: 'Обрізати порожні краї',
      intro: 'Типовий випадок — PNG зі знятим фоном, у якого навколо об’єкта лишилось півкадру '
        + 'порожнечі. Модель знаходить прямокутник суб’єкта, і кадр обрізається рівно по ньому. '
        + 'Ніякого співвідношення сторін не нав’язується: вихід має ту форму, яку має суб’єкт.',
      preset: { ...KEEP_SIZE, format: 'png', padTransparent: true },
      steps: [
        'Оберіть зображення, перетягніть його або вставте через Ctrl+V',
        'У розділі обрізки виберіть «Прибрати порожні краї»',
        'За потреби додайте запас навколо суб’єкта повзунком',
      ],
      faq: [
        { q: 'Чим це відрізняється від кадрування за суб’єктом?',
          a: 'Кадрування за суб’єктом підганяє результат під задане співвідношення сторін — '
            + 'квадрат, 16:9 і так далі. Обрізка країв нічого не нав’язує: вона просто прибирає '
            + 'зайве навколо.' },
        { q: 'Працює лише на прозорих зображеннях?',
          a: 'Ні. Суб’єкт знаходить та сама модель, що й для видалення фону, тож звичайна '
            + 'фотографія теж підійде — фон при цьому лишиться на місці, обріжуться лише краї.' },
        { q: 'Чи можна лишити трохи повітря?',
          a: 'Так, повзунок «Запас» додає поле навколо суб’єкта — від нуля до половини його '
            + 'більшої сторони.' },
      ],
    } : {
      slug: 'trim-edges',
      title: 'Trim empty edges from an image online — automatically, in the browser',
      description: 'Removes transparent or empty margins around the subject, leaving a tight '
        + 'frame. No aspect ratio imposed.',
      h1: 'Trim empty edges',
      intro: 'The usual case is a background-removed PNG with half a frame of emptiness around '
        + 'the object. The model finds the subject’s rectangle and the frame is cut to it. No '
        + 'aspect ratio is imposed: the output has whatever shape the subject has.',
      preset: { ...KEEP_SIZE, format: 'png', padTransparent: true },
      steps: [
        'Pick an image, drag it in, or paste with Ctrl+V',
        'Under cropping, choose “Trim empty edges”',
        'Add some margin around the subject with the slider if you want it',
      ],
      faq: [
        { q: 'How is this different from subject-aware cropping?',
          a: 'Subject-aware cropping fits the result to an aspect ratio you choose — square, 16:9 '
            + 'and so on. Trimming imposes nothing: it just removes what is around.' },
        { q: 'Does it only work on transparent images?',
          a: 'No. The subject is found by the same model used for background removal, so an '
            + 'ordinary photograph works too — the background stays, only the edges go.' },
        { q: 'Can I leave some breathing room?',
          a: 'Yes, the “Margin” slider adds space around the subject, from nothing up to half '
            + 'of its longer side.' },
      ],
    }),

    ...biPage('add-outline', (locale) => locale === 'uk' ? {
      slug: 'додати-обведення',
      title: 'Додати обведення навколо об’єкта онлайн — як у стікера',
      description: 'Кольоровий контур навколо суб’єкта. Полотно розширюється, щоб обведення '
        + 'не обрізалось по краю.',
      h1: 'Обведення навколо об’єкта',
      intro: 'Той самий білий контур, що робить стікер стікером. Модель знаходить суб’єкт, '
        + 'а контур малюється по краю маски — товщину й колір задаєте ви. Якщо обведення не '
        + 'влазить у кадр, полотно розширюється саме, замість того щоб зрізати контур.',
      preset: { width: 512, height: 512, mode: 'contain', format: 'png', padTransparent: true,
        removeBg: true, tier: 'fast', outlineOn: true, outlineWidth: 12 },
      steps: [
        'Оберіть зображення, перетягніть його або вставте через Ctrl+V',
        'Фон і обведення вже увімкнені — підкрутіть товщину й колір',
        'Якщо по контуру видно кольоровий ореол, збільшіть «Стиснути край»',
      ],
      faq: [
        { q: 'Звідки береться кольоровий ореол по контуру?',
          a: 'Це пікселі, колір яких уже змішаний із фоном — вони були напівпрозорими ще на '
            + 'знімку. Повзунок «Стиснути край» підтягує межу всередину на кілька пікселів '
            + 'і прибирає їх. Один піксель зазвичай вирішує справу і майже не помітний.' },
        { q: 'Чому полотно стало більшим за задане?',
          a: 'Бо обведення не влізло. Контур навколо суб’єкта, який торкається краю, довелося б '
            + 'зрізати — замість цього розширюється полотно.' },
        { q: 'Можна обвести без видалення фону?',
          a: 'Ні: контур малюється по краю маски, а маска — це і є результат відділення суб’єкта '
            + 'від фону. Але сам фон можна лишити видимим, якщо обрати інший режим кадрування.' },
      ],
    } : {
      slug: 'add-outline',
      title: 'Add an outline around an object online — the sticker look',
      description: 'A coloured contour around the subject. The canvas grows so the outline is '
        + 'never clipped at the edge.',
      h1: 'Outline around an object',
      intro: 'The same white contour that makes a sticker a sticker. The model finds the subject '
        + 'and the contour is drawn along the mask edge — width and colour are yours. If the '
        + 'outline does not fit the frame, the canvas grows rather than clipping it.',
      preset: { width: 512, height: 512, mode: 'contain', format: 'png', padTransparent: true,
        removeBg: true, tier: 'fast', outlineOn: true, outlineWidth: 12 },
      steps: [
        'Pick an image, drag it in, or paste with Ctrl+V',
        'Background removal and the outline are already on — set width and colour',
        'If you see a coloured halo along the contour, raise “Shrink edge”',
      ],
      faq: [
        { q: 'Where does the coloured halo along the contour come from?',
          a: 'Those are pixels whose colour is already blended with the background — they were '
            + 'semi-transparent in the shot itself. The “Shrink edge” slider pulls the boundary '
            + 'inward by a few pixels and removes them. One pixel usually settles it and is '
            + 'barely noticeable.' },
        { q: 'Why is the canvas larger than I asked for?',
          a: 'Because the outline did not fit. A contour around a subject that touches the edge '
            + 'would have to be clipped — instead the canvas grows.' },
        { q: 'Can I outline without removing the background?',
          a: 'No: the contour follows the mask edge, and the mask is exactly the result of '
            + 'separating subject from background. The background itself can stay visible '
            + 'if you pick a different framing mode.' },
      ],
    }),

    ...biPage('batch-convert', (locale) => locale === 'uk' ? {
      slug: 'пакетна-обробка',
      title: 'Пакетна обробка зображень онлайн — багато файлів, один ZIP',
      description: 'Оберіть кілька файлів одразу й заберіть архів. Двадцять знімків 12 Мп '
        + 'проходять за 3,4 с — виміряно у браузері.',
      h1: 'Пакетна обробка',
      intro: 'Оберіть більше одного файлу — і віджет перемкнеться в пакетний режим. Налаштування '
        + 'діють на всі файли, готові складаються в ZIP. Виміряно на продакшені: двадцять знімків '
        + '4032×3024 з теґом орієнтації пройшли за 3,4 с, купа JavaScript — 150 МБ.',
      preset: { ...KEEP_SIZE, format: 'webp', padTransparent: true },
      steps: [
        'Оберіть кілька файлів одразу або перетягніть їх у вікно',
        'Налаштування нижче діють на весь пакет — формат, розмір, фон',
        'Заберіть ZIP. Якщо змінити налаштування, з’явиться кнопка «Обробити наново»',
      ],
      faq: [
        { q: 'Скільки файлів витримає?',
          a: 'Двадцять знімків із айфона — звичайна справа: 3,4 с на весь пакет. Обмеження не '
            + 'в кількості, а в пам’яті вкладки: усі результати тримаються в ній до складання '
            + 'архіву. Під кнопкою ZIP видно, скільки вони важать разом.' },
        { q: 'Чому з видаленням фону повільніше?',
          a: 'Бо з моделлю файли йдуть по одному. Виміряно: чотири одночасні сесії з’їдають '
            + '1,2 ГБ і дають лише 1,8× — onnxruntime уже розпаралелений усередині сесії, '
            + 'і другий рівень паралелізму лише відбирає в неї ядра. Без моделі працює '
            + 'чотири воркери, і це втричі швидше.' },
        { q: 'Що станеться з битим файлом?',
          a: 'Він отримає позначку «помилка» і не зупинить решту. У пакеті з двадцяти одна '
            + 'зіпсована фотографія — звичайна справа.' },
        { q: 'Чи стискається архів?',
          a: 'Залежить від формату. Для PNG стиснення дає 15 % — наш кодувальник тисне швидко '
            + 'й лишає надлишковість. Для WebP, JPEG і AVIF воно дає 0,1 % за десятикратний час, '
            + 'тож вони складаються як є.' },
      ],
    } : {
      slug: 'batch-convert',
      title: 'Batch image processing online — many files, one ZIP',
      description: 'Pick several files at once and take an archive. Twenty 12 MP shots go '
        + 'through in 3.4 s — measured in the browser.',
      h1: 'Batch processing',
      intro: 'Pick more than one file and the widget switches to batch mode. The settings apply '
        + 'to every file and the finished ones are collected into a ZIP. Measured on production: '
        + 'twenty 4032×3024 shots carrying an orientation tag went through in 3.4 s, with a '
        + '150 MB JavaScript heap.',
      preset: { ...KEEP_SIZE, format: 'webp', padTransparent: true },
      steps: [
        'Pick several files at once, or drag them into the window',
        'The settings below apply to the whole batch — format, size, background',
        'Take the ZIP. Change a setting and a “Process again” button appears',
      ],
      faq: [
        { q: 'How many files will it take?',
          a: 'Twenty phone shots is routine: 3.4 s for the whole batch. The limit is not the '
            + 'count but the tab’s memory — every result is held there until the archive is '
            + 'built. The total weight is shown on the ZIP button.' },
        { q: 'Why is background removal slower?',
          a: 'Because with a model the files go one at a time. Measured: four concurrent sessions '
            + 'eat 1.2 GB and buy only 1.8× — ONNX Runtime already parallelises inside a session, '
            + 'and a second layer of parallelism just takes cores away from it. Without a model, '
            + 'four workers run and it is three times faster.' },
        { q: 'What happens to a broken file?',
          a: 'It gets marked “failed” and does not stop the rest. One corrupt photo in a batch '
            + 'of twenty is an ordinary thing.' },
        { q: 'Is the archive compressed?',
          a: 'Depends on the format. For PNG compression buys 15% — our encoder works fast and '
            + 'leaves redundancy behind. For WebP, JPEG and AVIF it buys 0.1% for ten times the '
            + 'CPU, so those are stored as they are.' },
      ],
    }),

    ...biPage('fix-rotated-photo', (locale) => locale === 'uk' ? {
      slug: 'фото-лежить-набік',
      title: 'Фото лежить набік після конвертації — чому і як полагодити',
      description: 'Орієнтація в JPEG і HEIC записана окремим теґом EXIF, а не в пікселях. '
        + 'Тут він читається й застосовується сам.',
      h1: 'Фото лежить набік',
      intro: 'Знімок виглядає рівним у галереї, а після конвертації лягає набік. Причина не '
        + 'у вашому файлі: орієнтація в JPEG і HEIC записана окремим теґом EXIF, а не в самих '
        + 'пікселях. Браузер у теґу <img> цей теґ застосовує, а більшість декодерів — ні.',
      preset: { ...KEEP_SIZE, format: 'jpeg', padTransparent: false },
      steps: [
        'Оберіть знімок, який лягає набік',
        'Нічого вмикати не треба — теґ орієнтації читається й застосовується сам',
        'Заберіть результат: у ньому поворот уже вбудований у пікселі',
      ],
      faq: [
        { q: 'Чому так узагалі буває?',
          a: 'Камера телефона знімає матрицею в одному положенні й не повертає пікселі — вона '
            + 'просто дописує теґ «поверни на 90°». Програма, яка теґ читає, показує рівно; '
            + 'та, що не читає, — набік. Ми перевіряли: наш власний декодер віддавав 8×4 '
            + 'і з теґом, і без нього.' },
        { q: 'Коли саме застосовується поворот?',
          a: 'Найпершою дією, до всього іншого. Це принципово: маска, кадрування й прив’язка '
            + 'полів працюють у координатах, і повернути кадр після них означало б, що '
            + '«вгорі ліворуч» опиниться не там, де ви його бачили.' },
        { q: 'А якщо теґ битий?',
          a: 'Тоді він просто ігнорується. Зіпсований EXIF трапляється частіше, ніж хотілося б, '
            + 'і це не привід не обробити фотографію.' },
      ],
    } : {
      slug: 'fix-rotated-photo',
      title: 'Photo comes out sideways after converting — why, and how to fix it',
      description: 'In JPEG and HEIC the orientation lives in a separate EXIF tag, not in the '
        + 'pixels. Here it is read and applied for you.',
      h1: 'Photo comes out sideways',
      intro: 'The shot looks upright in the gallery and lands on its side after converting. The '
        + 'cause is not your file: in JPEG and HEIC the orientation lives in a separate EXIF tag '
        + 'rather than in the pixels. The browser applies that tag in an <img>; most decoders '
        + 'do not.',
      preset: { ...KEEP_SIZE, format: 'jpeg', padTransparent: false },
      steps: [
        'Pick the shot that keeps coming out sideways',
        'Nothing to switch on — the orientation tag is read and applied for you',
        'Take the result: the rotation is baked into the pixels now',
      ],
      faq: [
        { q: 'Why does this happen at all?',
          a: 'The phone camera shoots with the sensor in one position and does not rotate the '
            + 'pixels — it simply writes a “rotate 90°” tag. Software that reads the tag shows it '
            + 'upright; software that does not shows it sideways. We checked: our own decoder '
            + 'returned 8×4 with the tag and without it alike.' },
        { q: 'When exactly is the rotation applied?',
          a: 'First, before anything else. That matters: masking, cropping and padding anchors all '
            + 'work in coordinates, and rotating after them would put “top left” somewhere other '
            + 'than where you saw it.' },
        { q: 'What if the tag is corrupt?',
          a: 'Then it is simply ignored. Broken EXIF turns up more often than one would like, and '
            + 'it is no reason to refuse to process a photograph.' },
      ],
    }),
  ];
}
