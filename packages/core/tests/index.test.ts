import { expect, test } from "vite-plus/test";
import { getVersion, VERSION } from "../src/index.ts";

test("VERSION is defined", () => {
  expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
});

test("getVersion returns version string", () => {
  expect(getVersion()).toBe(VERSION);
});
