ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.users AS payroll_user
SET email = auth_user.email
FROM auth.users AS auth_user
WHERE payroll_user.user_id = auth_user.id
  AND payroll_user.email IS DISTINCT FROM auth_user.email;

CREATE OR REPLACE VIEW public.user_roles
WITH (security_invoker = true)
AS
SELECT user_id, role
FROM public.users;

REVOKE ALL ON public.user_roles FROM anon;
GRANT SELECT ON public.user_roles TO authenticated;
