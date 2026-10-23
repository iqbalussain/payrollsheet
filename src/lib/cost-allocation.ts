import type { Employee } from "./payroll";
import type { PayrollSiteAllocation } from "./payroll-data";
import type { Tables } from "@/integrations/supabase/external-types";

export interface AllocationRow {
  key: string;
  employeeId: string;
  name: string;
  trade: string;
  site: string;
  foreman: string;
  month: string;
  regularHours: number;
  rate: number;
  grossSalary: number;
  foodDeduction: number;
  advanceDeduction: number;
  outstanding: number;
  netPay: number;
  paid: number;
  balance: number;
}

export function buildAllocationRows(
  allocations: PayrollSiteAllocation[],
  employees: Employee[],
  payrollLines?: Tables<"payroll_lines">[],
  openingBalances: ReadonlyMap<number, number> = new Map(),
): AllocationRow[] {
  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  const linesByPayrollLineId = new Map(
    (payrollLines ?? []).map((line) => [line.id, line]),
  );

  const groups = new Map<string, PayrollSiteAllocation[]>();
  for (const allocation of allocations) {
    const group = groups.get(allocation.payroll_line_id) ?? [];
    group.push(allocation);
    groups.set(allocation.payroll_line_id, group);
  }
  const apportioned = new Map<string, number>();
  const share = (allocation: PayrollSiteAllocation, amount: number, field: string) => {
    const group = groups.get(allocation.payroll_line_id) ?? [allocation];
    const totalHours = group.reduce((sum, row) => sum + Number(row.regular_hours) + Number(row.overtime_hours), 0);
    const key = `${allocation.payroll_line_id}:${field}`;
    const value = group.at(-1)?.id === allocation.id
      ? amount - (apportioned.get(key) ?? 0)
      : Math.round(amount * (totalHours > 0 ? (Number(allocation.regular_hours) + Number(allocation.overtime_hours)) / totalHours : 1 / group.length) * 1000) / 1000;
    apportioned.set(key, (apportioned.get(key) ?? 0) + value);
    return Math.round(value * 1000) / 1000;
  };

  return allocations.map((allocation) => {
    const employee = byId.get(allocation.employee_id);
    const line = linesByPayrollLineId.get(allocation.payroll_line_id);

    const regularHours = Number(allocation.regular_hours);
    const rate = line ? Number(line.rate) : Number(employee?.hourly_rate ?? 0);
    const grossSalary = regularHours * rate;
    const foodDeduction = share(allocation, Number(line?.food_deduction ?? 0), "food");
    const advanceDeduction = share(allocation, Number(line?.prev_advance ?? 0), "advance");
    const outstanding = share(allocation, Math.max(0, (openingBalances.get(allocation.employee_id) ?? 0) + Number(line?.new_advance ?? 0) - Number(line?.prev_advance ?? 0)), "outstanding");
    const netPay = line ? share(allocation, Number(line.net_pay ?? line.net_salary ?? 0), "net") : grossSalary - foodDeduction - advanceDeduction;
    const paid = share(allocation, Number(line?.paid ?? 0), "paid");
    const balance = netPay - paid;

    return {
      key: allocation.id,
      employeeId: employee?.id_number?.trim() || String(allocation.employee_id),
      name: employee?.name ?? `Employee #${allocation.employee_id}`,
      trade: employee?.trade ?? "—",
      site: allocation.site,
      foreman: allocation.foreman,
      month: allocation.month,
      regularHours,
      rate,
      grossSalary,
      foodDeduction,
      advanceDeduction,
      outstanding,
      netPay,
      paid,
      balance,
    };
  });
}

export function allocationTotals(rows: AllocationRow[]) {
  const sum = (field: (row: AllocationRow) => number) =>
    rows.reduce((total, row) => total + field(row), 0);
  return {
    staff: new Set(rows.map((row) => row.employeeId)).size,
    regularHours: sum((row) => row.regularHours),
    grossSalary: sum((row) => row.grossSalary),
    foodDeduction: sum((row) => row.foodDeduction),
    advanceDeduction: sum((row) => row.advanceDeduction),
    outstanding: sum((row) => row.outstanding),
    netPay: sum((row) => row.netPay),
    paid: sum((row) => row.paid),
    balance: sum((row) => row.balance),
  };
}
