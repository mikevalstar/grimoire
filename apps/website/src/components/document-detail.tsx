import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { DocumentDetail } from "../lib/api.ts";
import { StatusBadge, PriorityBadge } from "./status-badge.tsx";
import { Markdown } from "./markdown.tsx";
import { Badge } from "./ui/badge.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card.tsx";

const TYPE_LABELS: Record<string, string> = {
  feature: "Features",
  requirement: "Requirements",
  task: "Tasks",
  decision: "Decisions",
};

const TYPE_ROUTES: Record<string, string> = {
  feature: "/features",
  requirement: "/requirements",
  task: "/tasks",
  decision: "/decisions",
};

function str(val: unknown): string {
  return typeof val === "string" ? val : "";
}

function strArr(val: unknown): string[] {
  return Array.isArray(val) ? (val as string[]) : [];
}

export function DocumentDetailView({ data }: { data: DocumentDetail }) {
  const fm = data.frontmatter;
  const backPath = TYPE_ROUTES[data.type] ?? "/";
  const backLabel = TYPE_LABELS[data.type] ?? data.type;
  const title = str(fm.title);
  const status = str(fm.status);
  const priority = str(fm.priority);
  const created = str(fm.created);
  const updated = str(fm.updated);
  const assignee = str(fm.assignee);
  const tags = strArr(fm.tags);
  const featureId = str(fm.feature);
  const requirementId = str(fm.requirement);

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <Link
        to={backPath as "/"}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {backLabel}
      </Link>

      {/* Title and badges */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {status && <StatusBadge status={status} />}
          {priority && <PriorityBadge priority={priority} />}
          {tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* Metadata card */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">ID</dt>
            <dd className="font-mono text-xs">{data.id}</dd>

            {created && (
              <>
                <dt className="text-muted-foreground">Created</dt>
                <dd>{created}</dd>
              </>
            )}
            {updated && (
              <>
                <dt className="text-muted-foreground">Updated</dt>
                <dd>{updated}</dd>
              </>
            )}
            {assignee && (
              <>
                <dt className="text-muted-foreground">Assignee</dt>
                <dd>{assignee}</dd>
              </>
            )}
            {featureId && (
              <>
                <dt className="text-muted-foreground">Feature</dt>
                <dd>
                  <Link
                    to={`/features/${featureId}` as "/"}
                    className="text-primary hover:underline"
                  >
                    {featureId}
                  </Link>
                </dd>
              </>
            )}
            {requirementId && (
              <>
                <dt className="text-muted-foreground">Requirement</dt>
                <dd>
                  <Link
                    to={`/requirements/${requirementId}` as "/"}
                    className="text-primary hover:underline"
                  >
                    {requirementId}
                  </Link>
                </dd>
              </>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Related documents */}
      <RelatedSection label="Requirements" ids={strArr(fm.requirements)} type="requirements" />
      <RelatedSection label="Tasks" ids={strArr(fm.tasks)} type="tasks" />
      <RelatedSection label="Decisions" ids={strArr(fm.decisions)} type="decisions" />
      <RelatedSection label="Features" ids={strArr(fm.features)} type="features" />
      <RelatedSection label="Dependencies" ids={strArr(fm.depends_on)} type="" />

      {/* Body */}
      {data.body && (
        <Card>
          <CardContent className="pt-6">
            <Markdown content={data.body} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RelatedSection({ label, ids, type }: { label: string; ids: string[]; type: string }) {
  if (ids.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {ids.map((id) =>
            type ? (
              <Link
                key={id}
                to={`/${type}/${id}` as "/"}
                className="text-sm text-primary hover:underline"
              >
                <Badge variant="outline" className="font-mono">
                  {id}
                </Badge>
              </Link>
            ) : (
              <Badge key={id} variant="outline" className="font-mono">
                {id}
              </Badge>
            ),
          )}
        </div>
      </CardContent>
    </Card>
  );
}
