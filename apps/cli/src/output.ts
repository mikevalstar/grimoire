export type OutputFormat = "json" | "cli" | "auto";

export function resolveFormat(flag: OutputFormat): "json" | "cli" {
  if (flag !== "auto") return flag;
  return process.stdout.isTTY ? "cli" : "json";
}

let _format: "json" | "cli" = "json";

export function setFormat(format: OutputFormat): void {
  _format = resolveFormat(format);
}

export function getFormat(): "json" | "cli" {
  return _format;
}

/**
 * Print a success result. In JSON mode, outputs compact JSON.
 * In CLI mode, uses the provided formatter or falls back to pretty JSON.
 */
export function printResult(data: unknown, cliFormatter?: (data: unknown) => string): void {
  if (_format === "cli" && cliFormatter) {
    console.log(cliFormatter(data));
  } else {
    console.log(JSON.stringify(data));
  }
}

/**
 * Print an error. In JSON mode, outputs compact JSON to stderr.
 * In CLI mode, prints a human-readable error message.
 */
export function printError(error: string, hint?: string): void {
  if (_format === "cli") {
    console.error(`Error: ${error}`);
    if (hint) console.error(`  ${hint}`);
  } else {
    console.error(JSON.stringify(hint ? { error, hint } : { error }));
  }
  process.exitCode = 1;
}
