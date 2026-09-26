CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id TEXT,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  old_data JSONB,
  new_data JSONB,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_changed_at_idx
  ON public.audit_logs (changed_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_table_record_idx
  ON public.audit_logs (table_name, record_id, changed_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;

DROP POLICY IF EXISTS "audit_logs_admin_read" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_read"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.has_payroll_role(ARRAY['admin']));

CREATE OR REPLACE FUNCTION public.capture_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  old_record JSONB;
  new_record JSONB;
  record_data JSONB;
BEGIN
  IF TG_OP = 'UPDATE' AND to_jsonb(OLD) = to_jsonb(NEW) THEN
    RETURN NEW;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    old_record := to_jsonb(OLD);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    new_record := to_jsonb(NEW);
  END IF;

  record_data := COALESCE(new_record, old_record);

  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    operation,
    actor_id,
    actor_email,
    old_data,
    new_data
  )
  VALUES (
    TG_TABLE_NAME,
    COALESCE(record_data ->> 'id', record_data ->> 'user_id'),
    TG_OP,
    auth.uid(),
    COALESCE(auth.jwt() ->> 'email', current_setting('request.jwt.claim.email', true)),
    old_record,
    new_record
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_audit_log() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  target_table TEXT;
  trigger_name TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'users',
    'employees',
    'payroll_batches',
    'payroll_lines',
    'advance_transactions'
  ]
  LOOP
    IF to_regclass(format('public.%I', target_table)) IS NOT NULL THEN
      trigger_name := target_table || '_audit_log_trg';
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trigger_name, target_table);
      EXECUTE format(
        'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.capture_audit_log()',
        trigger_name,
        target_table
      );
    END IF;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
