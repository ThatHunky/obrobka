import { resample, type RasterImage } from '@obrobka/core';
import type { UpscalerDescriptor } from './registry.js';

/**
 * Доповнює зображення дзеркально до кратного padTo.
 *
 * Swin2SR не приймає довільні розміри. Дзеркальне доповнення, а не
 * чорне: модель дивиться на околиці, і чорна смуга по краю дала б
 * темний ореол на виході.
 */
export function padForModel(
  img: RasterImage, d: UpscalerDescriptor,
): { padded: RasterImage; padX: number; padY: number } {
  const padX = (d.padTo - (img.width % d.padTo)) % d.padTo;
  const padY = (d.padTo - (img.height % d.padTo)) % d.padTo;
  if (padX === 0 && padY === 0) return { padded: img, padX, padY };

  const W = img.width + padX;
  const H = img.height + padY;
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    const sy = y < img.height ? y : Math.max(0, 2 * img.height - y - 2);
    for (let x = 0; x < W; x++) {
      const sx = x < img.width ? x : Math.max(0, 2 * img.width - x - 2);
      const s = (sy * img.width + sx) * 4;
      const t = (y * W + x) * 4;
      data[t] = img.data[s]!; data[t + 1] = img.data[s + 1]!;
      data[t + 2] = img.data[s + 2]!; data[t + 3] = img.data[s + 3]!;
    }
  }
  return { padded: { data, width: W, height: H }, padX, padY };
}

/** RGB → CHW у діапазоні [0, 1]. Нормалізації Swin2SR не потребує. */
export function toUpscaleTensor(img: RasterImage): Float32Array {
  const plane = img.width * img.height;
  const t = new Float32Array(plane * 3);
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < plane; i++) t[c * plane + i] = img.data[i * 4 + c]! / 255;
  }
  return t;
}

/** CHW у [0, 1] → RGBA. Альфа береться з оригіналу, бо модель її не бачить. */
export function fromUpscaleTensor(
  raw: Float32Array, width: number, height: number,
  source: RasterImage, factor: number,
): RasterImage {
  const plane = width * height;
  const data = new Uint8ClampedArray(plane * 4);
  const alpha = resample(
    { data: source.data, width: source.width, height: source.height },
    width, height,
  );
  for (let i = 0; i < plane; i++) {
    data[i * 4] = raw[i]! * 255;
    data[i * 4 + 1] = raw[plane + i]! * 255;
    data[i * 4 + 2] = raw[2 * plane + i]! * 255;
    data[i * 4 + 3] = alpha.data[i * 4 + 3]!;
  }
  return { data, width, height };
}

/** Обрізає доповнення після збільшення. */
export function cropPadding(
  img: RasterImage, targetW: number, targetH: number,
): RasterImage {
  if (img.width === targetW && img.height === targetH) return img;
  const data = new Uint8ClampedArray(targetW * targetH * 4);
  for (let y = 0; y < targetH; y++) {
    const from = y * img.width * 4;
    data.set(img.data.subarray(from, from + targetW * 4), y * targetW * 4);
  }
  return { data, width: targetW, height: targetH };
}
