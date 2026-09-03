import { describe, expect, test } from "bun:test";
import { zipSync } from "fflate";
import { EPUB } from "./epub.ts";
import { UnreadableFileError } from "./format.ts";

const encoder = new TextEncoder();

/** A minimal EPUB: mimetype, container, one package document, and whatever else is given. */
function epub(opf: string, extra: Record<string, Uint8Array> = {}): Uint8Array {
  return zipSync({
    mimetype: [encoder.encode("application/epub+zip"), { level: 0 }],
    "META-INF/container.xml": encoder.encode(
      `<?xml version="1.0"?>
       <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
         <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
       </container>`,
    ),
    "OEBPS/content.opf": encoder.encode(opf),
    ...extra,
  });
}

const COVER = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

describe("EPUB 2 package documents", () => {
  const bytes = epub(
    `<?xml version="1.0"?>
     <package xmlns="http://www.idpf.org/2007/opf" unique-identifier="id" version="2.0">
       <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
         <dc:title>The Left Hand of Darkness</dc:title>
         <dc:creator opf:role="aut" opf:file-as="Le Guin, Ursula K.">Ursula K. Le Guin</dc:creator>
         <dc:creator opf:role="ill">Somebody Else</dc:creator>
         <dc:publisher>Ace</dc:publisher>
         <dc:date>1969-03-01T00:00:00+00:00</dc:date>
         <dc:language>en</dc:language>
         <dc:subject>Science Fiction</dc:subject>
         <dc:subject>Hainish; Classics</dc:subject>
         <dc:identifier id="id" opf:scheme="calibre">c4f9d8b2-0c99-4ad2-9c99-6da00d0058f3</dc:identifier>
         <dc:identifier opf:scheme="ISBN">0-441-47812-3</dc:identifier>
         <dc:description>&lt;p&gt;Winter is coming.&lt;/p&gt;</dc:description>
         <meta name="cover" content="cover-img"/>
         <meta name="calibre:series" content="Hainish Cycle"/>
         <meta name="calibre:series_index" content="4"/>
         <meta name="calibre:title_sort" content="Left Hand of Darkness, The"/>
       </metadata>
       <manifest>
         <item id="cover-img" href="images/cover.jpg" media-type="image/jpeg"/>
         <item id="text" href="text.xhtml" media-type="application/xhtml+xml"/>
       </manifest>
     </package>`,
    { "OEBPS/images/cover.jpg": COVER },
  );

  test("reads Dublin Core, Calibre's metas and the named cover", () => {
    const { book, cover } = EPUB.extract(bytes, "fallback");
    expect(book).toEqual({
      title: "The Left Hand of Darkness",
      titleSort: "Left Hand of Darkness, The",
      authors: ["Ursula K. Le Guin"],
      authorSort: "Le Guin, Ursula K.",
      series: "Hainish Cycle",
      seriesIndex: 4,
      tags: ["Science Fiction", "Hainish", "Classics"],
      publisher: "Ace",
      languages: ["en"],
      identifiers: { calibre: "c4f9d8b2-0c99-4ad2-9c99-6da00d0058f3", isbn: "0441478123" },
      description: "<p>Winter is coming.</p>",
      published: "1969-03-01",
    });
    expect(cover).toEqual(COVER);
  });

  test("sniffs the zip header and nothing more", () => {
    expect(EPUB.sniff(bytes)).toBe(true);
    expect(EPUB.sniff(encoder.encode("%PDF-1.7 not a zip"))).toBe(false);
  });
});

describe("EPUB 3 package documents", () => {
  const bytes = epub(
    `<?xml version="1.0"?>
     <package xmlns="http://www.idpf.org/2007/opf" unique-identifier="pub-id" version="3.0">
       <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
         <dc:title id="t1">Are Filter Bubbles Real?</dc:title>
         <dc:creator id="creator">Axel Bruns</dc:creator>
         <meta property="role" refines="#creator" scheme="marc:relators">aut</meta>
         <meta property="file-as" refines="#creator">Bruns, Axel</meta>
         <meta property="dcterms:publisher">Polity Press</meta>
         <meta property="dcterms:date">2019</meta>
         <dc:identifier id="pub-id">urn:isbn:9781509536467</dc:identifier>
         <meta id="c1" property="belongs-to-collection">Digital Futures</meta>
         <meta refines="#c1" property="collection-type">series</meta>
         <meta refines="#c1" property="group-position">3</meta>
       </metadata>
       <manifest>
         <item id="ci" href="cover.png" media-type="image/png" properties="cover-image"/>
       </manifest>
     </package>`,
    { "OEBPS/cover.png": COVER },
  );

  test("reads refinements, dcterms metas, a urn identifier and the cover-image property", () => {
    const { book, cover } = EPUB.extract(bytes, "fallback");
    expect(book.title).toBe("Are Filter Bubbles Real?");
    expect(book.authors).toEqual(["Axel Bruns"]);
    expect(book.authorSort).toBe("Bruns, Axel");
    expect(book.publisher).toBe("Polity Press");
    expect(book.published).toBe("2019");
    expect(book.identifiers).toEqual({ isbn: "9781509536467" });
    expect(book.series).toBe("Digital Futures");
    expect(book.seriesIndex).toBe(3);
    expect(cover).toEqual(COVER);
  });
});

describe("files that cannot be read", () => {
  test("a package with no title lands under the fallback", () => {
    const bytes = epub(
      `<package xmlns="http://www.idpf.org/2007/opf" version="2.0"><metadata/><manifest/></package>`,
    );
    const { book, cover } = EPUB.extract(bytes, "My Book");
    expect(book.title).toBe("My Book");
    expect(book.authors).toEqual([]);
    expect(cover).toBeNull();
  });

  test("a zip with no container is refused with a reason", () => {
    const bytes = zipSync({ "readme.txt": encoder.encode("hello") });
    expect(() => EPUB.extract(bytes, "x")).toThrow(UnreadableFileError);
  });

  test("bytes that are not a zip are refused with a reason", () => {
    expect(() => EPUB.extract(encoder.encode("PK\x03\x04garbage"), "x")).toThrow(
      UnreadableFileError,
    );
  });
});
