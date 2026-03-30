/**
 * Grimoire AI core library.
 * Shared by the CLI and server layers.
 */

export const VERSION = "0.3.2";

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
  ListDocumentItem,
  UpdateDocumentResult,
  DeleteDocumentResult,
  ResolvedDocument,
  AppendEntryResult,
} from "./documents.ts";

export { validate } from "./validate.ts";
export type { ValidateResult, ValidateIssue } from "./validate.ts";

export { parseDocument, readDocument } from "./frontmatter.ts";
export type { ParsedDocument } from "./frontmatter.ts";

export { search } from "./search.ts";
export type { SearchResult, SearchResponse, SearchOptions } from "./search.ts";

export { generateEmbedding, generateEmbeddings, EMBEDDING_DIM } from "./embeddings.ts";
export type { ProgressCallback } from "./embeddings.ts";

export { loadEmbeddingCache } from "./embedding-cache.ts";
export type { EmbeddingCache } from "./embedding-cache.ts";

export { sync } from "./sync.ts";
export type { SyncResult, SyncOptions, SyncError, DryRunChange } from "./sync.ts";

export { autoSync } from "./auto-sync.ts";
export type { AutoSyncResult } from "./auto-sync.ts";

export { links } from "./links.ts";
export type { LinkItem, LinksResponse, LinksOptions } from "./links.ts";

export { tree } from "./tree.ts";
export type { TreeNode, TreeResponse, TreeOptions } from "./tree.ts";

export { orphans } from "./orphans.ts";
export type { OrphanItem, OrphansResponse, OrphansOptions } from "./orphans.ts";

export { status } from "./status.ts";
export type {
  StatusCounts,
  StatusByStatus,
  RecentDocument,
  StatusResponse,
  StatusOptions,
} from "./status.ts";

export { loadConfig } from "./config.ts";
export type { GrimoireConfig } from "./config.ts";

export {
  getDatabasePath,
  openDatabase,
  closeDatabase,
  getDatabase,
  initializeSchema,
  rebuildFtsIndex,
  rebuildVssIndex,
  isVssAvailable,
} from "./database.ts";
export type { DuckDBConnection } from "./database.ts";

export * from "./schemas.ts";
