import { CheckCircle2, XCircle } from "lucide-react";
import type { CalibreServerTest } from "@/lib/api";

/**
 * The outcome of a content server probe, shown the same way wherever a URL can
 * be tested — the setup wizard and settings.
 */
export function CalibreTestResult({ test }: { test: CalibreServerTest }) {
  return (
    <p
      className={`flex items-start gap-2 text-sm ${
        test.ok ? "text-green-600 dark:text-green-500" : "text-destructive"
      }`}
    >
      {test.ok ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
      ) : (
        <XCircle className="mt-0.5 size-4 shrink-0" />
      )}
      {test.ok ? `Connected — ${test.bookCount} books found.` : test.error}
    </p>
  );
}
