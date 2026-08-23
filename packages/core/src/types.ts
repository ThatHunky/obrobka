/** RGBA, non-premultiplied, 8 біт на канал, рядок за рядком. */
export interface RasterImage {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

/** Одноканальна маска, 0..255. */
export interface Mask {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface RGBA {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/**
 * contain — вписати цілком, лишок заповнити полями; вихід рівно width×height
 * cover   — заповнити повністю, надлишок обрізати; вихід рівно width×height
 * fill    — розтягнути, ігноруючи співвідношення; вихід рівно width×height
 * inside  — вписати цілком, вихід має розмір вписаного, полів немає
 * outside — покрити, вихід має розмір масштабованого, обрізки немає
 */
export type FitMode = 'contain' | 'cover' | 'fill' | 'inside' | 'outside';

/**
 * Дев'ять точок прив'язки, частка вільного місця або зміщення в пікселях.
 *
 * Частка — узагальнення іменованих точок: `top-left` це `{fx: 0, fy: 0}`,
 * `center` — `{fx: 0.5, fy: 0.5}`. На відміну від пікселів вона означає
 * те саме після зміни цільового розміру й на кожному файлі пакета, тож
 * саме її дає тягнення в інтерфейсі.
 */
export type Position =
  | 'center' | 'top' | 'bottom' | 'left' | 'right'
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  | { readonly fx: number; readonly fy: number }
  | { readonly x: number; readonly y: number };

export const POSITIONS = [
  'top-left', 'top', 'top-right',
  'left', 'center', 'right',
  'bottom-left', 'bottom', 'bottom-right',
] as const;

export interface FitOptions {
  readonly width: number;
  readonly height: number;
  readonly mode: FitMode;
  /** Колір полів для contain. Типово прозорий. */
  readonly pad?: RGBA | 'transparent';
  /** Типово 'center'. */
  readonly position?: Position;
  /** Чи дозволено збільшувати. Діє лише для contain та inside. Типово false. */
  readonly allowUpscale?: boolean;
  /**
   * Множник масштабу, не менше за 1. Типово 1.
   *
   * Застосовується після обмеження allowUpscale: той прапорець відповідає
   * на питання «чи можна збільшувати те, що менше за кадр», а zoom —
   * явний жест людини, яка вже дивиться на результат.
   *
   * Має сенс лише для contain і cover: у fill, inside та outside вільного
   * місця немає, і рухати нічого.
   */
  readonly zoom?: number;
}

export type Tier = 'fast' | 'portrait' | 'quality';

export interface OutlineOptions {
  /** Товщина обведення в пікселях вихідного зображення. */
  readonly width: number;
  readonly color: RGBA;
  /** Пом'якшення краю обведення. Типово 0. */
  readonly feather?: number;
  /** Чи розширювати полотно, коли обведення не влазить. Типово true. */
  readonly expand?: boolean;
}

export type BlendMode =
  | 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten';

/**
 * Зображення, накладене поверх основи.
 *
 * Геометрія нормалізована відносно основи — тобто полотна після fit, бо
 * саме там composite і виконується. Без цього «один водяний знак на
 * двадцять файлів різного розміру» був би неможливий: у пікселях те саме
 * число означало б на кожному файлі інше місце.
 */
export interface Layer {
  readonly image: RasterImage;
  /** Центр шару як частка ширини основи. */
  readonly x: number;
  /** Центр шару як частка висоти основи. */
  readonly y: number;
  /**
   * Ширина шару як частка ширини основи. Висота береться з власного
   * співвідношення шару, тож накладене ніколи не розтягується.
   */
  readonly scale: number;
  /** Градуси за годинниковою стрілкою навколо центра. Типово 0. */
  readonly rotation?: number;
  /** 0..1. Типово 1. Домножує альфу шару після змішування. */
  readonly opacity?: number;
  /** Типово 'normal'. */
  readonly blend?: BlendMode;
}

export interface SmartCropOptions {
  /** Ширина, поділена на висоту. */
  readonly aspectRatio: number;
  /** Запас навколо суб'єкта як частка його більшої сторони. Типово 0.08. */
  readonly padding?: number;
  /** Поріг маски. Типово 128. */
  readonly threshold?: number;
  /** Рівень моделі для пошуку суб'єкта. Типово fast. */
  readonly tier?: Tier;
}

export type OutputFormat = 'png' | 'jpeg' | 'webp' | 'avif';

export interface EncodeOptions {
  readonly format: OutputFormat;
  /** 1..100. Ігнорується для png. */
  readonly quality?: number;
}

export type Op =
  | ({ readonly type: 'fit' } & FitOptions)
  | { readonly type: 'crop'; readonly rect: Rect }
  | {
      readonly type: 'removeBackground';
      readonly tier?: Tier;
      /** Пом'якшення краю в пікселях. Типово 0. */
      readonly feather?: number;
      /**
       * Стиснення краю в пікселях — головний засіб проти кольорового ореолу.
       * Типово 1: один піксель прибирає більшість забруднених кольором точок
       * і майже не помітний на око.
       */
      readonly shrink?: number;
      /** Прибирати дрібні хибні острівці маски. Типово true. */
      readonly despeckle?: boolean;
      /** Заповнювати дірки всередині суб'єкта. Типово true. */
      readonly fillHoles?: boolean;
    }
  | ({ readonly type: 'outline' } & OutlineOptions)
  | ({ readonly type: 'smartCrop' } & SmartCropOptions)
  | {
      /** Збільшення нейромережею. Виконується тайлами. */
      readonly type: 'upscale';
      readonly factor: 2 | 4;
    }
  | {
      /**
       * Накладає зображення поверх. Порядок масиву — порядок накладання:
       * перший шар лежить найнижче.
       */
      readonly type: 'composite';
      readonly layers: readonly Layer[];
    }
  | {
      /** Обрізає порожні краї до прямокутника суб'єкта. */
      readonly type: 'trim';
      /** Запас навколо суб'єкта як частка його більшої сторони. Типово 0. */
      readonly padding?: number;
      readonly threshold?: number;
      readonly tier?: Tier;
    };

export interface Job {
  readonly ops: readonly Op[];
  readonly output: EncodeOptions;
  /**
   * Чи повертати зображення за теґом EXIF Orientation. Типово true.
   *
   * Декодери віддають сирі пікселі й про орієнтацію не знають, а браузер
   * у теґу `<img>` її застосовує. Без цього кроку вертикальне фото
   * з телефона виглядало б рівним до обробки й покладеним набік після неї.
   *
   * Вимикати варто лише тоді, коли поворот уже застосував хтось інший.
   */
  readonly autoOrient?: boolean;
}

export const TRANSPARENT: RGBA = { r: 0, g: 0, b: 0, a: 0 };
