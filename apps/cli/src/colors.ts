import pc from "picocolors";

// picocolors respects NO_COLOR, FORCE_COLOR, and pipe detection automatically.

/** Green checkmark-style success text */
export const success = (s: string): string => pc.green(s);

/** Red error text */
export const error = (s: string): string => pc.red(s);

/** Yellow warning text */
export const warn = (s: string): string => pc.yellow(s);

/** Dim/muted text for secondary info */
export const dim = (s: string): string => pc.dim(s);

/** Bold text for emphasis */
export const bold = (s: string): string => pc.bold(s);

/** Cyan for IDs and identifiers */
export const id = (s: string): string => pc.cyan(s);

/** Format a label: value pair */
export const label = (l: string, v: string): string => `${pc.dim(l)} ${v}`;

/** Status badge with color coding */
export function status(s: string): string {
  switch (s) {
    case "draft":
      return pc.yellow(s);
    case "active":
    case "in-progress":
      return pc.blue(s);
    case "done":
    case "accepted":
    case "approved":
      return pc.green(s);
    case "deprecated":
    case "superseded":
    case "rejected":
      return pc.dim(s);
    case "blocked":
      return pc.red(s);
    default:
      return s;
  }
}

/** Priority with color coding */
export function priority(p: string): string {
  switch (p) {
    case "critical":
      return pc.red(pc.bold(p));
    case "high":
      return pc.red(p);
    case "medium":
      return pc.yellow(p);
    case "low":
      return pc.dim(p);
    default:
      return p;
  }
}
