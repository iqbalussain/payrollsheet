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
    "Hrs",
    "Basic",
    "Food Deduct.",
    "Prev. advance",
    "Outstanding",
    "Total",
    "Allocated",
    "Remaining",
  ];
  const lines = rows.map((r) =>
    [
      r.employeeId,
      r.name,
      r.trade,
      r.site,
      r.foreman,
      monthLabel(r.month),
      fmt(r.hours),
      fmt(r.basic),
      fmt(r.foodDeduction),
      fmt(r.previousAdvance),
      fmt(r.outstanding),
      fmt(r.total),
      fmt(r.allocated),
      fmt(r.remaining),
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
