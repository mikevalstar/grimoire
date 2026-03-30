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

export async function fetchStatus(): Promise<StatusResponse> {
  const res = await fetch(`${BASE}/status`);
  if (!res.ok) throw new Error(`Failed to fetch status: ${res.statusText}`);
  return res.json() as Promise<StatusResponse>;
}
