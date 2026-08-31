# Move the app onto your own Supabase project

Point the payroll app at `milcjipktyhlwiriujrw.supabase.co`, create the full schema there, and move all existing data across (206 employees, 1 payroll batch, 28 payroll lines).

## What you get

- The app reads and writes to your Supabase project instead of the built-in backend.
- All tables, constraints, triggers and access rules recreated exactly as they are today.
- A one-click SQL script containing schema + every existing row, ready to paste into your Supabase SQL editor.

## Steps

1. **Generate the setup script** — one SQL file with:
   - `employees` (name, trade, ID number, hourly rate, status)
   - `payroll_batches` (month, site, foreman)
   - `payroll_lines` (hours, rate, food deduction, previous advance, new advance, other deductions, net salary, paid) linked to batches and employees
   - The unique rule that stops the same employee being paid twice in one month
   - The trigger that keeps a payroll line's month in sync with its batch
   - Grants + access policies matching today's setup (open read/write for this internal tool)
   - `INSERT` statements for all 206 employees, the existing batch and its 28 lines, plus an ID-sequence reset
2. **You run it** in your Supabase project's SQL editor (I cannot execute SQL against an external project).
3. **Repoint the app** — add a small client module that connects to your project URL and publishable key, and switch the payroll data layer (`src/lib/payroll-data.ts`) to use it. Nothing else in the UI or calculations changes.
4. **Verify** — build check plus a preview smoke test that employees, payroll, history, slips and cost allocation all load from your project.

## Technical notes

- `src/integrations/supabase/client.ts` and `.env` are managed files tied to the built-in backend, so they stay untouched. A new `src/integrations/supabase/external-client.ts` creates a typed client from your URL and publishable key (publishable keys are safe in client code).
- Type definitions are reused from the existing generated `types.ts`, since the schema is identical.
- No edge functions or server functions are needed — the app talks to the database directly through the Data API with RLS policies, exactly as it does now.
- The built-in Cloud backend cannot be removed from the project; it will simply go unused after the switch.
- Note: the current policies allow anonymous read/write. If you later want sign-in protection on your own project, that's a separate follow-up.
