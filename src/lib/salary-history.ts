export interface SalaryHistoryRecord {
  employee_id: number;
  hourly_rate: number;
  effective_from: string | null;
  created_at?: string | undefined;
}

/** New changes use the same canonical date column that payroll reads. */
export function salaryHistoryInsert(employeeId: number, hourlyRate: number, effectiveDate: string) {
  return { employee_id: employeeId, hourly_rate: hourlyRate, effective_from: effectiveDate };
}

/** Accept rows using either `effective_from` or legacy `effective_on`. */
export function normalizeSalaryHistory(
  rows: Array<Record<string, unknown>>,
): SalaryHistoryRecord[] {
  return rows.map((row) => {
    const date = row["effective_from"] ?? row["effective_on"];
    return {
      employee_id: Number(row["employee_id"]),
      hourly_rate: Number(row["hourly_rate"]),
      effective_from: typeof date === "string" ? date.slice(0, 10) : null,
      created_at: typeof row["created_at"] === "string" ? row["created_at"] : undefined,
    };
  });
}

/** Ignore undated legacy rows rather than inventing an effective salary date. */
export function effectiveRateOnDate(
  employeeId: number,
  workDate: string,
  history: SalaryHistoryRecord[],
) {
  return history
    .filter(
      (record): record is SalaryHistoryRecord & { effective_from: string } =>
        record.employee_id === employeeId &&
        typeof record.effective_from === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(record.effective_from) &&
        record.effective_from <= workDate,
    )
    .sort(
      (a, b) =>
        b.effective_from.localeCompare(a.effective_from) ||
        (b.created_at ?? "").localeCompare(a.created_at ?? ""),
    )[0]?.hourly_rate;
}

export function effectiveRateForMonth(
  employeeId: number,
  month: string,
  history: SalaryHistoryRecord[],
) {
  return effectiveRateOnDate(employeeId, `${month}-31`, history);
}
