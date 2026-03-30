import { Link } from "@tanstack/react-router";
import type { DocumentListResponse } from "../lib/api.ts";
import { StatusBadge, PriorityBadge } from "./status-badge.tsx";
import { Card, CardContent } from "./ui/card.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.tsx";

const TYPE_ROUTES: Record<string, string> = {
  feature: "/features",
  requirement: "/requirements",
  task: "/tasks",
  decision: "/decisions",
};

export function DocumentList({ data }: { data: DocumentListResponse }) {
  const basePath = TYPE_ROUTES[data.type] ?? "/";

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
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead className="text-right">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.documents.map((doc) => (
              <TableRow key={doc.id}>
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
                <TableCell className="text-right text-muted-foreground">{doc.updated}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
