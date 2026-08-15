---
type: adr
title: Decode WebP covers with a WASM codec
description: Cache WebP cover images by decoding them with @jsquash/webp's WASM decoder, imported as a bundler asset so the desktop bundle carries it, and scaling the pixels with Jimp as before.
tags: [backend, covers, hardcover, desktop]
status: stable
generated: { by: okq/0.8.0, at: 2026-08-15 }
---

# Decode WebP covers with a WASM codec

## Status

Accepted. Extends the resizer chosen in
[ADR 0002](0002-one-http-api-three-delivery-targets.md)'s shadow and used by
[Hardcover sync](../features/hardcover-sync.md).

## Context

Covers that arrive as a URL rather than from Calibre's scaler are downloaded,
resized to Grimoire's three sizes and written to disk as JPEG
(`packages/api/src/remote-covers.ts`). The resizer is [Jimp](https://jimp-dev.github.io/jimp/),
pure JavaScript on purpose: a native module is a binary per platform that the
Electrobun bundle does not carry, which would make covers work in the server and
in `bun dev` and break the desktop app
([ADR 0002](0002-one-http-api-three-delivery-targets.md)).

Jimp decodes BMP, GIF, JPEG, PNG and TIFF. It does not decode **WebP** — and
hardcover.app's asset host serves some covers as WebP under a `.jpg` name and a
`Content-Type: image/jpeg` header. *Shroud* (edition 31454859) is one: 200, the
right content type, and a `RIFF … WEBP` body. There is no format negotiation on
that host — `?format=`, `?fm=`, `?f=` and an `Accept: image/jpeg` request all
return the same WebP bytes.

Every such book fails to decode, is marked `missing`, and shows a placeholder
forever. It is a minority of the shelf today (one book in 126 here) and will
grow, because WebP is what image pipelines emit now.

## Decision

Decode WebP with **[@jsquash/webp](https://github.com/jamsinclair/jSquash)'s
WASM decoder** and hand the raw pixels to Jimp, which scales and encodes JPEG
exactly as it does for every other format. WebP is tried only when Jimp refuses
the bytes, so the common path is unchanged.

The wasm is imported **as a bundler asset**:

```ts
import wasm from "@jsquash/webp/codec/dec/webp_dec.wasm" with { type: "file" };
```

and the compiled module is handed to the codec's `init()`. This is the part
that matters. Importing `@jsquash/webp/decode.js` and letting it find its own
wasm works in `bun dev` and in the server and **breaks when bundled** — the
Emscripten glue resolves the file relative to itself, and `bun build` does not
copy it. Bundling the asset ourselves keeps all three delivery targets identical,
which is the whole constraint that made the resizer pure JS in the first place.

WASM rather than a native module for the same reason: one artifact, no
per-platform binaries, no postinstall.

Only the **decoder** is taken. Grimoire writes JPEG, so the encoder half of the
package — and `@jimp/wasm-webp`, which registers both and pulls the whole
plugin surface — is not needed.

## Consequences

- Covers whose source hands over WebP now cache like every other cover, and work
  with the network off. The [re-fetch cover action](../features/book-actions.md)
  is the remedy for the books already marked `missing`; a full sync retries them
  too.
- One more dependency and ~138KB of wasm in the bundle, loaded lazily — the
  module is compiled on the first WebP encountered, and a library with none
  never touches it.
- The desktop bundle now has an **asset** next to its entrypoint, where before it
  was one file. Anything that copies the build output has to copy the directory.
- Other formats the sources might serve — AVIF, most likely next — are still
  refused. The path for adding one is now clear, and `@jsquash` has that codec
  too, but it is not worth carrying before something asks for it.
