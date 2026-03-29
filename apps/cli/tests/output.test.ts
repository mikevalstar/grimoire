import { expect, test, describe, beforeEach, afterEach, vi } from "vite-plus/test";
import { resolveFormat, setFormat, getFormat, printResult, printError } from "../src/output.ts";

describe("resolveFormat", () => {
  test("returns json when flag is json", () => {
    expect(resolveFormat("json")).toBe("json");
  });

  test("returns cli when flag is cli", () => {
    expect(resolveFormat("cli")).toBe("cli");
  });

  test("returns json when auto and not a TTY", () => {
    const original = process.stdout.isTTY;
    Object.defineProperty(process.stdout, "isTTY", { value: undefined, configurable: true });
    expect(resolveFormat("auto")).toBe("json");
    Object.defineProperty(process.stdout, "isTTY", { value: original, configurable: true });
  });

  test("returns cli when auto and is a TTY", () => {
    const original = process.stdout.isTTY;
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
    expect(resolveFormat("auto")).toBe("cli");
    Object.defineProperty(process.stdout, "isTTY", { value: original, configurable: true });
  });
});

describe("setFormat / getFormat", () => {
  afterEach(() => {
    setFormat("json");
  });

  test("defaults to json", () => {
    setFormat("json");
    expect(getFormat()).toBe("json");
  });

  test("sets to cli", () => {
    setFormat("cli");
    expect(getFormat()).toBe("cli");
  });
});

describe("printResult", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    setFormat("json");
  });

  test("outputs compact JSON in json mode", () => {
    setFormat("json");
    printResult({ foo: "bar", count: 3 });
    expect(logSpy).toHaveBeenCalledWith('{"foo":"bar","count":3}');
  });

  test("uses cli formatter in cli mode", () => {
    setFormat("cli");
    printResult({ name: "test" }, (data) => `Name: ${(data as { name: string }).name}`);
    expect(logSpy).toHaveBeenCalledWith("Name: test");
  });

  test("falls back to JSON in cli mode without formatter", () => {
    setFormat("cli");
    printResult({ foo: "bar" });
    expect(logSpy).toHaveBeenCalledWith('{"foo":"bar"}');
  });
});

describe("printError", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.exitCode = 0;
  });

  afterEach(() => {
    errorSpy.mockRestore();
    process.exitCode = 0;
    setFormat("json");
  });

  test("outputs JSON error to stderr in json mode", () => {
    setFormat("json");
    printError("something broke");
    expect(errorSpy).toHaveBeenCalledWith('{"error":"something broke"}');
    expect(process.exitCode).toBe(1);
  });

  test("includes hint in JSON error", () => {
    setFormat("json");
    printError("missing arg", "Usage: grimoire init --name foo");
    expect(errorSpy).toHaveBeenCalledWith(
      '{"error":"missing arg","hint":"Usage: grimoire init --name foo"}',
    );
  });

  test("outputs plain text in cli mode", () => {
    setFormat("cli");
    printError("something broke");
    expect(errorSpy).toHaveBeenCalledWith("Error: something broke");
  });

  test("includes hint as indented text in cli mode", () => {
    setFormat("cli");
    printError("missing arg", "Usage: grimoire init --name foo");
    expect(errorSpy).toHaveBeenCalledWith("Error: missing arg");
    expect(errorSpy).toHaveBeenCalledWith("  Usage: grimoire init --name foo");
  });
});
