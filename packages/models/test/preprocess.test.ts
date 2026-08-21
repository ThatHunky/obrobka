import { describe, it, expect } from 'vitest';
import { MODELS, modelById, inputSizeFor } from '../src/registry.js';
import { preprocess } from '../src/preprocess.js';
import { postprocess } from '../src/postprocess.js';
import type { RasterImage } from '@obrobka/core';

function solid(width: number, height: number, v: number): RasterImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
  }
  return { data, width, height };
}

describe('registry', () => {
  it('містить три рівні', () => {
    expect(MODELS.map((m) => m.id)).toEqual(['fast', 'portrait', 'quality']);
  });

  it('усі ліцензії дозвільні', () => {
    for (const m of MODELS) expect(['MIT', 'Apache-2.0']).toContain(m.license);
  });

  it('фіксований розмір не залежить від зображення', () => {
    expect(inputSizeFor(modelById('fast'), 4000, 300)).toEqual({ width: 320, height: 320 });
  });

  it('MODNet отримує коротшу сторону 512, кратно 32', () => {
    const s = inputSizeFor(modelById('portrait'), 1000, 500);
    expect(s.height).toBe(512);
    expect(s.width % 32).toBe(0);
    expect(s.width).toBeGreaterThan(s.height);
  });
});

describe('preprocess', () => {
  it('дає CHW потрібної довжини', () => {
    const t = preprocess(solid(64, 64, 128), modelById('fast'));
    expect(t.data.length).toBe(3 * 320 * 320);
    expect(t.width).toBe(320);
    expect(t.height).toBe(320);
  });

  it('ImageNet-нормалізація застосовується по каналах', () => {
    const t = preprocess(solid(8, 8, 128), modelById('fast'));
    const plane = 320 * 320;
    const r = t.data[0]!;
    const g = t.data[plane]!;
    expect(r).toBeCloseTo((128 / 255 - 0.485) / 0.229, 2);
    expect(g).toBeCloseTo((128 / 255 - 0.456) / 0.224, 2);
    expect(r).not.toBeCloseTo(g, 3);
  });

  it('симетрична нормалізація дає діапазон [-1, 1]', () => {
    expect(preprocess(solid(64, 64, 255), modelById('portrait')).data[0]).toBeCloseTo(1, 3);
    expect(preprocess(solid(64, 64, 0), modelById('portrait')).data[0]).toBeCloseTo(-1, 3);
  });

  it('DIS-нормалізація зсуває на 0.5 без ділення', () => {
    // Саме цей рецепт потрібен isnet: з ImageNet він знаходив 0 % суб'єкта
    // на реальних фото, хоча на синтетичному тесті виглядав справним.
    const white = preprocess(solid(64, 64, 255), modelById('quality')).data[0]!;
    const black = preprocess(solid(64, 64, 0), modelById('quality')).data[0]!;
    expect(white).toBeCloseTo(0.5, 3);
    expect(black).toBeCloseTo(-0.5, 3);
  });

  it('портретна модель — fp16, а не uint8', () => {
    // uint8-квантування нищить півтони альфи, від яких залежить matting
    expect(modelById('portrait').file).toBe('modnet-fp16.onnx');
  });
});

describe('postprocess', () => {
  it('перетворює вихід [0,1] на маску 0..255', () => {
    const raw = new Float32Array(4).fill(0.5);
    raw[0] = 1;
    const m = postprocess(raw, 2, 2);
    expect(m.width).toBe(2);
    expect(m.data[0]).toBe(255);
    expect(m.data[1]).toBe(128);
  });
});
