-- Migration: 20261110000000_nexuspay_features.sql
-- Production security layer and schema extensions for Nexuspay

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--------------------------------------------------------------------------------
-- 1. Employees RLS policies
--------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.employees ENABLE ROW LEVEL SECURITY;

-- Explicitly drop policies if they exist to avoid 42710 duplicate errors
DROP POLICY IF EXISTS "employees_public_all" ON public.employees;
DROP POLICY IF EXISTS "employees_admin_mutations" ON public.employees;
DROP POLICY IF EXISTS "employees_read_authenticated" ON public.employees;
DROP POLICY IF EXISTS "employees_admin_insert" ON public.employees;
DROP POLICY IF EXISTS "employees_admin_update" ON public.employees;
DROP POLICY IF EXISTS "employees_admin_delete" ON public.employees;

-- Read access for all authenticated users
CREATE POLICY "employees_read_authenticated"
  ON public.employees
  FOR SELECT
  TO authenticated
  USING (true);

-- Restrict INSERT, UPDATE, DELETE strictly to iqbalussain@gmail.com
CREATE POLICY "employees_admin_insert"
  ON public.employees
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'iqbalussain@gmail.com'
  );

CREATE POLICY "employees_admin_update"
  ON public.employees
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'iqbalussain@gmail.com'
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'iqbalussain@gmail.com'
  );

CREATE POLICY "employees_admin_delete"
  ON public.employees
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'iqbalussain@gmail.com'
  );

--------------------------------------------------------------------------------
-- 2. Site Allocations Table & RLS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  site_name TEXT NOT NULL,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  trade TEXT NOT NULL DEFAULT 'GENERAL',
  worker_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.site_allocations
  ADD COLUMN IF NOT EXISTS site_name TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS trade TEXT,
  ADD COLUMN IF NOT EXISTS worker_count INT DEFAULT 0;

ALTER TABLE public.site_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_allocations_read_authenticated" ON public.site_allocations;
DROP POLICY IF EXISTS "site_allocations_admin_insert" ON public.site_allocations;
DROP POLICY IF EXISTS "site_allocations_admin_update" ON public.site_allocations;
DROP POLICY IF EXISTS "site_allocations_admin_delete" ON public.site_allocations;

CREATE POLICY "site_allocations_read_authenticated"
  ON public.site_allocations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "site_allocations_admin_insert"
  ON public.site_allocations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'iqbalussain@gmail.com'
  );

CREATE POLICY "site_allocations_admin_update"
  ON public.site_allocations
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'iqbalussain@gmail.com'
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'iqbalussain@gmail.com'
  );

CREATE POLICY "site_allocations_admin_delete"
  ON public.site_allocations
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'iqbalussain@gmail.com'
  );

--------------------------------------------------------------------------------
-- 3. Attendance Table & RLS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id BIGINT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  site_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  work_date DATE NOT NULL,
  verified_hours NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (verified_hours >= 0 AND verified_hours <= 24),
  overtime_hours NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (overtime_hours >= 0 AND overtime_hours <= 24),
  status TEXT NOT NULL DEFAULT 'PRESENT',
  foreman TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT attendance_employee_work_date_unique UNIQUE (employee_id, work_date)
);

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS employee_id BIGINT,
  ADD COLUMN IF NOT EXISTS site_id UUID,
  ADD COLUMN IF NOT EXISTS work_date DATE,
  ADD COLUMN IF NOT EXISTS verified_hours NUMERIC(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PRESENT',
  ADD COLUMN IF NOT EXISTS foreman TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS attendance_work_date_idx ON public.attendance (work_date DESC);
CREATE INDEX IF NOT EXISTS attendance_site_work_date_idx ON public.attendance (site_id, work_date DESC);
CREATE INDEX IF NOT EXISTS attendance_employee_work_date_idx ON public.attendance (employee_id, work_date DESC);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_read_authenticated" ON public.attendance;
DROP POLICY IF EXISTS "attendance_foremen_insert" ON public.attendance;
DROP POLICY IF EXISTS "attendance_foremen_update" ON public.attendance;
DROP POLICY IF EXISTS "attendance_admin_delete" ON public.attendance;

CREATE POLICY "attendance_read_authenticated"
  ON public.attendance
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "attendance_foremen_insert"
  ON public.attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "attendance_foremen_update"
  ON public.attendance
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "attendance_admin_delete"
  ON public.attendance
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'iqbalussain@gmail.com'
  );

--------------------------------------------------------------------------------
-- Grants & Schema Reload
--------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_allocations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.site_allocations TO service_role;
GRANT ALL ON public.attendance TO service_role;

NOTIFY pgrst, 'reload schema';