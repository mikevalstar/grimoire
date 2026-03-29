import { expect, test } from "vite-plus/test";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const cli = resolve(import.meta.dirname, "../dist/index.mjs");

test("--version prints version", () => {
  const output = execFileSync("node", [cli, "--version"], {
    encoding: "utf-8",
  }).trim();
  expect(output).toMatch(/^\d+\.\d+\.\d+$/);
});

test("--help includes description", () => {
  const output = execFileSync("node", [cli, "--help"], {
    encoding: "utf-8",
  });
  expect(output).toContain("Grimoire AI");
});

test("init command outputs JSON", () => {
  const output = execFileSync("node", [cli, "init"], {
    encoding: "utf-8",
  }).trim();
  const parsed = JSON.parse(output);
  expect(parsed).toHaveProperty("message");
});
