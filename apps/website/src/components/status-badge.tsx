import { Badge } from "./ui/badge.tsx";
import { cn } from "@/lib/utils.ts";

const STATUS_STYLES: Record<string, string> = {
  "in-progress": "bg-blue-500/15 text-blue-700 border-blue-200",
  todo: "bg-amber-500/15 text-amber-700 border-amber-200",
  draft: "bg-amber-500/15 text-amber-700 border-amber-200",
  proposed: "bg-amber-500/15 text-amber-700 border-amber-200",
  done: "bg-emerald-500/15 text-emerald-700 border-emerald-200",
  complete: "bg-emerald-500/15 text-emerald-700 border-emerald-200",
  accepted: "bg-emerald-500/15 text-emerald-700 border-emerald-200",
  approved: "bg-emerald-500/15 text-emerald-700 border-emerald-200",
  blocked: "bg-red-500/15 text-red-700 border-red-200",
  rejected: "bg-red-500/15 text-red-700 border-red-200",
  deprecated: "bg-gray-500/10 text-gray-500 border-gray-200",
  cancelled: "bg-gray-500/10 text-gray-500 border-gray-200",
  superseded: "bg-gray-500/10 text-gray-500 border-gray-200",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-gray-500/10 text-gray-500 border-gray-200";
  return (
    <Badge variant="outline" className={cn(style)}>
      {status}
    </Badge>
  );
}

const PRIORITY_STYLES: Record<string, string> = {
  critical: "bg-red-500/15 text-red-700 border-red-200",
  high: "bg-orange-500/15 text-orange-700 border-orange-200",
  medium: "bg-secondary text-secondary-foreground",
  low: "bg-gray-500/10 text-gray-500 border-gray-200",
};

export function PriorityBadge({ priority }: { priority: string }) {
  const style = PRIORITY_STYLES[priority] ?? "bg-gray-500/10 text-gray-500 border-gray-200";
  return (
    <Badge variant="outline" className={cn(style)}>
      {priority}
    </Badge>
  );
}
