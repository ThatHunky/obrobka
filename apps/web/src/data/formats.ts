/**
 * Що ми насправді знаємо про формати — і звідки.
 *
 * Числа тут виміряні, а не взяті з чужих статей. Корпус: десять
 * фотографій 1200×800 і плаский графічний сюжет із великими однотонними
 * зонами й різкими краями, як у скріншоті. Кодування — нашими ж кодеками,
 * якість 80. Скрипт вимірювання лежить поруч: `scripts/measure-formats.mjs`.
 */

export type SourceFormat = 'png' | 'jpeg' | 'webp' | 'avif' | 'heic';
export type TargetFormat = 'png' | 'jpeg' | 'webp' | 'avif';

export interface FormatFacts {
  readonly label: string;
  /** Чи здатний нести прозорість. */
  readonly alpha: boolean;
  /** Чи стискає з втратами. */
  readonly lossy: boolean;
  /** Середній розмір кадру 1200×800 у кілобайтах. */
  readonly photoKb: number;
  readonly graphicKb: number;
}

/**
 * HEIC вимірювати нема сенсу: ми його лише читаємо, а розмір вхідного
 * файлу задає камера, а не ми. Тому в нього немає своїх кілобайтів.
 */
export const FORMATS: Readonly<Record<SourceFormat, FormatFacts>> = {
  png:  { label: 'PNG',  alpha: true,  lossy: false, photoKb: 1489, graphicKb: 26 },
  jpeg: { label: 'JPEG', alpha: false, lossy: true,  photoKb: 113,  graphicKb: 9 },
  webp: { label: 'WebP', alpha: true,  lossy: true,  photoKb: 85,   graphicKb: 3 },
  avif: { label: 'AVIF', alpha: true,  lossy: true,  photoKb: 45,   graphicKb: 1 },
  heic: { label: 'HEIC', alpha: false, lossy: true,  photoKb: 0,    graphicKb: 0 },
};

export const SOURCES: readonly SourceFormat[] = ['png', 'jpeg', 'webp', 'avif', 'heic'];
export const TARGETS: readonly TargetFormat[] = ['png', 'jpeg', 'webp', 'avif'];

/**
 * Локальна похибка кожного формату з втратами на плоскій графіці.
 *
 * Вимірювалося окремо, бо PSNR тут бреше: на переважно однотонному кадрі
 * він усереднюється до гарних цифр, а артефакти живуть уздовж кількох
 * різких країв. Тому — максимальне відхилення каналу та частка пікселів,
 * що відхилились більше ніж на вісім рівнів.
 *
 * Результат виявився протилежним очікуваному: на графіці JPEG точніший
 * за WebP і AVIF, хоч і втричі більший за WebP.
 */
export interface EdgeError {
  readonly maxDeviation: number;
  readonly visiblePercent: number;
}

export const GRAPHIC_EDGE_ERROR: Readonly<Record<'jpeg' | 'webp' | 'avif', EdgeError>> = {
  jpeg: { maxDeviation: 56, visiblePercent: 0.07 },
  webp: { maxDeviation: 69, visiblePercent: 0.41 },
  avif: { maxDeviation: 112, visiblePercent: 0.43 },
};

/** Розмір цілі у відсотках від JPEG на тому самому сюжеті. */
export function relativeToJpeg(target: TargetFormat, kind: 'photo' | 'graphic'): number {
  const key = kind === 'photo' ? 'photoKb' : 'graphicKb';
  return Math.round((FORMATS[target][key] / FORMATS.jpeg[key]) * 100);
}

/** Чи втрачається прозорість при такому переході. */
export function losesAlpha(from: SourceFormat, to: TargetFormat): boolean {
  return FORMATS[from].alpha && !FORMATS[to].alpha;
}
