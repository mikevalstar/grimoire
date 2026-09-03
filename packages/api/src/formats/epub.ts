import type { UploadedBook } from "@grimoire/core";
import { XMLParser } from "fast-xml-parser";
import { unzipSync } from "fflate";
import { type BookFormat, type ExtractedBook, UnreadableFileError } from "./format.ts";

/**
 * EPUB: a zip whose `META-INF/container.xml` names a package document (OPF),
 * whose `<metadata>` is Dublin Core plus whatever the producer added. The
 * parser reads the metadata and the cover and nothing else — the spine is not
 * Grimoire's business (docs/features/uploading-a-book.md).
 *
 * Both EPUB 2 (attributes: `opf:role`, `opf:scheme`, `<meta name=… content=…>`)
 * and EPUB 3 (`<meta property=… refines=…>`) shapes are read, and Calibre's
 * own `calibre:series` metas are honoured, because most EPUBs a Calibre user
 * uploads were once exported by Calibre.
 */

/** A parsed element: text, or text plus attributes. `#text` may be missing. */
type Node = string | { "#text"?: string; [attribute: `@_${string}`]: string | undefined };

/** The metadata block, every child a list, so a single `dc:title` and three read alike. */
interface Metadata {
  title?: Node[];
  creator?: Node[];
  subject?: Node[];
  publisher?: Node[];
  language?: Node[];
  identifier?: Node[];
  description?: Node[];
  date?: Node[];
  meta?: Node[];
}

interface ManifestItem {
  "@_id"?: string;
  "@_href"?: string;
  "@_media-type"?: string;
  "@_properties"?: string;
}

interface Package {
  package?: {
    metadata?: Metadata;
    manifest?: { item?: ManifestItem[] };
  };
}

const LIST_ELEMENTS = new Set([
  "title",
  "creator",
  "subject",
  "publisher",
  "language",
  "identifier",
  "description",
  "date",
  "meta",
  "item",
  "rootfile",
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // `dc:title` and `opf:role` become `title` and `@_role`, whichever prefix
  // the producer bound them to — EPUBs disagree about the prefix constantly.
  removeNSPrefix: true,
  isArray: (name) => LIST_ELEMENTS.has(name),
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  htmlEntities: true,
});

function text(node: Node | undefined): string {
  if (node === undefined) return "";
  return (typeof node === "string" ? node : (node["#text"] ?? "")).trim();
}

function attribute(node: Node | undefined, name: string): string | undefined {
  if (node === undefined || typeof node === "string") return undefined;
  return node[`@_${name}`];
}

/** The EPUB 2 `<meta name="x" content="y">` value, if the package carries one. */
function namedMeta(metadata: Metadata, name: string): string | undefined {
  for (const meta of metadata.meta ?? []) {
    if (attribute(meta, "name") === name) return attribute(meta, "content")?.trim() || undefined;
  }
  return undefined;
}

/** The EPUB 3 `<meta property="x">value</meta>` value — first one, unrefined. */
function propertyMeta(metadata: Metadata, property: string): string | undefined {
  for (const meta of metadata.meta ?? []) {
    if (attribute(meta, "property") === property && !attribute(meta, "refines")) {
      return text(meta) || undefined;
    }
  }
  return undefined;
}

/** The EPUB 3 refinement of one element: `<meta refines="#id" property="x">`. */
function refinement(
  metadata: Metadata,
  id: string | undefined,
  property: string,
): string | undefined {
  if (!id) return undefined;
  for (const meta of metadata.meta ?? []) {
    if (attribute(meta, "refines") === `#${id}` && attribute(meta, "property") === property) {
      return text(meta) || undefined;
    }
  }
  return undefined;
}

/**
 * The authors: every creator whose role is unstated or `aut`. Editors,
 * illustrators and narrators are real people but not who the shelf files a
 * book under. Sort forms come from `opf:file-as` (EPUB 2) or a `file-as`
 * refinement (EPUB 3), joined the way Calibre joins them.
 */
function authors(metadata: Metadata): { authors: string[]; authorSort: string | null } {
  const names: string[] = [];
  const sorts: string[] = [];
  for (const creator of metadata.creator ?? []) {
    const role =
      attribute(creator, "role") ?? refinement(metadata, attribute(creator, "id"), "role");
    if (role && role !== "aut") continue;
    const name = text(creator);
    if (!name) continue;
    names.push(name);
    const sort =
      attribute(creator, "file-as") ?? refinement(metadata, attribute(creator, "id"), "file-as");
    if (sort) sorts.push(sort);
  }
  return {
    authors: names,
    authorSort: sorts.length === names.length && sorts.length > 0 ? sorts.join(" & ") : null,
  };
}

function series(metadata: Metadata): { series: string | null; seriesIndex: number | null } {
  const calibreSeries = namedMeta(metadata, "calibre:series");
  if (calibreSeries) {
    const index = Number(namedMeta(metadata, "calibre:series_index"));
    return { series: calibreSeries, seriesIndex: Number.isFinite(index) ? index : null };
  }

  // EPUB 3: a collection refined as a series, with the book's position in it.
  for (const meta of metadata.meta ?? []) {
    if (attribute(meta, "property") !== "belongs-to-collection") continue;
    const id = attribute(meta, "id");
    const type = refinement(metadata, id, "collection-type");
    if (type && type !== "series") continue;
    const position = Number(refinement(metadata, id, "group-position"));
    return { series: text(meta) || null, seriesIndex: Number.isFinite(position) ? position : null };
  }
  return { series: null, seriesIndex: null };
}

const ISBN = /^(?:97[89])?\d{9}[\dXx]$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Identifiers as Calibre keys them: `isbn`, `uuid`, `calibre`, or the scheme
 * the file named, lowercased. A scheme-less `urn:isbn:` prefix counts, and so
 * does a bare number that is shaped like an ISBN, since publishers put their
 * ISBN in `dc:identifier` with nothing to say so more often than not.
 */
function identifiers(metadata: Metadata): Record<string, string> {
  const out: Record<string, string> = {};
  for (const identifier of metadata.identifier ?? []) {
    let value = text(identifier);
    if (!value) continue;
    let scheme = (
      attribute(identifier, "scheme") ??
      refinement(metadata, attribute(identifier, "id"), "identifier-type") ??
      ""
    ).toLowerCase();

    const urn = /^urn:([a-z0-9]+):(.+)$/i.exec(value);
    if (urn?.[1] && urn[2]) {
      scheme = urn[1].toLowerCase();
      value = urn[2];
    }
    const compact = value.replace(/-/g, "");
    if (!scheme || scheme === "15")
      scheme = ISBN.test(compact) ? "isbn" : UUID.test(value) ? "uuid" : "";
    if (!scheme) continue;
    if (scheme === "isbn") value = compact;
    // First one wins: the primary identifier is listed first by convention.
    out[scheme] ??= value;
  }
  return out;
}

/** `dc:date` — the publication date when events are named, else the first. */
function published(metadata: Metadata): string | null {
  const dates = metadata.date ?? [];
  const publication =
    dates.find((date) => attribute(date, "event") === "publication") ??
    dates.find((date) => !attribute(date, "event")) ??
    dates[0];
  const value = text(publication) || propertyMeta(metadata, "dcterms:date") || "";
  return value ? normaliseDate(value) : null;
}

/** ISO 8601 as far as the value goes: "2018" stays a year, a timestamp loses its time. */
function normaliseDate(value: string): string | null {
  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(value);
  if (!match) return null;
  return [match[1], match[2], match[3]].filter(Boolean).join("-");
}

/** Subjects as tags: one per element, or several when a publisher listed them with semicolons. */
function tags(metadata: Metadata): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const subject of metadata.subject ?? []) {
    for (const raw of text(subject).split(";")) {
      const tag = raw.trim();
      const key = tag.toLowerCase();
      if (!tag || seen.has(key)) continue;
      seen.add(key);
      out.push(tag);
    }
  }
  return out;
}

/**
 * The manifest entry that is the cover image: EPUB 3's `cover-image`
 * property, else EPUB 2's `<meta name="cover">` pointing at an item id (or,
 * from some producers, straight at an href), else an image item id'd `cover`.
 */
function coverHref(metadata: Metadata, items: ManifestItem[]): string | null {
  const byProperty = items.find((item) =>
    (item["@_properties"] ?? "").split(/\s+/).includes("cover-image"),
  );
  if (byProperty?.["@_href"]) return byProperty["@_href"];

  const named = namedMeta(metadata, "cover");
  if (named) {
    const byId = items.find((item) => item["@_id"] === named);
    if (byId?.["@_href"]) return byId["@_href"];
    const byHref = items.find((item) => item["@_href"] === named);
    if (byHref?.["@_href"]) return byHref["@_href"];
  }

  const byName = items.find(
    (item) => item["@_id"]?.toLowerCase() === "cover" && item["@_media-type"]?.startsWith("image/"),
  );
  return byName?.["@_href"] ?? null;
}

/** A manifest href, relative to the package document, as a zip entry name. */
function resolveEntry(opfPath: string, href: string): string {
  const base = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
  const parts: string[] = [];
  for (const segment of `${base}${decodeURIComponent(href.split("#")[0] ?? "")}`.split("/")) {
    if (segment === "..") parts.pop();
    else if (segment && segment !== ".") parts.push(segment);
  }
  return parts.join("/");
}

const decoder = new TextDecoder();

function extract(bytes: Uint8Array, fallbackTitle: string): ExtractedBook {
  let container: Record<string, Uint8Array>;
  try {
    container = unzipSync(bytes, { filter: (file) => file.name === "META-INF/container.xml" });
  } catch {
    throw new UnreadableFileError("This file is not a zip archive, so it cannot be an EPUB.");
  }
  const containerXml = container["META-INF/container.xml"];
  if (!containerXml) {
    throw new UnreadableFileError("This EPUB has no META-INF/container.xml.");
  }

  const rootfiles = parser.parse(decoder.decode(containerXml)) as {
    container?: { rootfiles?: { rootfile?: { "@_full-path"?: string }[] } };
  };
  const opfPath = rootfiles.container?.rootfiles?.rootfile?.[0]?.["@_full-path"];
  if (!opfPath) throw new UnreadableFileError("This EPUB's container names no package document.");

  const opfEntry = unzipSync(bytes, { filter: (file) => file.name === opfPath })[opfPath];
  if (!opfEntry) {
    throw new UnreadableFileError(`This EPUB's package document (${opfPath}) is missing.`);
  }

  const pkg = parser.parse(decoder.decode(opfEntry)) as Package;
  const metadata = pkg.package?.metadata ?? {};
  const items = pkg.package?.manifest?.item ?? [];

  const { authors: names, authorSort } = authors(metadata);
  const book: UploadedBook = {
    title: text(metadata.title?.[0]) || fallbackTitle,
    titleSort: namedMeta(metadata, "calibre:title_sort") ?? null,
    authors: names,
    authorSort,
    ...series(metadata),
    tags: tags(metadata),
    publisher: text(metadata.publisher?.[0]) || propertyMeta(metadata, "dcterms:publisher") || null,
    languages: (metadata.language ?? []).map(text).filter(Boolean),
    identifiers: identifiers(metadata),
    description: text(metadata.description?.[0]) || null,
    published: published(metadata),
  };

  let cover: Uint8Array | null = null;
  const href = coverHref(metadata, items);
  if (href) {
    const entry = resolveEntry(opfPath, href);
    cover = unzipSync(bytes, { filter: (file) => file.name === entry })[entry] ?? null;
  }

  return { book, cover };
}

export const EPUB: BookFormat = {
  format: "EPUB",
  // "PK\x03\x04": a zip's local file header. The mimetype entry is meant to
  // follow, uncompressed, but enough real EPUBs get that wrong that the
  // container is the test that matters, and `extract` makes it.
  sniff: (bytes) => bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3,
  extract,
};
