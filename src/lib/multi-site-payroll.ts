/**
 * Multi-site payroll rules (Option A):
 * - Earnings and food deduction are prorated by active attendance days at the site.
 * - Personal advances are recovered only in the batch for the employee's last active
 *   site of the month (latest attendance date), capped so net pay never goes negative.
 */
export type SiteEntry = { work_date: string; site: string; status?: string | null };

const isActive = (e: SiteEntry) => !e.status || e.status === "PRESENT" || e.status === "HALF_DAY";

/** Share of the month's active attendance days worked at `site` (1 when no site filter). */
export function siteDayShare(entries: SiteEntry[], site: string): number {
  if (!site) return 1;
  const all = new Set(entries.filter(isActive).map((e) => e.work_date));
  if (!all.size) return 1;
  const atSite = new Set(
    entries.filter((e) => isActive(e) && e.site.trim() === site).map((e) => e.work_date),
  );
  return atSite.size / all.size;
}

/** Site of the latest active attendance date in the period. */
export function lastActiveSite(entries: SiteEntry[]): string | null {
  const active = entries.filter(isActive).sort((a, b) => a.work_date.localeCompare(b.work_date));
  return active.length ? active[active.length - 1]!.site.trim() : null;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function proratedFood(monthlyFood: number, share: number) {
  return round3(monthlyFood * share);
}

/** Advance deduction for a site batch: 0 unless last site; never above net earnings. */
export function siteAdvanceDeduction(input: {
  pendingAdvance: number;
  grossSitePay: number;
  proratedFood: number;
  isLastSite: boolean;
}) {
  if (!input.isLastSite) return 0;
  const room = Math.max(0, input.grossSitePay - input.proratedFood);
  return round3(Math.max(0, Math.min(input.pendingAdvance, room)));
}
