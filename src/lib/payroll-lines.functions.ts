/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PAYROLL_WRITERS = new Set(["admin", "hr", "manager", "foreman"]);
// Only these roles may record a new advance on a payroll line.
const ADVANCE_ISSUERS = new Set(["admin", "hr"]);

const lineSchema = z
  .object({
    id: z.string().uuid().optional(),
    batch_id: z.string().uuid(),
    employee_id: z.number().int().positive(),
    new_advance: z.number().min(0).max(1_000_000),
  })
  .passthrough();

export const savePayrollLines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ rows: z.array(lineSchema).max(1000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: me, error: roleError } = await (context.supabase as SupabaseClient<any>)
      .from("users")
      .select("role,is_active")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (roleError) throw new Error("Could not verify your payroll access.");
    if (!me?.is_active || !PAYROLL_WRITERS.has(me.role)) {
      throw new Error("You do not have permission to save payroll.");
    }
    const canIssueAdvance = ADVANCE_ISSUERS.has(me.role);

    const admin = (await import("@/integrations/supabase/client.server"))
      .supabaseAdmin as unknown as SupabaseClient<any>;

    // Non-issuers cannot change new_advance: keep the stored value (or 0 for new lines).
    const stored = new Map<string, number>();
    const ids = data.rows.flatMap((r) => (r.id ? [r.id] : []));
    if (!canIssueAdvance && ids.length) {
      const { data: existing, error } = await admin
        .from("payroll_lines")
        .select("id,new_advance")
        .in("id", ids);
      if (error) throw new Error("Could not load existing payroll lines.");
      (existing ?? []).forEach((row: any) => stored.set(row.id, Number(row.new_advance ?? 0)));
    }
    const rows = data.rows.map((row) => ({
      ...row,
      new_advance: canIssueAdvance ? row.new_advance : row.id ? (stored.get(row.id) ?? 0) : 0,
    }));

    const { data: saved, error } = await admin
      .from("payroll_lines")
      .upsert(rows as never, { onConflict: "id" })
      .select("*");
    if (error) throw new Error(`Could not save payroll lines: ${error.message}`);
    return { rows: saved ?? [] };
  });
