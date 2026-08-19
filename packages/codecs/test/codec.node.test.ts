import { testCodecContract } from '@obrobka/contract-tests';
import { nodeCodec } from '../src/node.js';

testCodecContract('jsquash / node', nodeCodec);
