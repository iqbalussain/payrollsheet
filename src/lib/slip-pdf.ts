import { jsPDF } from "jspdf";
import {
  fmt,
  lineBalance,
  lineGross,
  monthLabel,
  toNum,
  type Employee,
  type HistoryRow,
} from "./payroll";

const NAVY: [number, number, number] = [31, 56, 100];
const GOLD: [number, number, number] = [191, 143, 0];

export interface SlipInput {
  employee: Employee;
  month: string;
  row: HistoryRow;
  carriedForward: number;
  outstandingAdvance: number;
}

function drawSlip(doc: jsPDF, slip: SlipInput) {
  const { employee: e, month, row } = slip;
  const L = 15;
  const W = 180;

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 210, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("SITE PAYROLL MANAGER", L, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Salary Slip — ${monthLabel(month)}`, L, 19);

  doc.setTextColor(40, 40, 40);
  let y = 38;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(e.name, L, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  y += 6;
  doc.text(`Trade: ${e.trade}`, L, y);
  doc.text(`ID No: ${e.id_number || "—"}`, L + 60, y);
  doc.text(`Status: ${e.status}`, L + 120, y);
  y += 5;
  doc.text(`Site: ${row.site || "—"}`, L, y);
  doc.text(`Foreman: ${row.foreman || row.batchForeman || "—"}`, L + 60, y);
  y += 6;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(L, y, L + W, y);

  const rows: Array<[string, string]> = [
    ["Hours worked", fmt(toNum(row.hours))],
    ["Salary / hour (OMR)", fmt(toNum(row.rate))],
    ["Gross salary (OMR)", fmt(lineGross(row))],
    ["Food deduction", `- ${fmt(toNum(row.food_deduction))}`],
    ["Previous advance recovered", `- ${fmt(toNum(row.prev_advance))}`],
    ["Other deductions", `- ${fmt(toNum(row.other_deduction))}`],
    ["Net salary payable (OMR)", fmt(toNum(row.net_salary))],
    ["Paid amount (OMR)", fmt(toNum(row.paid))],
    ["Remaining balance (OMR)", fmt(lineBalance(row))],
    ["New advance issued this month", fmt(toNum(row.new_advance))],
    ["Advance brought forward", fmt(slip.carriedForward)],
    ["Advance outstanding after this month", fmt(slip.outstandingAdvance)],
  ];

  y += 8;
  doc.setFontSize(10);
  rows.forEach(([label, value], i) => {
    const highlight = label.startsWith("Net salary") || label.startsWith("Remaining");
    if (i % 2 === 0) {
      doc.setFillColor(246, 247, 249);
      doc.rect(L, y - 5, W, 8, "F");
    }
    if (highlight) {
      doc.setFillColor(235, 240, 248);
      doc.rect(L, y - 5, W, 8, "F");
      doc.setFont("helvetica", "bold");
    } else {
      doc.setFont("helvetica", "normal");
    }
    doc.text(label, L + 3, y);
    doc.text(value, L + W - 3, y, { align: "right" });
    y += 8;
  });

  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    "Advance balances are carried forward automatically from the previous month.",
    L,
    y,
  );
  y += 18;
  doc.setDrawColor(180, 180, 180);
  doc.line(L, y, L + 55, y);
  doc.line(L + 120, y, L + W, y);
  doc.text("Employee signature", L, y + 5);
  doc.text("Authorised signature", L + 120, y + 5);
}

export function downloadSlips(slips: SlipInput[]) {
  if (!slips.length) return;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  slips.forEach((slip, i) => {
    if (i > 0) doc.addPage();
    drawSlip(doc, slip);
  });
  const name =
    slips.length === 1
      ? `salary-slip-${slips[0]!.employee.name.replace(/\s+/g, "-")}-${slips[0]!.month}.pdf`
      : `salary-slips-${slips[0]!.month}.pdf`;
  doc.save(name);
}
