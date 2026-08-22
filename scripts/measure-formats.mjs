#!/usr/bin/env node
/**
 * Міряє те, що потім стоїть на сторінках порівняння форматів.
 *
 * Числа на лендінгах мають бути перевірюваними, інакше це просто ще один
 * текст «WebP менший за JPEG». Запустіть цей скрипт — і побачите ті самі
 * значення, що лежать у apps/web/src/data/formats.ts.
 *
 * Два сюжети, бо відповідь у них різна. Фотографія — плавні переходи,
 * шум, немає різких країв. Плаский графічний сюжет — великі однотонні
 * зони й контрастні межі, як у скріншоті чи схемі. Формат, який виграє
 * на одному, програє на другому.
 *
 * Фотографії беруться з picsum.photos і кешуються поруч із моделями.
 *
 *   node scripts/measure-formats.mjs
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { nodeCodec } from '../packages/codecs/dist/node.js';

const DIR = join(homedir(), '.cache', 'obrobka', 'fixtures', 'photos');
const IDS = [64, 91, 1080, 292, 225, 431, 659, 1015, 1024, 133];
const QUALITY = 80;

async function corpus() {
  await mkdir(DIR, { recursive: true });
  const images = [];
  for (const id of IDS) {
    const path = join(DIR, `${id}.jpg`);
    try {
      await stat(path);
    } catch {
      const res = await fetch(`https://picsum.photos/id/${id}/1200/800.jpg`);
      if (!res.ok) throw new Error(`picsum віддав HTTP ${res.status} для ${id}`);
      await writeFile(path, new Uint8Array(await res.arrayBuffer()));
    }
    images.push(await nodeCodec.decode(new Uint8Array(await readFile(path)), 'image/jpeg'));
  }
  return images;
}

/** Плаский сюжет: смуги, прямокутники, різкі межі — те, на чому ламаються лосі. */
function graphic(w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  const palette = [[247, 248, 252], [27, 32, 54], [217, 150, 18], [255, 255, 255], [77, 208, 225]];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let c = palette[0];
      if (y < h * 0.12) c = palette[1];
      else if (x > w * 0.7 && y > h * 0.2 && y < h * 0.8) c = palette[3];
      else if (y > h * 0.3 && y < h * 0.42 && x < w * 0.55) c = palette[2];
      else if (y > h * 0.5 && y < h * 0.56 && x < w * 0.4) c = palette[4];
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

const FORMATS = ['png', 'jpeg', 'webp', 'avif'];

async function encode(img, format) {
  return nodeCodec.encode(img, format === 'png' ? { format } : { format, quality: QUALITY });
}

async function averageKb(images, format) {
  let total = 0;
  for (const img of images) total += (await encode(img, format)).length;
  return total / images.length / 1024;
}

/**
 * Локальна похибка.
 *
 * PSNR на плоскому сюжеті вводить в оману: більшість пікселів ідеальні,
 * середнє виходить чудовим, а вся біда сидить уздовж кількох країв.
 * Тому міряємо максимальне відхилення каналу й частку пікселів,
 * що відхилились більше ніж на вісім рівнів — межу помітності на око.
 */
async function edgeError(img, format) {
  const back = await nodeCodec.decode(await encode(img, format), `image/${format}`);
  let max = 0;
  let visible = 0;
  let counted = 0;
  for (let i = 0; i < img.data.length; i++) {
    if (i % 4 === 3) continue;
    const d = Math.abs(img.data[i] - back.data[i]);
    if (d > max) max = d;
    if (d > 8) visible++;
    counted++;
  }
  return { max, visiblePercent: (visible / counted) * 100 };
}

const photos = await corpus();
const graphics = [graphic(1200, 800), graphic(900, 600), graphic(1600, 900)];

console.log(`Фото: ${photos.length} × 1200×800. Графіка: ${graphics.length} сюжети. Якість ${QUALITY}.\n`);
console.log('формат   фото, КБ   графіка, КБ   % від JPEG (фото)   % від JPEG (графіка)');

const kb = {};
for (const f of FORMATS) {
  kb[f] = { photo: await averageKb(photos, f), graphic: await averageKb(graphics, f) };
}
for (const f of FORMATS) {
  const p = kb[f].photo;
  const g = kb[f].graphic;
  console.log(
    `${f.padEnd(8)} ${p.toFixed(0).padStart(8)} ${g.toFixed(0).padStart(13)}` +
    `${((p / kb.jpeg.photo) * 100).toFixed(0).padStart(20)}%` +
    `${((g / kb.jpeg.graphic) * 100).toFixed(0).padStart(22)}%`,
  );
}

console.log('\nЛокальна похибка на плоскій графіці:');
for (const f of ['jpeg', 'webp', 'avif']) {
  const e = await edgeError(graphics[0], f);
  console.log(`  ${f.padEnd(6)} максимум ${String(e.max).padStart(3)}   помітних пікселів ${e.visiblePercent.toFixed(2)} %`);
}
