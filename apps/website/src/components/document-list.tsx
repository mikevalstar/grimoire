import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Copy } from "lucide-react";
import copy from "clipboard-copy";
import { format, parseISO } from "date-fns";
import type { DocumentListItem, DocumentListResponse } from "../lib/api.ts";
import type { DocumentSearch } from "../lib/search-schema.ts";
import { StatusBadge, PriorityBadge } from "./status-badge.tsx";
import { Card, CardContent } from "./ui/card.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.tsx";
import { cn } from "@/lib/utils.ts";

const TYPE_ROUTES: Record<string, string> = {
  feature: "/features",
  requirement: "/requirements",
  task: "/tasks",
  decision: "/decisions",
};

const COLUMNS = [
  { key: "id", label: "ID", align: "left" as const },
  { key: "title", label: "Title", align: "left" as const },
  { key: "status", label: "Status", align: "left" as const },
  { key: "priority", label: "Priority", align: "left" as const },
  { key: "updated", label: "Updated", align: "right" as const },
] as const;

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function compareDocuments(a: DocumentListItem, b: DocumentListItem, field: string): number {
  if (field === "priority") {
    return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
  }
  const av = a[field as keyof DocumentListItem] ?? "";
  const bv = b[field as keyof DocumentListItem] ?? "";
  return String(av).localeCompare(String(bv));
}

function SortIcon({ column, sort, desc }: { column: string; sort: string; desc: boolean }) {
  if (sort !== column) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/40" />;
  return desc ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void copy(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
      title="Copy ID"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "MMM d, yyyy");
  } catch {
    return dateStr;
  }
}

export function DocumentList({
  data,
  search,
  onSort,
}: {
  data: DocumentListResponse;
  search: DocumentSearch;
  onSort: (search: DocumentSearch) => void;
}) {
  const basePath = TYPE_ROUTES[data.type] ?? "/";
  const currentSort = search.sort ?? "updated";
  const currentDesc = search.desc ?? true;

  const sorted = useMemo(() => {
    const docs = [...data.documents];
    docs.sort((a, b) => {
      const cmp = compareDocuments(a, b, currentSort);
      return currentDesc ? -cmp : cmp;
    });
    return docs;
  }, [data.documents, currentSort, currentDesc]);

  function handleSort(column: string) {
    if (currentSort === column) {
      onSort({ ...search, sort: column, desc: !currentDesc });
    } else {
      onSort({ ...search, sort: column, desc: true });
    }
  }

  if (data.documents.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No documents found.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((col) => (
                <TableHead key={col.key} className={cn(col.align === "right" && "text-right")}>
                  <button
                    type="button"
                    onClick={() => handleSort(col.key)}
                    className={cn(
                      "inline-flex items-center gap-1 transition-colors hover:text-foreground",
                      currentSort === col.key ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {col.label}
                    <SortIcon column={col.key} sort={currentSort} desc={currentDesc} />
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono text-xs text-muted-foreground">{doc.uid}</span>
                    <CopyButton text={doc.id} />
                  </span>
                </TableCell>
                <TableCell>
                  <Link
                    to={`${basePath}/${doc.id}` as "/"}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    {doc.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge status={doc.status} />
                </TableCell>
                <TableCell>
                  <PriorityBadge priority={doc.priority} />
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatDate(doc.updated)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
