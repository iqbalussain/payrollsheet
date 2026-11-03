CREATE OR REPLACE FUNCTION public.has_payroll_role(required_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users AS profile
    WHERE profile.user_id = auth.uid()
      AND profile.is_active
      AND profile.role = ANY (required_roles)
  );
$$;

ALTER FUNCTION public.has_payroll_role(TEXT[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.has_payroll_role(TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_payroll_role(TEXT[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_read_payroll_user_profile(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT target_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.users AS viewer
      WHERE viewer.user_id = auth.uid()
        AND viewer.is_active
        AND viewer.role IN ('admin', 'hr')
    )
    OR EXISTS (
      SELECT 1
      FROM public.users AS viewer
      JOIN public.manager_project_assignments AS assignment
        ON assignment.manager_user_id = viewer.user_id
      JOIN public.projects AS project
        ON project.id = assignment.project_id
      WHERE viewer.user_id = auth.uid()
        AND viewer.is_active
        AND viewer.role = 'manager'
        AND project.foreman_user_id = target_user_id
    );
$$;

ALTER FUNCTION public.can_read_payroll_user_profile(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.can_read_payroll_user_profile(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_payroll_user_profile(UUID) TO authenticated;

DROP POLICY IF EXISTS users_select_self_admin_or_project_foreman ON public.users;
DROP POLICY IF EXISTS users_select_self_or_admin ON public.users;
DROP POLICY IF EXISTS users_select_authorized_profiles ON public.users;
CREATE POLICY users_select_authorized_profiles
  ON public.users FOR SELECT TO authenticated
  USING (public.can_read_payroll_user_profile(user_id));
