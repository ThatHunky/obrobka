import { describe, it, expect } from 'vitest';
import { solidImage, checkerImage, pixelAt } from './helpers.js';

describe('helpers', () => {
  it('solidImage залиає все зображення одним кольором', () => {
    const img = solidImage(3, 2, { r: 10, g: 20, b: 30, a: 40 });
    expect(img.width).toBe(3);
    expect(img.height).toBe(2);
    expect(img.data.length).toBe(3 * 2 * 4);
    expect(pixelAt(img, 2, 1)).toEqual({ r: 10, g: 20, b: 30, a: 40 });
  });

  it('checkerImage чергує кольори по клітинках', () => {
    const a = { r: 0, g: 0, b: 0, a: 255 };
    const b = { r: 255, g: 255, b: 255, a: 255 };
    const img = checkerImage(4, 4, 2, a, b);
    expect(pixelAt(img, 0, 0)).toEqual(a);
    expect(pixelAt(img, 2, 0)).toEqual(b);
    expect(pixelAt(img, 0, 2)).toEqual(b);
    expect(pixelAt(img, 2, 2)).toEqual(a);
  });

  it('pixelAt кидає помилку поза межами', () => {
    const img = solidImage(2, 2, { r: 1, g: 1, b: 1, a: 1 });
    expect(() => pixelAt(img, 2, 0)).toThrow(/поза межами/);
  });

  it('solidImage відхиляє нульовий розмір', () => {
    expect(() => solidImage(0, 5, { r: 0, g: 0, b: 0, a: 0 })).toThrow(RangeError);
  });
});
