ALTER TABLE public.employees
  ADD COLUMN default_food_deduction NUMERIC(12, 3) NOT NULL DEFAULT 0
    CHECK (default_food_deduction >= 0);

ALTER TABLE public.payroll_settings
  ADD COLUMN default_food_deduction NUMERIC(12, 3) NOT NULL DEFAULT 0
    CHECK (default_food_deduction >= 0);

UPDATE public.employees AS employee
SET default_food_deduction = (
  SELECT line.food_deduction
  FROM public.payroll_lines AS line
  WHERE line.employee_id = employee.id
  ORDER BY line.month DESC, line.created_at DESC
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1
  FROM public.payroll_lines AS line
  WHERE line.employee_id = employee.id
);

CREATE UNIQUE INDEX employees_id_number_normalized_unique_idx
  ON public.employees (lower(btrim(id_number)))
  WHERE id_number IS NOT NULL AND btrim(id_number) <> '';

CREATE OR REPLACE FUNCTION public.has_payroll_role(required_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users AS profile
    WHERE profile.user_id = auth.uid()
      AND profile.is_active
      AND profile.role = ANY (required_roles)
      AND lower(coalesce(profile.email, auth.jwt() ->> 'email', ''))
          <> 'iqbalussain@gmail.com'
  );
$$;

REVOKE ALL ON FUNCTION public.has_payroll_role(TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_payroll_role(TEXT[]) TO authenticated;

CREATE POLICY employees_delete_only_read
  ON public.employees FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users AS profile
      WHERE profile.user_id = auth.uid()
        AND profile.is_active
        AND lower(coalesce(profile.email, auth.jwt() ->> 'email', ''))
            = 'iqbalussain@gmail.com'
    )
  );

CREATE POLICY payroll_batches_delete_only_read
  ON public.payroll_batches FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users AS profile
      WHERE profile.user_id = auth.uid()
        AND profile.is_active
        AND lower(coalesce(profile.email, auth.jwt() ->> 'email', ''))
            = 'iqbalussain@gmail.com'
    )
  );

CREATE POLICY projects_delete_only_read
  ON public.projects FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users AS profile
      WHERE profile.user_id = auth.uid()
        AND profile.is_active
        AND lower(coalesce(profile.email, auth.jwt() ->> 'email', ''))
            = 'iqbalussain@gmail.com'
    )
  );

CREATE OR REPLACE FUNCTION public.delete_employee_with_history(target_employee_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'This operation is available only through the authorized payroll endpoint';
  END IF;

  DELETE FROM public.timesheets WHERE employee_id = target_employee_id;
  DELETE FROM public.employee_site_assignments WHERE employee_id = target_employee_id;
  DELETE FROM public.employee_transfer_requests WHERE employee_id = target_employee_id;
  DELETE FROM public.employee_salary_history WHERE employee_id = target_employee_id;

  IF to_regclass('public.leave_requests') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.leave_requests WHERE employee_id = $1' USING target_employee_id;
  END IF;
  IF to_regclass('public.advance_transactions') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.advance_transactions WHERE employee_id = $1' USING target_employee_id;
  END IF;

  DELETE FROM public.employees WHERE id = target_employee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee % was not found', target_employee_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_project_with_assignments(target_project_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'This operation is available only through the authorized payroll endpoint';
  END IF;

  DELETE FROM public.manager_project_assignments WHERE project_id = target_project_id;
  DELETE FROM public.projects WHERE id = target_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project % was not found', target_project_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_employee_with_history(BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_project_with_assignments(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_employee_with_history(BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_project_with_assignments(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
