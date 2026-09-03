import { expect, test } from "bun:test";
import { dedupeTags } from "./hardcover-books.ts";

test("dedupeTags drops repeats across categories, ignoring case, and strips a category prefix", () => {
  expect(
    dedupeTags([
      "Action & Adventure",
      "Fantasy",
      "action & adventure",
      "Genre: LitRPG-Comedy",
      "  ",
      "litrpg-comedy",
      "Tag: Audible",
    ]),
  ).toEqual(["Action & Adventure", "Fantasy", "LitRPG-Comedy", "Audible"]);
});
