import type { FitMode, OutputFormat, Tier } from '@obrobka/core';

/**
 * Група, до якої належить сторінка.
 *
 * Потрібна для двох речей: каталогу й внутрішніх посилань. Без них
 * вісімдесят сторінок були б вісімдесятьма сиротами — у sitemap вони є,
 * а дійти до них із сайту ніяк.
 */
export type PageGroup = 'format' | 'preset' | 'task';

/**
 * Спільна форма сторінки-інструмента.
 *
 * Її мають і сторінки, написані руками у YAML, і породжені матрицею.
 * Тип один навмисно: шаблон, маршрут і схема колекції не повинні
 * знати, звідки взявся запис.
 */
export interface ToolPage {
  readonly group?: PageGroup;
  readonly slug: string;
  readonly locale: 'uk' | 'en';
  /** id парного запису в іншій локалі. */
  readonly pair: string;
  readonly title: string;
  readonly description: string;
  readonly h1: string;
  readonly intro: string;
  readonly preset: {
    readonly width: number;
    readonly height: number;
    readonly mode: FitMode;
    readonly format: OutputFormat;
    readonly padTransparent: boolean;
    readonly removeBg?: boolean;
    readonly tier?: Tier;
    readonly outlineOn?: boolean;
    readonly outlineWidth?: number;
  };
  readonly steps: readonly string[];
  readonly faq: readonly { readonly q: string; readonly a: string }[];
}

/** Запис колекції: сторінка плюс її ідентифікатор. */
export interface ToolEntry extends ToolPage {
  readonly id: string;
}

/**
 * Пресет «нічого не міняти, крім формату».
 *
 * Режим inside із межею, більшою за будь-яке фото, і без дозволу
 * збільшувати: масштаб затискається до одиниці, а ресемплер має швидкий
 * шлях на однаковому розмірі — пікселі проходять недоторканими.
 */
export const KEEP_SIZE = { width: 20000, height: 20000, mode: 'inside' } as const;

/** Пара локалізованих рядків. */
export interface Bi { readonly uk: string; readonly en: string }

/**
 * Розгортає двомовний опис у два записи колекції.
 *
 * Пари посилаються одна на одну за id, а не за слагом: слаги в локалях
 * різні, і зв'язок за ними довелось би шукати перебором.
 */
export function biPage(
  id: string,
  make: (locale: 'uk' | 'en') => Omit<ToolPage, 'locale' | 'pair'>,
): ToolEntry[] {
  return (['uk', 'en'] as const).map((locale) => ({
    id: `${id}.${locale}`,
    locale,
    pair: `${id}.${locale === 'uk' ? 'en' : 'uk'}`,
    ...make(locale),
  }));
}

/**
 * Дробове число в тому вигляді, у якому його пишуть у цій мові.
 *
 * Українська відділяє дробову частину комою. «0.41 %» замість «0,41 %» —
 * рівно та дрібниця, за якою впізнають машинний переклад, і виправляти
 * її по одному місцю означає забути в другому.
 */
export function decimal(value: number, digits: number, locale: 'uk' | 'en'): string {
  const text = value.toFixed(digits);
  return locale === 'uk' ? text.replace('.', ',') : text;
}
