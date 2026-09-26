ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.users AS payroll_user
SET email = auth_user.email
FROM auth.users AS auth_user
WHERE payroll_user.user_id = auth_user.id
  AND payroll_user.email IS DISTINCT FROM auth_user.email;

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

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
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

CREATE OR REPLACE VIEW public.user_roles
WITH (security_invoker = true)
AS
SELECT user_id, role
FROM public.users;

REVOKE ALL ON public.user_roles FROM anon;
GRANT SELECT ON public.user_roles TO authenticated;

NOTIFY pgrst, 'reload schema';
