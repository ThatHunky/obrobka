import * as Comlink from 'comlink';
import { runJob, type Job } from '@obrobka/core';
import { browserCodec } from '@obrobka/codecs/browser';

const ctx = { codec: browserCodec };

const api = {
  async process(bytes: ArrayBuffer, mime: string, job: Job): Promise<ArrayBuffer> {
    const result = await runJob(new Uint8Array(bytes), mime, job, ctx);
    // Копіюємо у власний буфер, щоб віддати його як transferable без копіювання
    const out = new Uint8Array(result.length);
    out.set(result);
    return Comlink.transfer(out.buffer, [out.buffer]);
  },
};

Comlink.expose(api);
