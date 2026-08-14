import { COVER_SIZE_NAMES, COVER_SIZES, type CoverStore } from "@grimoire/core";
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
    const source = await Jimp.read(Buffer.from(bytes));

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
