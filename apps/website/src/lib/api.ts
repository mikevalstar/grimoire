const BASE = "/api";

export interface StatusCounts {
  features: number;
  requirements: number;
  tasks: number;
  decisions: number;
  total: number;
}

export interface RecentDocument {
  id: string;
  title: string;
  type: string;
  status: string;
  updated: string;
}

export interface StatusResponse {
  counts: StatusCounts;
  by_status: Record<string, Record<string, number>>;
  open_tasks: number;
  blocked_tasks: number;
  orphaned_documents: number;
  stale_documents: number;
  stale_threshold_days: number;
  recent: RecentDocument[];
}

export interface DocumentListItem {
  id: string;
  uid: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  updated: string;
  filepath: string;
}

export interface DocumentListResponse {
  type: string;
  count: number;
  documents: DocumentListItem[];
}

export interface DocumentDetail {
  id: string;
  type: string;
  filepath: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

export async function fetchStatus(): Promise<StatusResponse> {
  const res = await fetch(`${BASE}/status`);
  if (!res.ok) throw new Error(`Failed to fetch status: ${res.statusText}`);
  return res.json() as Promise<StatusResponse>;
}

export async function fetchDocuments(type: string): Promise<DocumentListResponse> {
  const res = await fetch(`${BASE}/documents/${type}`);
  if (!res.ok) throw new Error(`Failed to fetch ${type}s: ${res.statusText}`);
  return res.json() as Promise<DocumentListResponse>;
}

export async function fetchDocument(type: string, id: string): Promise<DocumentDetail> {
  const res = await fetch(`${BASE}/documents/${type}/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch document: ${res.statusText}`);
  return res.json() as Promise<DocumentDetail>;
}
