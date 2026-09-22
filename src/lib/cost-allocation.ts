import { lineGross, toNum, type Employee, type PayrollBatch } from "./payroll";

export interface AllocationRow {
  key: string;
  employeeId: string;
  name: string;
  trade: string;
  site: string;
  foreman: string;
  month: string;
  hours: number;
  basic: number;
  foodDeduction: number;
  outstanding: number;
  total: number;
  allocated: number;
  allocationPct: number;
  remaining: number;
}

/** Flatten every payroll line into a cost-allocation record. */
export function buildAllocationRows(
  batches: PayrollBatch[],
  employees: Employee[],
): AllocationRow[] {
  const byId = new Map(employees.map((e) => [String(e.id), e]));
  const advances = new Map<string, number>();
  const rows: AllocationRow[] = [];
  [...batches]
    .sort((a, b) => a.month.localeCompare(b.month))
    .forEach((b) => {
      b.lines.forEach((l, i) => {
        if (!l.employee_id) return;
        const emp = byId.get(String(l.employee_id));
        const hours = toNum(l.hours);
        const basic = lineGross(l);
        const total = toNum(l.net_salary);
        const allocated = toNum(l.paid);
        const employeeKey = String(l.employee_id);
        const outstanding =
          (advances.get(employeeKey) ?? 0) + toNum(l.new_advance) - toNum(l.prev_advance);
        advances.set(employeeKey, Math.max(0, outstanding));
        rows.push({
          key: `${b.id}-${l.id ?? i}`,
          employeeId: emp?.id_number?.trim() ? emp.id_number.trim() : "Not Assigned",
          name: emp?.name ?? `Employee #${l.employee_id}`,
          trade: emp?.trade ?? "—",
          site: b.site || "(No Site)",
          foreman: l.foreman || b.foreman || "(No Foreman)",
          month: b.month,
          hours,
          basic,
          foodDeduction: toNum(l.food_deduction),
          outstanding: Math.max(0, outstanding),
          total,
          allocated,
          allocationPct: total > 0 ? (allocated / total) * 100 : 0,
          remaining: total - allocated,
        });
      });
    });
  return rows;
}

export function allocationTotals(rows: AllocationRow[]) {
  const sum = (f: (r: AllocationRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  return {
    staff: new Set(rows.map((r) => r.name)).size,
    hours: sum((r) => r.hours),
    basic: sum((r) => r.basic),
    foodDeduction: sum((r) => r.foodDeduction),
    outstanding: sum((r) => r.outstanding),
    total: sum((r) => r.total),
    allocated: sum((r) => r.allocated),
    remaining: sum((r) => r.remaining),
  };
}
