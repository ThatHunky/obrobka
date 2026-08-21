import type { OutputFormat } from '@obrobka/core';

export type ItemStatus = 'queued' | 'working' | 'done' | 'error';

export interface BatchItem {
  readonly id: number;
  readonly name: string;
  readonly mime: string;
  readonly sourceSize: number;
  status: ItemStatus;
  /** Ім'я у ZIP-архіві. Проставляється, коли файл готовий. */
  outputName?: string;
  resultSize?: number;
  error?: string;
}

/**
 * Скільки воркерів запускати.
 *
 * Дві різні відповіді для двох різних робіт — і обидві виміряні.
 *
 * Без моделі пул масштабується: 20 файлів пройшли за 3639 мс в один потік,
 * 1186 мс у чотири (3,1×) і 915 мс у вісім. Восьмий воркер додає 0,9× за
 * ще 150 МБ — на восьми ядрах вони вже конкурують між собою.
 *
 * З моделлю все навпаки. Кожна сесія ONNX коштує ~285 МБ для U²-Netp і
 * ~1,1 ГБ для isnet, а прискорення — лише 1,8× на чотирьох, бо onnxruntime
 * уже розпаралелений усередині сесії й другий рівень паралелізму лише
 * відбирає в неї ядра. Дві сесії isnet — 2,2 ГБ, за практичною стелею вкладки.
 */
export function poolSize(needsModel: boolean, cores: number | undefined): number {
  if (needsModel) return 1;
  const known = typeof cores === 'number' && cores > 0 ? cores : 4;
  return Math.max(1, Math.min(known - 1, 4));
}

/**
 * Рівень стиснення для архіву.
 *
 * Виміряно на справжніх фото: deflate віднімає в WebP 0,1 % за десятикратний
 * час, а в PNG — цілих 15,2 %. Причина в тому, що наш кодувальник PNG тисне
 * швидко й лишає в потоці надлишковість. Рівень 4 бере всю економію;
 * шостий і дев'ятий не додають нічого, крім секунд.
 */
export function zipLevel(format: OutputFormat): 0 | 4 {
  return format === 'png' ? 4 : 0;
}

/**
 * Розводить збіги імен у межах архіву.
 *
 * Після зміни розширення `photo.jpg` і `photo.png` дають той самий
 * `photo.webp`. Мовчки покласти в архів один файл замість двох — найгірше
 * з того, що може статися з пакетною обробкою.
 */
export function uniqueName(taken: Set<string>, source: string, format: OutputFormat): string {
  const stem = source.replace(/\.[^./\\]+$/, '').replace(/^.*[/\\]/, '') || 'image';
  let name = `${stem}.${format}`;
  let n = 2;
  while (taken.has(name)) name = `${stem}-${n++}.${format}`;
  taken.add(name);
  return name;
}

export interface BatchRunner<T> {
  /** Обробляє один елемент. Номер слота каже, яким воркером користуватись. */
  readonly run: (item: T, slot: number) => Promise<void>;
  readonly concurrency: number;
  readonly onProgress?: (done: number, total: number) => void;
  readonly signal?: AbortSignal;
}

/**
 * Проганяє чергу через кілька паралельних слотів.
 *
 * Помилка одного файлу не зупиняє решту: у пакеті з двадцяти фотографій
 * одна пошкоджена — звичайна справа, і кидати через неї всю роботу
 * означало б змусити людину шукати винуватця вручну.
 *
 * Прогрес рахує завершені, а не запущені: смуга, що стрибає вперед на
 * старті задачі, обіцяє те, чого ще немає.
 */
export async function runBatch<T>(items: readonly T[], opts: BatchRunner<T>): Promise<void> {
  let next = 0;
  let done = 0;
  const total = items.length;

  const worker = async (slot: number): Promise<void> => {
    for (;;) {
      if (opts.signal?.aborted === true) return;
      const index = next++;
      if (index >= total) return;
      try {
        await opts.run(items[index]!, slot);
      } catch {
        // Статус елемента виставляє сам run — тут лише не даємо
        // одному файлу обірвати чергу.
      }
      done++;
      opts.onProgress?.(done, total);
    }
  };

  const slots = Math.max(1, Math.min(opts.concurrency, total));
  await Promise.all(Array.from({ length: slots }, (_, slot) => worker(slot)));
}

/** Файли для архіву: ім'я → байти. */
export type ZipEntries = Readonly<Record<string, Uint8Array>>;

/**
 * Збирає ZIP.
 *
 * fflate імпортується динамічно: людині, яка обробила один файл,
 * архіватор не потрібен зовсім.
 */
export async function makeZip(entries: ZipEntries, format: OutputFormat): Promise<Blob> {
  const { zip } = await import('fflate');
  const level = zipLevel(format);
  const input = Object.fromEntries(
    Object.entries(entries).map(([name, bytes]) => [name, [bytes, { level }] as const]),
  );

  const packed = await new Promise<Uint8Array>((resolve, reject) => {
    zip(input as Parameters<typeof zip>[0], (err, data) => {
      if (err !== null) { reject(err); return; }
      resolve(data);
    });
  });
  return new Blob([packed as unknown as BlobPart], { type: 'application/zip' });
}
