# obrobka

Image processing that runs entirely in your browser — convert, resize, remove
backgrounds. Files never leave the device.

**[obrobka.dobrovolskyi.com.ua](https://obrobka.dobrovolskyi.com.ua)**

Ukrainian-first, English second. MIT licensed.

---

## What it does

| | |
|---|---|
| **Convert** | PNG · JPEG · WebP · AVIF out; HEIC also reads in |
| **Fit to exact size** | five modes — contain, cover, fill, inside, outside |
| **Remove background** | three model tiers, from 4.4 MB to 84 MB |
| **Outline** | coloured stroke around the subject, canvas grows to fit |
| **Subject-aware crop** | frames the subject, not the centre |
| **Upscale** | Swin2SR ×2 or ×4, tiled so memory stays flat |
| **Brush** | paint to erase, or paint back what the model ate; no model, no download |
| **Layers** | images composited on top — logo, sticker, watermark; move, scale, rotate, blend |
| **Framing by hand** | drag the image to move the crop, wheel or pinch to zoom |
| **Batch** | many files at once, out as a ZIP |
| **Metadata** | see what the file records; the result carries none of it |
| **Offline** | a service worker stores the shell; codecs are cached on first use |

Everything runs as WebAssembly in a Web Worker. There is no server, no upload,
and no account.

## Why it might interest you

**The same core powers a browser app and an MCP server.** `packages/core` has
zero DOM and zero Node API — it is pure functions over RGBA buffers, with all
I/O behind ports. One `runJob()` serves both a browser tab and an AI agent.

```bash
npx obrobka-mcp
```

Gives an agent nine tools — `convert_image`, `resize_image`,
`remove_background`, `smart_crop`, `upscale_image`, `composite_images`,
`read_metadata`, `strip_metadata` and `process_batch` — operating on file paths
rather than base64 blobs.

**Model choice is backed by measurements, not model cards.** Every candidate
was downloaded and profiled before being picked — see
[the M2 plan](docs/superpowers/plans/2026-08-19-obrobka-m2.md) for the numbers.
Two findings changed the design:

- MODNet and ormbg are trained on humans only. On a non-human subject they
  return an empty mask, which rules them out as a general default.
- BiRefNet_lite was killed by the OOM killer at 1024×1024 with 4.2 GB free.
  A browser tab has a lower ceiling still, so it was dropped.

U²-Netp turned out to be general-purpose at 4.4 MB, making the default tier
ten times lighter than originally planned.

**Your phone photos were coming out sideways, and nothing said so.** JPEG and
HEIC store orientation as a tag, not in the pixels. `@jsquash/jpeg` ignores it;
the browser's `<img>` applies it. So the "before" preview looked upright and
the result came out on its side — measured on a purpose-built 8×4 JPEG carrying
`Orientation: 6`, which decoded to 8×4 with or without the tag. The pipeline
now reads the tag and rotates first, before any op that reasons about
coordinates.

**Batch concurrency has two different right answers.** Without a model, four
workers take 20 files from 3639 ms to 1186 ms — 3.1× for 223 MB. With a model
the same pool is a trap: ONNX Runtime already parallelises inside a session, so
four U²-Netp sessions buy 1.8× for 1.2 GB, and two isnet sessions reach 2.2 GB,
past what a tab can hold. So the pool is `needsModel ? 1 : min(cores − 1, 4)`.

**ZIP compression depends on the format, and not the way you would guess.**
Deflating WebP saves 0.1 % for ten times the CPU — as expected. Deflating our
PNGs saves **15.2 %**, because the encoder compresses fast and leaves
redundancy behind. Level 4 for PNG, store for everything else.

**The landing pages carry measured numbers, which is the only reason they
deserve to exist.** Eighty-odd pages produced by substituting a format name
into one template is the definition of doorway spam. So every format-pair page
states what that pair actually costs, from a corpus of ten photographs and
three flat graphics run through our own codecs
([`scripts/measure-formats.mjs`](scripts/measure-formats.mjs)):

| | photo | flat graphics | % of JPEG (photo) |
|---|---|---|---|
| PNG | 1489 kB | 26 kB | 1314 % |
| JPEG | 113 kB | 9 kB | 100 % |
| WebP | 85 kB | 3 kB | 75 % |
| AVIF | 45 kB | 1 kB | 40 % |

That measurement also refuted an assumption of mine. I expected JPEG to wreck
hard edges on flat graphics; at quality 80 it turned out to be the *most*
faithful of the three lossy formats — peak channel deviation 56 and 0.07 % of
pixels visibly off, against WebP's 69 / 0.41 % and AVIF's 112 / 0.43 % — while
still being three times heavier than WebP. So the pages say "for diagrams and
screenshots, PNG is safer" rather than "just use WebP".

## Architecture

```
packages/core             pure ops over RGBA buffers — no DOM, no Node
  ops/                    resample · crop · fit · mask · outline · smartCrop · composite
  ports/                  Codec · Segmenter · Upscaler · Metadata
packages/codecs           jSquash, split into browser and Node adapters
packages/models           model registry and three preprocessing recipes
packages/onnx-node        onnxruntime-node + on-disk cache
packages/onnx-web         onnxruntime-web + Cache Storage, WebGPU → WASM
packages/metadata         EXIF reading (exifr) and byte-level stripping
packages/heic             libheif, isolated — LGPL, loaded on demand
apps/web/src/data         the page matrix: format pairs, platform sizes, tasks
packages/contract-tests   one suite, run against both adapters
apps/web                  Astro + Svelte island, PWA
apps/mcp                  stdio MCP server
```

The contract tests are the point of the port boundary: the same suite runs
against `onnxruntime-node` and `onnxruntime-web`, so a divergence between
them shows up immediately rather than in production.

## Models

All permissively licensed — the project takes donations, which makes
non-commercial model licences a bad fit.

| Tier | Model | Size | Licence | Scope |
|---|---|---|---|---|
| Fast (default) | [U²-Netp](https://huggingface.co/BritishWerewolf/U-2-Netp) | 4.4 MB | Apache-2.0 | any subject |
| Portrait | [MODNet](https://huggingface.co/Xenova/modnet) fp16 | 12.4 MB | Apache-2.0 | people only |
| Quality | [isnet-general](https://huggingface.co/imgly/isnet-general-onnx) | 84.1 MB | MIT | any subject |

Models are served from R2 and cached in the browser after first use.

## Development

Requires Node ≥ 22.12 and pnpm 11.

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm --filter @obrobka/web dev
```

`pnpm typecheck` ends with `astro check`, which needs a second TypeScript. The
Astro language server calls a programmatic API that TypeScript 7 — the Go port
this repo builds with — does not ship yet, so `apps/web` keeps a local
TypeScript 6 purely for that step. The root still compiles with 7.

It covers `.astro` and `.ts`. **`.svelte` files stay outside it** — verified by
planting a type error in a component and watching the check pass. `svelte-check`
is the tool for those, but under TypeScript 6 it fails to resolve the runes and
reports 26 errors that are not there, so it is not wired in. Svelte type errors
currently surface only at build time.

Some tests need a real HEIC, which cannot be generated locally — libheif only
reads. The file is fetched once from the HEIF conformance set and cached in
`~/.cache/obrobka/fixtures`, alongside the models. Everything else, including
JPEGs carrying EXIF orientation and GPS, is built byte by byte at test time:
a photo in the repository would be somebody's photo with somebody's coordinates.

End-to-end tests run against a static server that applies the production
`_headers`, because `crossOriginIsolated` cannot be verified otherwise:

```bash
pnpm --filter @obrobka/web build
pnpm exec playwright test
```

## A note on the tests

Segmentation is tested against a procedurally generated shaded sphere, not a
photograph. That proves the pipeline works — preprocessing, inference, mask,
compositing — but says nothing about quality on hair, glass or fur. Judge that
by using the site.

An earlier fixture, a flat circle with a hard edge, turned out to be
out-of-distribution for these models: the same shape scored 0.97 or 0.03
depending only on whether it had been upscaled. Worth knowing if you write
tests against segmentation models.

## Licence

MIT. Model weights carry their own licences, listed above.
