/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface DiagnosticCheck {
  group: string;
  label: string;
  ok: boolean;
  detail: string;
  fix?: string | undefined;
}

const REQUIRED: Record<string, string[]> = {
  employees: ["id", "name", "hourly_rate", "status"],
  payroll_batches: ["id", "month", "site", "foreman"],
  payroll_lines: [
    "id",
    "batch_id",
    "employee_id",
    "month",
    "hours",
    "rate",
    "food_deduction",
    "prev_advance",
    "new_advance",
    "paid",
  ],
  employee_salary_history: [
    "employee_id",
    "hourly_rate",
    "effective_from",
    "effective_on",
    "created_at",
  ],
  advance_transactions: ["id", "employee_id", "date", "amount"],
  employee_site_assignments: ["employee_id", "site", "effective_from", "effective_to"],
};

export const runDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (
      typeof context.claims["email"] === "string" &&
      context.claims["email"].trim().toLowerCase() === "iqbalussain@gmail.com"
    ) {
      throw new Error("This account is restricted to deleting employees, sites, and payroll.");
    }
    const { data: me, error: roleError } = await (context.supabase as SupabaseClient<any>)
      .from("users")
      .select("role,is_active")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (roleError) throw new Error(`Could not verify administrator access: ${roleError.message}`);
    if (me?.role !== "admin" || !me.is_active)
      throw new Error("Only administrators can run diagnostics.");

    const admin = (await import("@/integrations/supabase/client.server"))
      .supabaseAdmin as unknown as SupabaseClient<any>;
    const checks: DiagnosticCheck[] = [];

    for (const [table, columns] of Object.entries(REQUIRED)) {
      for (const column of columns) {
        const { error } = await admin.from(table).select(column).limit(0);
        checks.push({
          group: table,
          label: `${table}.${column}`,
          ok: !error,
          detail: error ? error.message : "Available",
          fix: error
            ? table === "employee_salary_history"
              ? "Apply fix-external-attendance-infrastructure.sql in the payroll database SQL editor."
              : "Add this column/table in the payroll database, then re-run checks."
            : undefined,
        });
      }
    }

    const { data: bucket, error: bucketError } = await admin.storage.getBucket("timesheet-uploads");
    checks.push({
      group: "storage",
      label: "timesheet-uploads bucket",
      ok: !!bucket && !bucketError,
      detail: bucket ? "Exists" : (bucketError?.message ?? "Not found"),
      fix: bucket ? undefined : "Create a private bucket named timesheet-uploads in Storage.",
    });
    if (bucket) {
      checks.push({
        group: "storage",
        label: "timesheet-uploads is private",
        ok: !bucket.public,
        detail: bucket.public ? "Bucket is public" : "Private",
        fix: bucket.public ? "Make the bucket private so documents need signed links." : undefined,
      });
    }
    return { checks, checkedAt: new Date().toISOString() };
  });
