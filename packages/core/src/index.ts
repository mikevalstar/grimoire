/**
 * Grimoire AI core library.
 * Shared by the CLI and server layers.
 */

export const VERSION = "0.0.1";

export function getVersion(): string {
  return VERSION;
}

export { init } from "./init.ts";
export type { InitResult } from "./init.ts";

export { overview } from "./overview.ts";
export type { OverviewResult } from "./overview.ts";

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

export { parseDocument, readDocument } from "./frontmatter.ts";
export type { ParsedDocument } from "./frontmatter.ts";

export * from "./schemas.ts";
