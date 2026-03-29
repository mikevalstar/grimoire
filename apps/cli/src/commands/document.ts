import type { Command } from "commander";
import {
  createDocument,
  getDocument,
  listDocuments,
  updateDocument,
  deleteDocument,
  type DocumentType,
} from "@grimoire-ai/core";

const DOCUMENT_TYPES = ["feature", "requirement", "task", "decision"] as const;

function handleError(err: unknown): void {
  console.error(
    JSON.stringify({
      error: err instanceof Error ? err.message : String(err),
    }),
  );
  process.exitCode = 1;
}

function collectRepeatable(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function registerTypeCommands(program: Command, type: DocumentType): void {
  const cmd = program.command(type).description(`Manage ${type} documents`);

  // --- create ---
  cmd
    .command("create")
    .description(`Create a new ${type} document`)
    .requiredOption("--title <title>", "Document title")
    .option("--id <id>", "Custom ID (auto-generated from title if omitted)")
    .option("--status <status>", "Initial status")
    .option("--priority <priority>", "Priority level")
    .option("--tag <tag>", "Tag (repeatable)", collectRepeatable, [])
    .option("--feature <feature-id>", "Parent feature ID")
    .option("--requirement <req-id>", "Parent requirement ID (for tasks)")
    .option("--body <text>", "Body content")
    .option("--from-file <path>", "Import body from an existing file")
    .action(
      async (opts: {
        title: string;
        id?: string;
        status?: string;
        priority?: string;
        tag: string[];
        feature?: string;
        requirement?: string;
        body?: string;
        fromFile?: string;
      }) => {
        const globalOpts = program.opts<{ cwd?: string }>();

        try {
          let body = opts.body;
          if (opts.fromFile) {
            const { readFile } = await import("node:fs/promises");
            body = await readFile(opts.fromFile, "utf-8");
          }

          const result = await createDocument({
            type,
            title: opts.title,
            id: opts.id,
            status: opts.status,
            priority: opts.priority as "critical" | "high" | "medium" | "low" | undefined,
            tags: opts.tag,
            feature: opts.feature,
            requirement: opts.requirement,
            body: body ?? "",
            cwd: globalOpts.cwd,
          });

          console.log(JSON.stringify({ success: true, ...result }));
        } catch (err) {
          handleError(err);
        }
      },
    );

  // --- get ---
  cmd
    .command("get <id>")
    .description(`Get a ${type} document by ID`)
    .option("--metadata-only", "Return only frontmatter, no body")
    .option("--no-changelog", "Exclude changelog section from output")
    .action(async (id: string, opts: { metadataOnly?: boolean; changelog?: boolean }) => {
      const globalOpts = program.opts<{ cwd?: string }>();

      try {
        const result = await getDocument({
          type,
          id,
          metadataOnly: opts.metadataOnly ?? false,
          noChangelog: opts.changelog === false,
          cwd: globalOpts.cwd,
        });

        console.log(JSON.stringify(result));
      } catch (err) {
        handleError(err);
      }
    });

  // --- list ---
  cmd
    .command("list")
    .description(`List all ${type} documents`)
    .option("--status <status>", "Filter by status")
    .option("--priority <priority>", "Filter by priority")
    .option("--tag <tag>", "Filter by tag")
    .option("--feature <feature-id>", "Filter by parent feature")
    .option("--limit <n>", "Limit results", Number.parseInt)
    .option("--sort <field>", "Sort by field (default: updated)")
    .action(
      async (opts: {
        status?: string;
        priority?: string;
        tag?: string;
        feature?: string;
        limit?: number;
        sort?: string;
      }) => {
        const globalOpts = program.opts<{ cwd?: string }>();

        try {
          const result = await listDocuments({
            type,
            status: opts.status,
            priority: opts.priority,
            tag: opts.tag,
            feature: opts.feature,
            limit: opts.limit,
            sort: opts.sort ?? "updated",
            cwd: globalOpts.cwd,
          });

          console.log(JSON.stringify(result));
        } catch (err) {
          handleError(err);
        }
      },
    );

  // --- update ---
  cmd
    .command("update <id>")
    .description(`Update a ${type} document`)
    .option("--title <title>", "Update title")
    .option("--status <status>", "Update status")
    .option("--priority <priority>", "Update priority")
    .option("--add-tag <tag>", "Add a tag (repeatable)", collectRepeatable, [])
    .option("--remove-tag <tag>", "Remove a tag (repeatable)", collectRepeatable, [])
    .option("--body <text>", "Replace body")
    .option("--append <text>", "Append to body")
    .option("--feature <feature-id>", "Set parent feature")
    .option("--requirement <req-id>", "Set parent requirement (for tasks)")
    .action(
      async (
        id: string,
        opts: {
          title?: string;
          status?: string;
          priority?: string;
          addTag: string[];
          removeTag: string[];
          body?: string;
          append?: string;
          feature?: string;
          requirement?: string;
        },
      ) => {
        const globalOpts = program.opts<{ cwd?: string }>();

        try {
          const result = await updateDocument({
            type,
            id,
            title: opts.title,
            status: opts.status,
            priority: opts.priority as "critical" | "high" | "medium" | "low" | undefined,
            addTag: opts.addTag,
            removeTag: opts.removeTag,
            body: opts.body,
            append: opts.append,
            feature: opts.feature,
            requirement: opts.requirement,
            cwd: globalOpts.cwd,
          });

          console.log(JSON.stringify({ success: true, ...result }));
        } catch (err) {
          handleError(err);
        }
      },
    );

  // --- delete ---
  cmd
    .command("delete <id>")
    .description(`Delete a ${type} document (moves to .archive/)`)
    .option("--hard", "Permanently delete (no archive)")
    .option("--confirm", "Skip confirmation (required in AI mode)")
    .action(async (id: string, opts: { hard?: boolean; confirm?: boolean }) => {
      const globalOpts = program.opts<{ cwd?: string }>();

      // In AI mode (non-interactive), require --confirm
      if (!opts.confirm) {
        console.error(
          JSON.stringify({
            error: "Delete requires --confirm flag in AI mode",
            hint: `Usage: grimoire ${type} delete ${id} --confirm`,
          }),
        );
        process.exitCode = 1;
        return;
      }

      try {
        const result = await deleteDocument({
          type,
          id,
          hard: opts.hard ?? false,
          cwd: globalOpts.cwd,
        });

        console.log(JSON.stringify({ success: true, ...result }));
      } catch (err) {
        handleError(err);
      }
    });
}

export function registerDocumentCommands(program: Command): void {
  for (const type of DOCUMENT_TYPES) {
    registerTypeCommands(program, type);
  }
}
