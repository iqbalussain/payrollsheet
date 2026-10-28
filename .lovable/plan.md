# Monthly Entry: hours/time sync and automatic site

## 1. Hours ↔ time sync (shift times mode)
- Today, in shift times mode the Hours cell is read-only and only changes when In/Out change.
- Make Hours editable in shift times mode too. Typing hours keeps the In time (or 6:00 AM if empty) and recalculates Out time = In + hours (wraps past midnight).
- Editing In/Out keeps working as now (recalculates hours). Total hours mode stays unchanged.
- Bulk "fill schedule" with hours and times keeps the same behaviour.

## 2. Automatic site from deployment records
- Load the selected employee's site assignments (same records Workforce and Daily Attendance already use).
- For each day of the month, find the assignment active on that date (effective from ≤ date and no end date or end date ≥ date) and use its site/project and foreman.
- Applies when a day is first marked, during bulk fill, and when opening an employee with no saved records for a day. Saved days are never overwritten.
- If no active assignment exists for a date, fall back to the current default site/foreman selection.
- A transfer mid-month results in the correct site before and after the transfer date.

## Technical details
- `MonthlyAttendanceDialog.tsx`: in `updateDay`, handle `patch.totalHours` when not in manual mode by computing `outTime` from `inTime`; render an editable number input in both modes.
- Add a query for `employee_site_assignments` filtered by `employee_id` and overlapping the month; helper `assignmentForDate(day)` used in `updateDay`, `fillSingleSchedule`, and default application.
- Add e2e tests: hours edit updates Out time; day after a transfer date gets the new site.
