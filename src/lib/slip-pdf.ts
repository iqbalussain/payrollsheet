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

type RGB = [number, number, number];

const INK: RGB = [24, 29, 35];
const MUTED: RGB = [91, 100, 110];
const BORDER: RGB = [190, 197, 203];
const GREEN: RGB = [54, 157, 117];
const RED: RGB = [204, 69, 70];
const BLUE: RGB = [52, 111, 170];
const GOLD: RGB = [171, 124, 38];

export interface SlipInput {
  employee: Employee;
  month: string;
  row: HistoryRow;
  carriedForward: number;
  outstandingAdvance: number;
}

function money(value: number) {
  return `${fmt(value)} OMR`;
}

function drawLogo(doc: jsPDF, x: number, y: number) {
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1.8);
  doc.line(x + 3, y + 22, x + 3, y + 7);
  doc.line(x + 3, y + 22, x + 29, y + 22);
  doc.line(x + 8, y + 18, x + 8, y + 11);
  doc.line(x + 15, y + 18, x + 15, y + 6);
  doc.line(x + 22, y + 18, x + 22, y + 2);
  doc.setLineWidth(2.2);
  doc.line(x + 4, y + 14, x + 13, y + 19);
  doc.line(x + 13, y + 19, x + 28, y + 5);
  doc.setFillColor(...GOLD);
  doc.triangle(x + 28, y + 5, x + 23.5, y + 6.5, x + 27, y + 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(80, 64, 39);
  doc.text("MITC", x, y + 31);
}

function drawLabelValue(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text(label, x, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(value || "—", x + width, y, { align: "right" });
}

function drawCard(
  doc: jsPDF,
  title: string,
  color: RGB,
  x: number,
  y: number,
  width: number,
  rows: Array<{ label: string; value: string; emphasis?: boolean }>,
  total: { label: string; value: string },
) {
  const height = 77;
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(225, 229, 233);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, width, height, 2, 2, "FD");

  doc.setFillColor(...color);
  doc.roundedRect(x, y, width, 12, 2, 2, "F");
  doc.rect(x, y + 7, width, 5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(title, x + width / 2, y + 8, { align: "center" });

  let rowY = y + 23;
  rows.forEach(({ label, value, emphasis }) => {
    doc.setFont("helvetica", emphasis ? "bold" : "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(label, x + 3, rowY);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...color);
    doc.roundedRect(x + width - 29, rowY - 5.1, 26, 7, 1.5, 1.5, "FD");
    doc.setFont("helvetica", emphasis ? "bold" : "normal");
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    doc.text(value, x + width - 4, rowY, { align: "right" });
    rowY += 12;
  });

  doc.setFillColor(...color);
  doc.roundedRect(x + 2.5, y + height - 11, width - 5, 8, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(total.label, x + 5, y + height - 5.5);
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...color);
  doc.roundedRect(x + width - 28, y + height - 10.5, 25, 7, 1.2, 1.2, "FD");
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(total.value, x + width - 5, y + height - 5.5, { align: "right" });
}

function drawSlip(doc: jsPDF, slip: SlipInput) {
  const { employee: e, month, row } = slip;
  const pageWidth = 210;
  const left = 15;
  const contentWidth = 180;
  const gross = lineGross(row);
  const food = toNum(row.food_deduction);
  const advanceRecovered = toNum(row.prev_advance);
  const other = toNum(row.other_deduction);
  const totalDeductions = food + advanceRecovered + other;
  const net = toNum(row.net_salary);
  const balance = lineBalance(row);
  const status = toNum(row.paid) >= net ? "PAID" : toNum(row.paid) > 0 ? "PARTIAL" : "PENDING";

  doc.setFillColor(252, 253, 254);
  doc.rect(0, 0, pageWidth, 297, "F");

  drawLogo(doc, left, 10);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Modern Investment & Trading Company SPC", 52, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text("Hamriyah, Muscat 112,", 52, 21);
  doc.text("Phone: +968 97260309, Email: mitcoman@zohomail.com", 52, 26);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text("SALARY SLIP", pageWidth / 2, 40, { align: "center" });
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(monthLabel(month).toUpperCase(), pageWidth / 2, 46, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text("STAFF DETAILS:", left, 57);

  const tableY = 61;
  const rowHeight = 10;
  const columns = [left, 51, 113, 151, left + contentWidth];
  const staffRows: Array<[string, string, string, string]> = [
    ["NAME EMPLOYEE:", e.name, "TRADE:", e.trade],
    ["EMP ID NO:", e.id_number || "—", "SALARY MONTH:", monthLabel(month)],
    ["SITE:", row.site || "—", "FOREMAN:", row.foreman || row.batchForeman || "—"],
  ];
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.25);
  staffRows.forEach((values, index) => {
    const y = tableY + index * rowHeight;
    doc.rect(left, y, contentWidth, rowHeight);
    doc.line(columns[1]!, y, columns[1]!, y + rowHeight);
    doc.line(columns[2]!, y, columns[2]!, y + rowHeight);
    doc.line(columns[3]!, y, columns[3]!, y + rowHeight);
    drawLabelValue(doc, values[0], values[1], columns[0]! + 3, y + 6.5, 34);
    drawLabelValue(doc, values[2], values[3], columns[2]! + 3, y + 6.5, 34);
  });

  const cardY = 99;
  const gap = 6;
  const cardWidth = (contentWidth - gap * 2) / 3;
  drawCard(
    doc,
    "INCOME",
    GREEN,
    left,
    cardY,
    cardWidth,
    [
      { label: "SALARY BASIC / HR", value: money(toNum(row.rate)) },
      { label: "TOTAL WORK HOURS", value: `${fmt(toNum(row.hours))} hrs` },
    ],
    { label: "INCOME TOTAL", value: money(gross) },
  );
  drawCard(
    doc,
    "DEDUCTION",
    RED,
    left + cardWidth + gap,
    cardY,
    cardWidth,
    [
      { label: "FOOD DEDUCT", value: money(food) },
      { label: "ADVANCE RECOVERED", value: money(advanceRecovered) },
      { label: "OTHER DEDUCT", value: money(other) },
    ],
    { label: "TOTAL DEDUCT", value: money(totalDeductions) },
  );
  drawCard(
    doc,
    "SUMMARY",
    BLUE,
    left + (cardWidth + gap) * 2,
    cardY,
    cardWidth,
    [
      { label: "TOTAL INCOME", value: money(gross) },
      { label: "TOTAL DEDUCT", value: money(totalDeductions) },
      { label: "NET SALARY", value: money(net), emphasis: true },
      { label: "OUTSTANDING", value: money(slip.outstandingAdvance) },
    ],
    { label: "STATUS", value: status },
  );

  const detailsY = 190;
  doc.setFillColor(245, 247, 249);
  doc.roundedRect(left, detailsY, contentWidth, 25, 2, 2, "F");
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("PAYMENT DETAILS", left + 5, detailsY + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(`Paid this month: ${money(toNum(row.paid))}`, left + 5, detailsY + 15);
  doc.text(`Remaining salary balance: ${money(balance)}`, left + 95, detailsY + 15);
  doc.text(`Advance brought forward: ${money(slip.carriedForward)}`, left + 5, detailsY + 21);
  doc.text(`New advance issued: ${money(toNum(row.new_advance))}`, left + 95, detailsY + 21);

  doc.setDrawColor(150, 156, 163);
  doc.setLineWidth(0.35);
  doc.line(left, 247, left + 56, 247);
  doc.line(left + 124, 247, left + contentWidth, 247);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text("Authorised Signature", left, 253);
  doc.text("Employee Signature", left + 124, 253);
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(
    "This salary slip is computer generated and does not require a company stamp.",
    pageWidth / 2,
    276,
    {
      align: "center",
    },
  );
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
