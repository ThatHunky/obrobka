import type { PageGroup } from '../data/page.js';

/**
 * Мінімум, який потрібен каталогу й перехресним посиланням.
 *
 * Свідомо не CollectionEntry: сюди приходять записи з двох різних
 * колекцій, а різниця між ними тут не має жодного значення.
 */
export interface Listed {
  readonly id: string;
  readonly group: PageGroup;
  readonly locale: 'uk' | 'en';
  readonly slug: string;
  readonly h1: string;
  readonly description: string;
}

export function pathOf(page: Pick<Listed, 'locale' | 'slug'>): string {
  return page.locale === 'uk' ? `/${page.slug}/` : `/en/${page.slug}/`;
}

/**
 * Сусіди тієї самої сторінки.
 *
 * Дві вимоги, які легко порушити випадково. Перша: посилання мають бути
 * осмисленими, а не «ось вам ще п'ять адрес» — тому спершу беруться
 * найближчі за змістом. Друга: набір має бути сталим між збірками,
 * інакше кожна перезбірка переписувала б половину сторінок.
 */
export function relatedTo(page: Listed, all: readonly Listed[], limit = 6): Listed[] {
  const pool = all.filter((p) => p.locale === page.locale && p.id !== page.id);

  const score = (other: Listed): number => {
    if (other.group !== page.group) return 0;
    if (page.group !== 'format') return 1;

    // Для пар форматів «близько» означає спільний бік переходу:
    // з того самого джерела або в ту саму ціль. Зворотна пара —
    // найкорисніше посилання з усіх, бо це буквально питання навпаки.
    const [from, , to] = page.id.replace(/\.(uk|en)$/, '').split('-');
    const [oFrom, , oTo] = other.id.replace(/\.(uk|en)$/, '').split('-');
    if (oFrom === to && oTo === from) return 4;
    if (oFrom === from) return 3;
    if (oTo === to) return 2;
    return 1;
  };

  return pool
    .map((p) => ({ p, s: score(p) }))
    .filter((x) => x.s > 0)
    // Сортування детерміноване до останнього ключа: за вагою, потім за id.
    .sort((a, b) => b.s - a.s || a.p.id.localeCompare(b.p.id))
    .slice(0, limit)
    .map((x) => x.p);
}

export interface Section {
  readonly group: PageGroup;
  readonly pages: readonly Listed[];
}

/** Каталог: три розділи у сталому порядку, всередині — за абеткою. */
export function catalogue(all: readonly Listed[], locale: 'uk' | 'en'): Section[] {
  const order: PageGroup[] = ['task', 'format', 'preset'];
  return order.map((group) => ({
    group,
    pages: all
      .filter((p) => p.locale === locale && p.group === group)
      .sort((a, b) => a.h1.localeCompare(b.h1, locale)),
  }));
}
