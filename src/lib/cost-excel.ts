import { fmt, monthLabel } from "./payroll";
import type { AllocationRow } from "./cost-allocation";
import { costReportFilename, type CostReportMeta } from "./cost-pdf";

function escapeCsv(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function downloadCostExcel(rows: AllocationRow[], meta: CostReportMeta) {
  if (!rows.length) return;
  const headers = [
    "Emp ID",
    "Employee",
    "Trade",
    "Site",
    "Foreman",
    "Month",
    "Hours",
    "Gross Salary",
    "Food Deduction",
    "Advance Deduction",
    "Outstanding",
    "Net Pay",
  ];
  const lines = rows.map((r) =>
    [
      r.employeeId,
      r.name,
      r.trade,
      r.site,
      r.foreman,
      monthLabel(r.month),
      fmt(r.regularHours),
      fmt(r.grossSalary),
      fmt(r.foodDeduction),
      fmt(r.advanceDeduction),
      fmt(r.outstanding),
      fmt(r.netPay),
    ]
      .map(escapeCsv)
      .join(","),
  );
  const csv = [headers.map(escapeCsv).join(","), ...lines].join("\r\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = costReportFilename(meta).replace(/\.pdf$/, ".csv");
  anchor.click();
  URL.revokeObjectURL(url);
}
