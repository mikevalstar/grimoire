import { expect, test } from "vite-plus/test";
import { getVersion, VERSION } from "../src/index.ts";

test("VERSION is defined", () => {
  expect(VERSION).toBe("0.1.1");
});

test("getVersion returns version string", () => {
  expect(getVersion()).toBe("0.1.1");
});
