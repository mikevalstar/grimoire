/**
 * Grimoire AI core library.
 * Shared by the CLI and server layers.
 */

export const VERSION = "0.1.2";

export function getVersion(): string {
  return VERSION;
}

export { init } from "./init.ts";
export type { InitResult } from "./init.ts";

export { overview, updateOverview } from "./overview.ts";
export type { OverviewResult, UpdateOverviewResult } from "./overview.ts";

export {
  createDocument,
  getDocument,
  listDocuments,
  updateDocument,
  deleteDocument,
  resolveDocumentId,
  resolveDocumentIdAnyType,
  appendLog,
  appendComment,
} from "./documents.ts";
export type {
  CreateDocumentResult,
  GetDocumentResult,
  ListDocumentsResult,
  UpdateDocumentResult,
  DeleteDocumentResult,
  ResolvedDocument,
  AppendEntryResult,
} from "./documents.ts";

export { validate } from "./validate.ts";
export type { ValidateResult, ValidateIssue } from "./validate.ts";

export { parseDocument, readDocument } from "./frontmatter.ts";
export type { ParsedDocument } from "./frontmatter.ts";

export { sync } from "./sync.ts";
export type { SyncResult, SyncOptions, SyncError, DryRunChange } from "./sync.ts";

export {
  getDatabasePath,
  openDatabase,
  closeDatabase,
  getDatabase,
  initializeSchema,
} from "./database.ts";
export type { DuckDBConnection } from "./database.ts";

export * from "./schemas.ts";
