import { Link } from "@tanstack/react-router";
import { BookOpen, CheckSquare, ListChecks, Scale, AlertTriangle, CheckCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { StatusResponse } from "../lib/api.ts";
import { StatusBadge } from "./status-badge.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.tsx";

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "MMM d, yyyy");
  } catch {
    return dateStr;
  }
}

const TYPE_CONFIG: Record<string, { label: string; route: string; icon: typeof BookOpen }> = {
  feature: { label: "Features", route: "/features", icon: BookOpen },
  requirement: { label: "Requirements", route: "/requirements", icon: ListChecks },
  task: { label: "Tasks", route: "/tasks", icon: CheckSquare },
  decision: { label: "Decisions", route: "/decisions", icon: Scale },
};

function CountCard({
  label,
  count,
  to,
  icon: Icon,
}: {
  label: string;
  count: number;
  to: string;
  icon: typeof BookOpen;
}) {
  return (
    <Link to={to as "/"} className="group block no-underline">
      <Card className="transition-all group-hover:border-primary/30 group-hover:shadow-md">
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle>{label}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{count}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

function HealthCard({ data }: { data: StatusResponse }) {
  const items = [
    {
      label: "Open tasks",
      value: data.open_tasks,
      good: data.open_tasks === 0,
    },
    {
      label: "Blocked tasks",
      value: data.blocked_tasks,
      good: data.blocked_tasks === 0,
    },
    {
      label: "Orphaned docs",
      value: data.orphaned_documents,
      good: data.orphaned_documents === 0,
    },
    {
      label: `Stale (>${data.stale_threshold_days}d)`,
      value: data.stale_documents,
      good: data.stale_documents === 0,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Health</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-sm">
              {item.good ? (
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              )}
              <span className="text-muted-foreground">{item.label}</span>
              <span className="ml-auto font-semibold">{item.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function StatusDashboard({ data }: { data: StatusResponse }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Project overview and health at a glance.</p>
      </div>

      {/* Count cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <CountCard label="Features" count={data.counts.features} to="/features" icon={BookOpen} />
        <CountCard
          label="Requirements"
          count={data.counts.requirements}
          to="/requirements"
          icon={ListChecks}
        />
        <CountCard label="Tasks" count={data.counts.tasks} to="/tasks" icon={CheckSquare} />
        <CountCard label="Decisions" count={data.counts.decisions} to="/decisions" icon={Scale} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Status breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {Object.entries(data.by_status).map(([type, statuses]) => {
                const config = TYPE_CONFIG[type];
                return (
                  <div key={type}>
                    <div className="mb-1 text-sm font-medium">{config?.label ?? type}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(statuses).map(([st, cnt]) => (
                        <span
                          key={st}
                          className="flex items-center gap-1 text-xs text-muted-foreground"
                        >
                          <StatusBadge status={st} />
                          <span>{cnt}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Health */}
        <HealthCard data={data} />
      </div>

      {/* Recent updates */}
      {data.recent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Updates</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent.map((doc) => {
                  const config = TYPE_CONFIG[doc.type];
                  return (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <Link
                          to={`${config?.route ?? "/"}/${doc.id}` as "/"}
                          className="font-medium text-foreground hover:text-primary"
                        >
                          {doc.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground capitalize">{doc.type}</TableCell>
                      <TableCell>
                        <StatusBadge status={doc.status} />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatDate(doc.updated)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
