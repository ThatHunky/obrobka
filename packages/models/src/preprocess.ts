import { resample, type RasterImage } from '@obrobka/core';
import { inputSizeFor, type ModelDescriptor, type Normalization } from './registry.js';

const IMAGENET_MEAN = [0.485, 0.456, 0.406] as const;
const IMAGENET_STD = [0.229, 0.224, 0.225] as const;

export interface Tensor {
  readonly data: Float32Array;
  readonly width: number;
  readonly height: number;
}

function meanStd(n: Normalization, channel: number): readonly [number, number] {
  switch (n.kind) {
    case 'imagenet': return [IMAGENET_MEAN[channel]!, IMAGENET_STD[channel]!];
    case 'symmetric': return [0.5, 0.5];
    case 'none': return [0, 1];
  }
}

/**
 * RasterImage → тензор CHW для ONNX.
 *
 * Три моделі — три різні рецепти, і сплутати їх легко: результат буде
 * не помилкою, а тихо зіпсованою маскою. Тому рецепт живе в дескрипторі
 * поруч із моделлю, а не в коді виклику.
 */
export function preprocess(img: RasterImage, d: ModelDescriptor): Tensor {
  const { width, height } = inputSizeFor(d, img.width, img.height);
  const scaled = resample(img, width, height);

  const plane = width * height;
  const data = new Float32Array(plane * 3);
  for (let c = 0; c < 3; c++) {
    const [mean, std] = meanStd(d.normalization, c);
    for (let i = 0; i < plane; i++) {
      data[c * plane + i] = (scaled.data[i * 4 + c]! / 255 - mean) / std;
    }
  }
  return { data, width, height };
}
