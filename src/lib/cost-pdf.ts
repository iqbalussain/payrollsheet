import { jsPDF } from "jspdf";
import { fmt, monthLabel } from "./payroll";
import { allocationTotals, type AllocationRow } from "./cost-allocation";

const NAVY: [number, number, number] = [31, 56, 100];
const GOLD: [number, number, number] = [191, 143, 0];

export const COMPANY_NAME = "Site Payroll Manager";

export interface CostReportMeta {
  month?: string;
  site?: string;
  foreman?: string;
}

function buildDoc(rows: AllocationRow[], meta: CostReportMeta) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const L = 10;
  const W = 277;

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 297, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(COMPANY_NAME.toUpperCase(), L, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    [
      `Cost Allocation Report`,
      meta.month ? monthLabel(meta.month) : "All months",
      meta.site ? `Site: ${meta.site}` : "All sites",
      meta.foreman ? `Foreman: ${meta.foreman}` : "All foremen",
    ].join("   |   "),
    L,
    18,
  );

  const cols: Array<[string, number, "l" | "r"]> = [
    ["Emp ID", 22, "l"],
    ["Name", 40, "l"],
    ["Site", 30, "l"],
    ["Foreman", 28, "l"],
    ["Month", 20, "l"],
    ["Days", 14, "r"],
    ["Basic", 22, "r"],
    ["OT", 14, "r"],
    ["Allow.", 16, "r"],
    ["Deduct.", 20, "r"],
    ["Total", 22, "r"],
    ["Allocated", 22, "r"],
    ["%", 12, "r"],
    ["Remaining", 22, "r"],
  ];

  const drawHead = (y: number) => {
    doc.setFillColor(...NAVY);
    doc.rect(L, y - 5, W, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    let x = L + 2;
    cols.forEach(([label, w, align]) => {
      doc.text(label, align === "r" ? x + w - 4 : x, y, {
        align: align === "r" ? "right" : "left",
      });
      x += w;
    });
    doc.setTextColor(40, 40, 40);
    doc.setFont("helvetica", "normal");
  };

  let y = 34;
  drawHead(y);
  y += 7;
  doc.setFontSize(7.5);

  rows.forEach((r, i) => {
    if (y > 190) {
      doc.addPage();
      y = 20;
      drawHead(y);
      y += 7;
    }
    if (i % 2 === 0) {
      doc.setFillColor(246, 247, 249);
      doc.rect(L, y - 4.5, W, 6.5, "F");
    }
    const values: string[] = [
      r.employeeId,
      r.name,
      r.site,
      r.foreman,
      r.month,
      fmt(r.days),
      fmt(r.basic),
      fmt(r.overtime),
      fmt(r.allowances),
      fmt(r.deductions),
      fmt(r.total),
      fmt(r.allocated),
      `${r.allocationPct.toFixed(0)}%`,
      fmt(r.remaining),
    ];
    let x = L + 2;
    values.forEach((v, ci) => {
      const [, w, align] = cols[ci]!;
      const text = align === "l" ? doc.splitTextToSize(v, w - 3)[0] ?? "" : v;
      doc.text(String(text), align === "r" ? x + w - 4 : x, y, {
        align: align === "r" ? "right" : "left",
      });
      x += w;
    });
    y += 6.5;
  });

  const t = allocationTotals(rows);
  if (y > 180) {
    doc.addPage();
    y = 20;
  }
  y += 2;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(L, y, L + W, y);
  y += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(
    `Total staff: ${t.staff}    Total days: ${fmt(t.days)}    Total salary: ${fmt(
      t.total,
    )} OMR    Total allocated: ${fmt(t.allocated)} OMR    Remaining: ${fmt(t.remaining)} OMR`,
    L,
    y,
  );

  return doc;
}

export function costReportFilename(meta: CostReportMeta) {
  const parts = ["cost-allocation", meta.month || "all-months", meta.site || ""].filter(Boolean);
  return `${parts.join("-").replace(/\s+/g, "-").toLowerCase()}.pdf`;
}

export function downloadCostReport(rows: AllocationRow[], meta: CostReportMeta) {
  if (!rows.length) return;
  buildDoc(rows, meta).save(costReportFilename(meta));
}

export function costReportBlob(rows: AllocationRow[], meta: CostReportMeta) {
  return buildDoc(rows, meta).output("blob") as Blob;
}
