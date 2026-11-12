-- Apply in the payroll database SQL editor: payroll lines are now saved only through the
-- app's server, which checks roles before accepting advance amounts.
revoke insert, update on public.payroll_lines from anon, authenticated;
-- The app still reassigns a line's foreman directly from the browser.
grant update (foreman) on public.payroll_lines to authenticated;
