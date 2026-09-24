import type { Mask, Rect } from '../types.js';

const DEFAULT_THRESHOLD = 128;

/**
 * Прямокутник, що охоплює всі пікселі маски вище порогу.
 *
 * Це і є «визначення суб'єкта»: окрема модель детекції не потрібна,
 * бо маска сегментації вже містить потрібну інформацію.
 */
export function maskBBox(mask: Mask, threshold = DEFAULT_THRESHOLD): Rect {
  let minX = mask.width, minY = mask.height, maxX = -1, maxY = -1;
  for (let y = 0; y < mask.height; y++) {
    const row = y * mask.width;
    for (let x = 0; x < mask.width; x++) {
      if (mask.data[row + x]! < threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) {
    throw new RangeError(
      `Не вдалося знайти суб'єкт: жоден піксель маски не перевищує поріг ${threshold}`,
    );
  }
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Змінює роздільність маски білінійно.
 *
 * На відміну від resample для RGBA, premultiply тут не потрібен:
 * маска — це і є альфа, множити її нема на що.
 */
export function resampleMask(mask: Mask, width: number, height: number): Mask {
  if (width < 1 || height < 1) {
    throw new RangeError(`Цільовий розмір має бути додатним, отримано ${width}×${height}`);
  }
  if (width === mask.width && height === mask.height) {
    return { data: new Uint8ClampedArray(mask.data), width, height };
  }

  const out = new Uint8ClampedArray(width * height);
  const sx = mask.width / width;
  const sy = mask.height / height;

  for (let y = 0; y < height; y++) {
    const fy = Math.min(mask.height - 1, Math.max(0, (y + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(mask.height - 1, y0 + 1);
    const ty = fy - y0;

    for (let x = 0; x < width; x++) {
      const fx = Math.min(mask.width - 1, Math.max(0, (x + 0.5) * sx - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(mask.width - 1, x0 + 1);
      const tx = fx - x0;

      const a = mask.data[y0 * mask.width + x0]!;
      const b = mask.data[y0 * mask.width + x1]!;
      const c = mask.data[y1 * mask.width + x0]!;
      const d = mask.data[y1 * mask.width + x1]!;

      out[y * width + x] =
        (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    }
  }
  return { data: out, width, height };
}

/** Максимум у круговому околі радіуса r — класична морфологічна дилатація. */
export function dilateMask(mask: Mask, radius: number): Mask {
  const r = Math.round(radius);
  if (r <= 0) {
    return { data: new Uint8ClampedArray(mask.data), width: mask.width, height: mask.height };
  }

  const out = new Uint8ClampedArray(mask.data.length);
  const r2 = r * r;
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      let best = 0;
      for (let dy = -r; dy <= r && best < 255; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= mask.height) continue;
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r2) continue;
          const xx = x + dx;
          if (xx < 0 || xx >= mask.width) continue;
          const v = mask.data[yy * mask.width + xx]!;
          if (v > best) { best = v; if (best === 255) break; }
        }
      }
      out[y * mask.width + x] = best;
    }
  }
  return { data: out, width: mask.width, height: mask.height };
}

/**
 * Пом'якшення краю коробковим розмиттям у два проходи.
 *
 * Коробкове, а не гаусове: центр краю не зсувається, а різниця на око
 * непомітна при радіусах, які тут використовуються.
 *
 * Суми ковзні, тож ціна не залежить від радіуса. Маска тепер приходить у
 * роздільності зображення, а не моделі, — на 12 Мп наївні 2·(2r+1)
 * звертань на піксель коштували б секунду на кожен рух повзунка.
 * Суми цілі й ділиться лише наприкінці: так результат не залежить від
 * того, в якому порядку їх накопичено.
 */
export function featherMask(mask: Mask, radius: number): Mask {
  const r = Math.round(radius);
  if (r <= 0) {
    return { data: new Uint8ClampedArray(mask.data), width: mask.width, height: mask.height };
  }

  const { width: w, height: h } = mask;
  const span = r * 2 + 1;
  const tmp = new Int32Array(mask.data.length);
  const out = new Uint8ClampedArray(mask.data.length);
  const cx = (x: number): number => (x < 0 ? 0 : x >= w ? w - 1 : x);
  const cy = (y: number): number => (y < 0 ? 0 : y >= h ? h - 1 : y);

  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += mask.data[row + cx(k)]!;
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum;
      sum += mask.data[row + cx(x + r + 1)]! - mask.data[row + cx(x - r)]!;
    }
  }

  const col = new Int32Array(w);
  for (let k = -r; k <= r; k++) {
    const row = cy(k) * w;
    for (let x = 0; x < w; x++) col[x] = col[x]! + tmp[row + x]!;
  }
  const area = span * span;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    const add = cy(y + r + 1) * w;
    const drop = cy(y - r) * w;
    for (let x = 0; x < w; x++) {
      out[row + x] = col[x]! / area;
      col[x] = col[x]! + tmp[add + x]! - tmp[drop + x]!;
    }
  }
  return { data: out, width: w, height: h };
}

/** Різкий поріг: усе вище стає 255, решта 0. */
export function thresholdMask(mask: Mask, threshold = DEFAULT_THRESHOLD): Mask {
  const out = new Uint8ClampedArray(mask.data.length);
  for (let i = 0; i < mask.data.length; i++) {
    out[i] = mask.data[i]! >= threshold ? 255 : 0;
  }
  return { data: out, width: mask.width, height: mask.height };
}

/**
 * Мінімум у круговому околі — ерозія, дзеркальна до дилатації.
 *
 * Головний засіб проти кольорового ореолу: край маски підтягується
 * всередину повз пікселі, колір яких уже змішаний із фоном.
 *
 * Те, що за межами кадру, в мінімум не йде. Край кадру — не край
 * суб'єкта: коли людину обрізано по пояс, під рамкою лежить та сама
 * людина, а не фон, і стискати маску звідти означало б прорізати
 * прозору смугу по низу фотографії.
 *
 * Круг розкладено на горизонтальні хорди: для кожного рядка один раз
 * рахуються мінімуми на відрізках завдовжки 1, 3, … 2r+1, а далі круг
 * збирається з 2r+1 готових хорд. Маска тут у роздільності зображення,
 * і наївні πr² звертань на піксель на 12 Мп тягнули б на секунди.
 */
export function erodeMask(mask: Mask, radius: number): Mask {
  const r = Math.round(radius);
  if (r <= 0) {
    return { data: new Uint8ClampedArray(mask.data), width: mask.width, height: mask.height };
  }

  const { width: w, height: h } = mask;
  const src = mask.data;
  const out = new Uint8ClampedArray(src.length);

  // Півдовжина хорди круга на відстані dy від центру
  const chord = new Int32Array(2 * r + 1);
  for (let dy = -r; dy <= r; dy++) chord[dy + r] = Math.floor(Math.sqrt(r * r - dy * dy));

  // Кільцевий буфер на 2r+1 рядків; у кожному r+1 рядків мінімумів
  const span = 2 * r + 1;
  const slot = (r + 1) * w;
  const buf = new Uint8Array(span * slot);

  function fillRow(yy: number): void {
    const base = (yy % span) * slot;
    const row = yy * w;
    buf.set(src.subarray(row, row + w), base);
    for (let k = 1; k <= r; k++) {
      const prev = base + (k - 1) * w;
      const cur = base + k * w;
      for (let x = 0; x < w; x++) {
        let v = buf[prev + x]!;
        if (x - k >= 0 && src[row + x - k]! < v) v = src[row + x - k]!;
        if (x + k < w && src[row + x + k]! < v) v = src[row + x + k]!;
        buf[cur + x] = v;
      }
    }
  }

  for (let yy = 0; yy <= Math.min(r, h - 1); yy++) fillRow(yy);
  for (let y = 0; y < h; y++) {
    if (y > 0 && y + r < h) fillRow(y + r);
    const row = y * w;
    out.fill(255, row, row + w);
    for (let dy = -r; dy <= r; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= h) continue;
      const from = (yy % span) * slot + chord[dy + r]! * w;
      for (let x = 0; x < w; x++) {
        const v = buf[from + x]!;
        if (v < out[row + x]!) out[row + x] = v;
      }
    }
  }
  return { data: out, width: w, height: h };
}

/** Розмічає зв'язні області за чотирма сусідами. Повертає мітки й площі. */
function labelComponents(
  data: Uint8ClampedArray, width: number, height: number,
  isInside: (v: number) => boolean,
): { labels: Int32Array; areas: number[] } {
  const labels = new Int32Array(width * height).fill(-1);
  const areas: number[] = [];
  const stack: number[] = [];

  for (let start = 0; start < labels.length; start++) {
    if (labels[start] !== -1 || !isInside(data[start]!)) continue;
    const id = areas.length;
    let area = 0;
    stack.push(start);
    labels[start] = id;

    while (stack.length > 0) {
      const i = stack.pop()!;
      area++;
      const x = i % width;
      const y = (i / width) | 0;
      if (x > 0) push(i - 1);
      if (x < width - 1) push(i + 1);
      if (y > 0) push(i - width);
      if (y < height - 1) push(i + width);
    }
    areas.push(area);

    function push(j: number): void {
      if (labels[j] === -1 && isInside(data[j]!)) { labels[j] = id; stack.push(j); }
    }
  }
  return { labels, areas };
}

/**
 * Прибирає дрібні хибні острівці маски.
 *
 * Модель регулярно лишає окремі плями на фоні. Самі по собі вони ледь
 * помітні, але обведення їх підсвічує й перетворює на явні артефакти.
 * Поріг рахується від найбільшої області, а не від усього кадру: так
 * велика окрема частина суб'єкта — скажімо, друга рука — виживає.
 */
export function despeckleMask(
  mask: Mask, minFractionOfLargest = 0.05, threshold = 128,
): Mask {
  const { labels, areas } = labelComponents(
    mask.data, mask.width, mask.height, (v) => v >= threshold,
  );
  if (areas.length <= 1) {
    return { data: new Uint8ClampedArray(mask.data), width: mask.width, height: mask.height };
  }
  const largest = Math.max(...areas);
  const minArea = largest * minFractionOfLargest;

  const out = new Uint8ClampedArray(mask.data);
  for (let i = 0; i < out.length; i++) {
    const id = labels[i]!;
    if (id !== -1 && areas[id]! < minArea) out[i] = 0;
  }
  return { data: out, width: mask.width, height: mask.height };
}

/**
 * Заповнює дірки всередині суб'єкта.
 *
 * Порожня область вважається діркою, лише якщо вона не торкається краю
 * кадру: інакше ми б залили справжній фон.
 */
export function fillMaskHoles(
  mask: Mask, maxFractionOfFrame = 0.02, threshold = 128,
): Mask {
  const { labels, areas } = labelComponents(
    mask.data, mask.width, mask.height, (v) => v < threshold,
  );
  const touchesBorder = new Set<number>();
  const { width, height } = mask;
  for (let x = 0; x < width; x++) {
    touchesBorder.add(labels[x]!);
    touchesBorder.add(labels[(height - 1) * width + x]!);
  }
  for (let y = 0; y < height; y++) {
    touchesBorder.add(labels[y * width]!);
    touchesBorder.add(labels[y * width + width - 1]!);
  }

  const maxArea = width * height * maxFractionOfFrame;
  const out = new Uint8ClampedArray(mask.data);
  for (let i = 0; i < out.length; i++) {
    const id = labels[i]!;
    if (id === -1 || touchesBorder.has(id)) continue;
    if (areas[id]! <= maxArea) out[i] = 255;
  }
  return { data: out, width, height };
}
