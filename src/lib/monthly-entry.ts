export interface SiteAssignmentRow {
  site: string;
  foreman: string;
  project_id: string | null;
  foreman_user_id: string | null;
  effective_from: string;
  effective_to: string | null;
}

export interface DaySite {
  site: string;
  projectId: string;
  foreman: string;
  foremanUserId: string;
}

/** Out time = In time + hours, wrapping past midnight. */
export function addHours(inTime: string, hours: number) {
  const [h = 0, m = 0] = inTime.split(":").map(Number);
  const total = (Math.round(h * 60 + m + hours * 60) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Recalculate times when hours are typed in shift-times mode. */
export function syncTimesFromHours(inTime: string, hoursText: string) {
  const hrs = Number(hoursText);
  if (!Number.isFinite(hrs) || hrs <= 0) return null;
  const start = inTime || "06:00";
  return { inTime: start, outTime: addHours(start, hrs) };
}

/** Active deployment for a date (YYYY-MM-DD); null when none (unassigned). */
export function assignmentForDate(assignments: SiteAssignmentRow[] | null | undefined, date: string): DaySite | null {
  const match = (assignments ?? [])
    .filter((a) => a.effective_from <= date && (!a.effective_to || a.effective_to >= date))
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];
  if (!match) return null;
  return {
    site: match.site,
    projectId: match.project_id ?? "",
    foreman: match.foreman,
    foremanUserId: match.foreman_user_id ?? "",
  };
}
