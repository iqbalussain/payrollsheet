import {
  lineGross,
  toNum,
  type Employee,
  type PayrollBatch,
} from "./payroll";

export interface AllocationRow {
  key: string;
  employeeId: string;
  name: string;
  trade: string;
  site: string;
  foreman: string;
  month: string;
  hours: number;
  days: number;
  basic: number;
  overtime: number;
  allowances: number;
  deductions: number;
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
  const rows: AllocationRow[] = [];
  batches.forEach((b) => {
    b.lines.forEach((l, i) => {
      if (!l.employee_id) return;
      const emp = byId.get(String(l.employee_id));
      const hours = toNum(l.hours);
      const basic = lineGross(l);
      const deductions =
        toNum(l.food_deduction) + toNum(l.prev_advance) + toNum(l.other_deduction);
      const total = toNum(l.net_salary);
      const allocated = toNum(l.paid);
      rows.push({
        key: `${b.id}-${l.id ?? i}`,
        employeeId: emp?.id_number?.trim() ? emp.id_number.trim() : "Not Assigned",
        name: emp?.name ?? `Employee #${l.employee_id}`,
        trade: emp?.trade ?? "—",
        site: b.site || "(No Site)",
        foreman: l.foreman || b.foreman || "(No Foreman)",
        month: b.month,
        hours,
        days: Math.round((hours / 8) * 100) / 100,
        basic,
        overtime: 0,
        allowances: 0,
        deductions,
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
    days: sum((r) => r.days),
    basic: sum((r) => r.basic),
    deductions: sum((r) => r.deductions),
    total: sum((r) => r.total),
    allocated: sum((r) => r.allocated),
    remaining: sum((r) => r.remaining),
  };
}
