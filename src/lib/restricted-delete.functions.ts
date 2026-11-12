/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const deleteInput = z.discriminatedUnion("type", [
  z.object({ type: z.literal("employee"), id: z.number().int().positive() }),
  z.object({ type: z.literal("site"), id: z.string().uuid() }),
  z.object({ type: z.literal("payroll"), id: z.string().uuid() }),
]);

export const deletePayrollRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => deleteInput.parse(data))
  .handler(async ({ data, context }) => {
    const authDb = context.supabase as SupabaseClient<any>;
    const { data: profile, error: profileError } = await authDb
      .from("users")
      .select("role,is_active,email")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (profileError) throw new Error(`Could not verify delete access: ${profileError.message}`);
    if (!profile?.is_active) throw new Error("This account is inactive.");
    if (profile.role !== "admin") {
      throw new Error("Only an active administrator can delete records.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as SupabaseClient<any>;
    if (data.type === "employee") {
      const { error } = await admin.rpc("delete_employee_with_history", {
        target_employee_id: data.id,
      });
      if (error) throw new Error(`Could not delete employee and related history: ${error.message}`);
      return { type: data.type, id: data.id };
    }
    if (data.type === "site") {
      const { error } = await admin.rpc("delete_project_with_assignments", {
        target_project_id: data.id,
      });
      if (error) throw new Error(`Could not delete site and its assignments: ${error.message}`);
      return { type: data.type, id: data.id };
    }

    // Delete lines while the batch still exists: the line lifecycle trigger rejects
    // cascaded line deletes once the parent batch row is gone.
    const { error: linesError } = await admin
      .from("payroll_lines")
      .delete()
      .eq("batch_id", data.id);
    if (linesError) throw new Error(`Could not delete payroll lines: ${linesError.message}`);
    const { data: deleted, error } = await admin
      .from("payroll_batches")
      .delete()
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(`Could not delete payroll batch: ${error.message}`);
    if (!deleted) throw new Error("The payroll batch was not found or was already deleted.");
    return { type: data.type, id: data.id };
  });
