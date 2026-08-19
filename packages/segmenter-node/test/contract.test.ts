import { testSegmenterContract } from '@obrobka/contract-tests';
import { createSegmenter } from '../src/index.js';

testSegmenterContract('node', [
  { label: 'fast / U²-Netp', make: () => createSegmenter('fast'), general: true },
  { label: 'portrait / MODNet', make: () => createSegmenter('portrait'), general: false },
  { label: 'quality / isnet-general', make: () => createSegmenter('quality'), general: true },
]);
