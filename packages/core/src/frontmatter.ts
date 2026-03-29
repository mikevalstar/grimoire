import { parse, read } from "zod-matter";
import { z } from "zod";

export interface ParsedDocument<T> {
  frontmatter: T;
  body: string;
}

/**
 * Parse a markdown string with YAML frontmatter and validate against a Zod schema.
 * Uses gray-matter for frontmatter extraction and Zod for validation + defaults.
 */
export function parseDocument<T extends z.ZodObject<z.ZodRawShape>>(
  content: string,
  schema: T,
): ParsedDocument<z.infer<T>> {
  const result = parse(content, schema);
  return {
    frontmatter: result.data,
    body: result.content,
  };
}

/**
 * Read a markdown file from disk, parse YAML frontmatter, and validate against a Zod schema.
 */
export function readDocument<T extends z.ZodObject<z.ZodRawShape>>(
  filePath: string,
  schema: T,
): ParsedDocument<z.infer<T>> {
  const result = read(filePath, schema);
  return {
    frontmatter: result.data,
    body: result.content,
  };
}
