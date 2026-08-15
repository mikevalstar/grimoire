/// <reference path="./assets.d.ts" />
import { join } from "node:path";
import { COVER_SIZE_NAMES, COVER_SIZES, type CoverStore } from "@grimoire/core";
// The wasm as a *bundled asset* rather than something the codec finds itself:
// its own resolution works unbundled and breaks in the desktop build
// ([ADR 0017](../../../docs/adrs/0017-decode-webp-covers-with-a-wasm-codec.md)).
import webpWasm from "@jsquash/webp/codec/dec/webp_dec.wasm" with { type: "file" };
import decodeWebp, { init as initWebp } from "@jsquash/webp/decode.js";
import { Jimp } from "jimp";

/**
 * Caching a cover that a source hands over as a URL rather than a scaler.
 *
 * Calibre resizes on request, so its covers arrive at the size asked for
 * ([ADR 0011](../../../docs/adrs/0011-sync-calibre-into-grimoire-db-and-read-the-library-from-there.md)).
 * Hardcover gives one image on its CDN and no way to ask for a smaller one, so
 * Grimoire scales it here — which is what lets a Hardcover book's cover work
 * with the network off, like every other cover in the library.
 *
 * The resizer is **pure JavaScript on purpose**. The fast ones are native
 * modules, and a native module is a binary per platform that the Electrobun
 * bundle does not carry — which would make covers work in the server and in
 * `bun dev` and break the desktop app outright, exactly the asymmetry
 * [ADR 0002](../../../docs/adrs/0002-one-http-api-three-delivery-targets.md)
 * exists to prevent. A few hundred milliseconds a book, once, in a background
 * sync, is the right thing to spend to keep all three targets identical.
 *
 * See docs/features/hardcover-sync.md.
 */

const REQUEST_TIMEOUT_MS = 20_000;

/** A cover is a JPEG of a few hundred kilobytes. Anything far past that isn't one. */
const MAX_BYTES = 12 * 1024 * 1024;

/** Downloaded covers in flight at once — someone else's CDN, so be a good guest. */
export const REMOTE_COVER_CONCURRENCY = 4;

/** The RIFF….WEBP header, which is the only reliable way to know: the CDN's headers lie. */
function isWebp(bytes: Uint8Array): boolean {
  return (
    bytes.length > 12 &&
    // "RIFF"
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    // "WEBP"
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

/**
 * Where that asset actually is. Unbundled the import is already an absolute
 * path; bundled it is `./<name>-<hash>.wasm`, which is relative to the *bundle*
 * and not to whatever directory the app was launched from — so it is joined to
 * this module's own, which is the bundle's when there is one.
 */
const WEBP_WASM_PATH = webpWasm.startsWith(".") ? join(import.meta.dir, webpWasm) : webpWasm;

/** Compiled once, on the first WebP the process meets — a library with none never pays. */
let webpReady: Promise<void> | null = null;

/**
 * A decoded image, as Jimp's own reader hands one over. Named off `read` rather
 * than spelled `JimpInstance`: the class and its reader disagree about the type
 * by a hair, and the reader is the one both branches below have to satisfy.
 */
type DecodedImage = Awaited<ReturnType<typeof Jimp.read>>;

/**
 * One downloaded image as something Jimp can scale, whatever it arrived as.
 *
 * WebP is decoded by the wasm codec and rebuilt as a bitmap, because Jimp reads
 * every common format *except* that one — and hardcover.app serves some covers
 * as WebP under a `.jpg` name and an `image/jpeg` header, so the bytes are the
 * only honest test
 * ([ADR 0017](../../../docs/adrs/0017-decode-webp-covers-with-a-wasm-codec.md)).
 */
async function decode(bytes: ArrayBuffer): Promise<DecodedImage> {
  if (!isWebp(new Uint8Array(bytes))) return Jimp.read(Buffer.from(bytes));

  webpReady ??= Bun.file(WEBP_WASM_PATH)
    .arrayBuffer()
    .then((wasm) => WebAssembly.compile(wasm))
    .then((module) => initWebp(module));
  await webpReady;

  // RGBA, which is Jimp's own bitmap layout — so this is a wrap, not a convert.
  const image = await decodeWebp(bytes);
  return Jimp.fromBitmap({
    width: image.width,
    height: image.height,
    data: Buffer.from(image.data.buffer),
  });
}

/**
 * Fetch one image and write every cached size from it. All or nothing: a book
 * with two of three sizes on disk would be a cache that lies, so a failure at
 * any point leaves the book marked missing and nothing half-written.
 *
 * Never upscales. A source's image smaller than a size we cache is written at
 * its own size rather than blown up — the img tag scales it either way, and
 * inventing pixels only costs disk.
 */
export async function cacheRemoteCover(
  covers: CoverStore,
  bookId: number,
  url: string,
): Promise<boolean> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch {
    return false;
  }
  if (!res.ok) return false;

  // A CDN answering with an HTML error page is a 200 with the wrong body; sharp
  // would reject it anyway, but saying so here keeps the failure legible.
  const type = res.headers.get("content-type");
  if (type && !type.startsWith("image/")) return false;

  const bytes = await res.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return false;

  try {
    // Decoded once and cloned per size: decoding is most of the cost, and
    // there are three sizes to make from it.
    const source = await decode(bytes);

    for (const size of COVER_SIZE_NAMES) {
      const { width, height } = COVER_SIZES[size];
      const image = source.clone();
      // Never upscale: an image already smaller than the slot is written as it
      // is. The browser scales it either way, and inventing pixels costs disk.
      if (image.width > width || image.height > height) image.cover({ w: width, h: height });
      await covers.write(bookId, size, await image.getBuffer("image/jpeg", { quality: 82 }));
    }
  } catch {
    // Not an image, a truncated download, or a format the decoder can't read.
    return false;
  }

  return true;
}
