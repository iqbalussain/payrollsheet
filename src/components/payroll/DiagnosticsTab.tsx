import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { runDiagnostics } from "@/lib/diagnostics.functions";

export function DiagnosticsTab() {
  const run = useServerFn(runDiagnostics);
  const query = useQuery({ queryKey: ["admin-diagnostics"], queryFn: () => run(), staleTime: 0 });
  const checks = query.data?.checks ?? [];
  const failed = checks.filter((c) => !c.ok);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div>
          <h2 className="text-lg font-semibold">System Diagnostics</h2>
          <p className="text-sm text-muted-foreground">
            {query.isLoading
              ? "Checking payroll database…"
              : query.error
                ? (query.error as Error).message
                : failed.length
                  ? `${failed.length} issue(s) found out of ${checks.length} checks`
                  : `All ${checks.length} checks passed`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
          className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} /> Re-run
          checks
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-2">Check</th>
              <th className="p-2">Status</th>
              <th className="p-2">Details / fix</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.label} className="border-t">
                <td className="p-2 font-mono text-xs">{c.label}</td>
                <td className="p-2">
                  {c.ok ? (
                    <span className="inline-flex items-center gap-1 text-success">
                      <CheckCircle2 className="h-4 w-4" /> OK
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-danger">
                      <XCircle className="h-4 w-4" /> Missing
                    </span>
                  )}
                </td>
                <td className="p-2 text-xs text-muted-foreground">
                  {c.detail}
                  {c.fix && <div className="mt-1 font-medium text-foreground">{c.fix}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
