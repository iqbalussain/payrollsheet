CREATE TABLE IF NOT EXISTS public.users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'hr')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_payroll_role(required_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE user_id = auth.uid()
      AND role = ANY (required_roles)
  );
$$;

REVOKE ALL ON FUNCTION public.has_payroll_role(TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_payroll_role(TEXT[]) TO authenticated;

REVOKE ALL ON public.users FROM anon, authenticated;
GRANT SELECT ON public.users TO authenticated;

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.users', policy_record.policyname);
  END LOOP;
END
$$;

CREATE POLICY "users_select_self_or_admin"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_payroll_role(ARRAY['admin']));

DO $$
DECLARE
  target_table TEXT;
  policy_record RECORD;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['employees', 'payroll_batches', 'payroll_lines']
  LOOP
    FOR policy_record IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = target_table
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', policy_record.policyname, target_table);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', target_table);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', target_table);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.has_payroll_role(ARRAY[''admin''])) WITH CHECK (public.has_payroll_role(ARRAY[''admin'']))',
      target_table || '_admin_all',
      target_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_payroll_role(ARRAY[''admin'', ''hr'']))',
      target_table || '_staff_read',
      target_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_payroll_role(ARRAY[''admin'', ''hr'']))',
      target_table || '_staff_insert',
      target_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.has_payroll_role(ARRAY[''admin'', ''hr''])) WITH CHECK (public.has_payroll_role(ARRAY[''admin'', ''hr'']))',
      target_table || '_staff_update',
      target_table
    );
  END LOOP;
END
$$;

GRANT USAGE, SELECT ON SEQUENCE public.employees_id_seq TO authenticated;
REVOKE ALL ON SEQUENCE public.employees_id_seq FROM anon;

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  IF to_regclass('public.advance_transactions') IS NOT NULL THEN
    FOR policy_record IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'advance_transactions'
    LOOP
      EXECUTE format('DROP POLICY %I ON public.advance_transactions', policy_record.policyname);
    END LOOP;

    ALTER TABLE public.advance_transactions ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.advance_transactions FROM anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.advance_transactions TO authenticated;

    CREATE POLICY "advance_transactions_admin_all"
      ON public.advance_transactions
      FOR ALL
      TO authenticated
      USING (public.has_payroll_role(ARRAY['admin']))
      WITH CHECK (public.has_payroll_role(ARRAY['admin']));
    CREATE POLICY "advance_transactions_staff_read"
      ON public.advance_transactions
      FOR SELECT
      TO authenticated
      USING (public.has_payroll_role(ARRAY['admin', 'hr']));
    CREATE POLICY "advance_transactions_staff_insert"
      ON public.advance_transactions
      FOR INSERT
      TO authenticated
      WITH CHECK (public.has_payroll_role(ARRAY['admin', 'hr']));
    CREATE POLICY "advance_transactions_staff_update"
      ON public.advance_transactions
      FOR UPDATE
      TO authenticated
      USING (public.has_payroll_role(ARRAY['admin', 'hr']))
      WITH CHECK (public.has_payroll_role(ARRAY['admin', 'hr']));
  END IF;
END
$$;
