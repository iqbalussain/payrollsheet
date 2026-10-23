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
): AllocationRow[] {
  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  const linesByPayrollLineId = new Map(
    (payrollLines ?? []).map((line) => [line.id, line]),
  );

  return allocations.map((allocation) => {
    const employee = byId.get(allocation.employee_id);
    const line = linesByPayrollLineId.get(allocation.payroll_line_id);

    const regularHours = Number(allocation.regular_hours);
    const rate = line ? Number(line.rate) : 0;
    const grossSalary = regularHours * rate;
    const foodDeduction = line ? Number(line.food_deduction) : 0;
    const advanceDeduction = line ? Number(line.prev_advance) : 0;
    const outstanding = line ? Number(line.new_advance) : 0;
    const netPay = line ? Number(line.net_pay ?? line.net_salary ?? 0) : grossSalary - foodDeduction - advanceDeduction;
    const paid = line ? Number(line.paid) : 0;
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
