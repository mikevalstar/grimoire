import { expect, test } from "bun:test";
import { cleanAuthors } from "./books.ts";

test("cleanAuthors trims the separator a hand-edited Calibre field leaves behind", () => {
  expect(cleanAuthors(["Peter F. Hamilton;", "Ann Leckie, ", "Terry Miles &", "", "  ;"])).toEqual([
    "Peter F. Hamilton",
    "Ann Leckie",
    "Terry Miles",
  ]);
});
