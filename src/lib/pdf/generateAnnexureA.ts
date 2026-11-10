import { jsPDF } from "jspdf";
import { dbAny } from "@/integrations/supabase/external-client";
import { fmt, monthLabel, toNum } from "@/lib/payroll";

const NAVY: [number, number, number] = [20, 40, 75];
const ACCENT: [number, number, number] = [191, 143, 0]; // Gold
const TEXT_DARK: [number, number, number] = [25, 30, 40];
const MUTED: [number, number, number] = [100, 110, 125];
const BORDER: [number, number, number] = [220, 225, 230];
const LIGHT_BG: [number, number, number] = [248, 250, 252];

export interface WorkerAttendanceSummary {
  employeeId: number;
  name: string;
  civilId: string;
  trade: string;
  manDays: number;
  verifiedHours: number;
  overtimeHours: number;
  totalHours: number;
  remarks: string;
}

export interface AnnexureAData {
  siteName: string;
  siteLocation?: string;
  month: string;
  periodLabel: string;
  workers: WorkerAttendanceSummary[];
  totalWorkers: number;
  totalManDays: number;
  totalVerifiedHours: number;
  totalOvertimeHours: number;
  grandTotalHours: number;
  contractorName?: string;
  consultantName?: string;
}

/**
 * Fetches attendance and shift data for a site and month, aggregating per employee.
 */
export async function fetchAnnexureAData(siteIdOrName: string, month: string): Promise<AnnexureAData> {
  // 1. Resolve site information
  let siteName = siteIdOrName;
  let siteLocation = "";
  let resolvedProjectId: string | null = null;

  try {
    const { data: project } = await dbAny
      .from("projects")
      .select("id, name, location")
      .or(`id.eq.${siteIdOrName},name.eq.${siteIdOrName}`)
      .maybeSingle();

    if (project) {
      siteName = project.name;
      siteLocation = project.location || "";
      resolvedProjectId = project.id;
    }
  } catch {
    // If not found by UUID, siteName remains as passed
  }

  // 2. Fetch all employees for name and ID resolution
  const { data: employeesData } = await dbAny
    .from("employees")
    .select("id, name, id_number, trade");

  const empMap = new Map<number, { name: string; civilId: string; trade: string }>();
  (employeesData ?? []).forEach((e: { id: number; name: string; id_number?: string; trade?: string }) => {
    empMap.set(Number(e.id), {
      name: e.name,
      civilId: e.id_number || String(e.id),
      trade: e.trade || "HELPER",
    });
  });

  // 3. Try fetching from the attendance table first
  const [year, monthPart] = month.split("-");
  const startDate = `${year}-${monthPart}-01`;
  const lastDay = new Date(Number(year), Number(monthPart), 0).getDate();
  const endDate = `${year}-${monthPart}-${String(lastDay).padStart(2, "0")}`;

  let attendanceRows: Array<{
    employee_id: number;
    verified_hours?: number;
    overtime_hours?: number;
    status?: string;
    work_date?: string;
  }> = [];

  try {
    let attQuery = dbAny
      .from("attendance")
      .select("employee_id, verified_hours, overtime_hours, status, work_date")
      .gte("work_date", startDate)
      .lte("work_date", endDate);

    if (resolvedProjectId) {
      attQuery = attQuery.eq("site_id", resolvedProjectId);
    }

    const { data: attData, error: attErr } = await attQuery;
    if (!attErr && attData && attData.length > 0) {
      attendanceRows = attData;
    }
  } catch {
    // Fall back to timesheets
  }

  // 4. If attendance table returned no records, fall back to timesheets table
  if (attendanceRows.length === 0) {
    try {
      const { data: tsData } = await dbAny
        .from("timesheets")
        .select("employee_id, site, total_hours, regular_hours, overtime_hours, status, work_date")
        .gte("work_date", startDate)
        .lte("work_date", endDate)
        .ilike("site", `%${siteName}%`);

      if (tsData && tsData.length > 0) {
        attendanceRows = tsData.map((ts: {
          employee_id: number;
          total_hours?: number;
          regular_hours?: number;
          overtime_hours?: number;
          status?: string;
          work_date?: string;
        }) => ({
          employee_id: Number(ts.employee_id),
          verified_hours: Number(ts.regular_hours || ts.total_hours || 0),
          overtime_hours: Number(ts.overtime_hours || 0),
          status: ts.status || "PRESENT",
          work_date: ts.work_date,
        }));
      }
    } catch {
      // Continue with empty or whatever found
    }
  }

  // 5. Aggregate metrics per worker
  const workerAggMap = new Map<number, WorkerAttendanceSummary>();

  for (const row of attendanceRows) {
    const empId = Number(row.employee_id);
    const empInfo = empMap.get(empId) ?? {
      name: `Employee #${empId}`,
      civilId: String(empId),
      trade: "GENERAL",
    };

    const isPresent = row.status !== "ABSENT";
    const vHours = Number(row.verified_hours || 0);
    const otHours = Number(row.overtime_hours || 0);

    const existing = workerAggMap.get(empId) ?? {
      employeeId: empId,
      name: empInfo.name,
      civilId: empInfo.civilId,
      trade: empInfo.trade,
      manDays: 0,
      verifiedHours: 0,
      overtimeHours: 0,
      totalHours: 0,
      remarks: "Verified",
    };

    if (isPresent && (vHours > 0 || otHours > 0)) {
      existing.manDays += 1;
    }
    existing.verifiedHours += vHours;
    existing.overtimeHours += otHours;
    existing.totalHours += vHours + otHours;

    workerAggMap.set(empId, existing);
  }

  const workers = Array.from(workerAggMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  const totalWorkers = workers.length;
  const totalManDays = workers.reduce((acc, w) => acc + w.manDays, 0);
  const totalVerifiedHours = workers.reduce((acc, w) => acc + w.verifiedHours, 0);
  const totalOvertimeHours = workers.reduce((acc, w) => acc + w.overtimeHours, 0);
  const grandTotalHours = workers.reduce((acc, w) => acc + w.totalHours, 0);

  return {
    siteName,
    siteLocation,
    month,
    periodLabel: monthLabel(month),
    workers,
    totalWorkers,
    totalManDays,
    totalVerifiedHours,
    totalOvertimeHours,
    grandTotalHours,
    contractorName: "Nexuspay Contractor Services LLC",
    consultantName: "Supervising Project Consultant",
  };
}

/**
 * Generates and downloads the contractor-ready Annexure A PDF.
 */
export async function exportAnnexureAPDF(siteIdOrName: string, month: string): Promise<Blob> {
  const data = await fetchAnnexureAData(siteIdOrName, month);

  // A4 Portrait: 210 x 297 mm
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = 210;
  const pageHeight = 297;
  const marginLeft = 14;
  const marginRight = 14;
  const contentWidth = pageWidth - marginLeft - marginRight;

  let currentY = 14;

  const drawHeader = (pageNumber: number, totalPages: number) => {
    // Top banner block
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageWidth, 28, "F");

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("ANNEXURE A: VERIFIED SITE PERFORMANCE & ATTENDANCE LOG", marginLeft, 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(220, 225, 235);
    doc.text(
      `Site: ${data.siteName.toUpperCase()} ${data.siteLocation ? `(${data.siteLocation})` : ""}   |   Billing Period: ${data.periodLabel.toUpperCase()}`,
      marginLeft,
      19,
    );
    doc.text(
      `Generated: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}   |   Page ${pageNumber} of ${totalPages}`,
      marginLeft,
      24,
    );

    // Accent line
    doc.setFillColor(...ACCENT);
    doc.rect(0, 27.5, pageWidth, 1.5, "F");
  };

  const drawProjectSummaryBox = (y: number) => {
    doc.setFillColor(...LIGHT_BG);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(marginLeft, y, contentWidth, 22, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text("SITE PERFORMANCE METRICS", marginLeft + 5, y + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);

    const colW = contentWidth / 4;
    // Col 1
    doc.text("Active Workforce:", marginLeft + 5, y + 12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_DARK);
    doc.text(`${data.totalWorkers} Workers`, marginLeft + 5, y + 17);

    // Col 2
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text("Verified Man-Days:", marginLeft + colW + 5, y + 12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_DARK);
    doc.text(`${fmt(data.totalManDays)} Days`, marginLeft + colW + 5, y + 17);

    // Col 3
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text("Regular Shift Hours:", marginLeft + colW * 2 + 5, y + 12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_DARK);
    doc.text(`${fmt(data.totalVerifiedHours)} hrs`, marginLeft + colW * 2 + 5, y + 17);

    // Col 4
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text("Overtime / Grand Total:", marginLeft + colW * 3 + 5, y + 12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text(`${fmt(data.totalOvertimeHours)} OT / ${fmt(data.grandTotalHours)} Total`, marginLeft + colW * 3 + 5, y + 17);

    return y + 26;
  };

  // Table Column Definitions
  // Total width: 182mm
  const cols = [
    { label: "#", width: 10, align: "center" as const },
    { label: "Worker Name", width: 48, align: "left" as const },
    { label: "Civil ID", width: 28, align: "left" as const },
    { label: "Trade", width: 28, align: "left" as const },
    { label: "Man-Days", width: 20, align: "right" as const },
    { label: "Reg. Hours", width: 22, align: "right" as const },
    { label: "OT Hours", width: 26, align: "right" as const },
  ];

  const drawTableHeader = (y: number) => {
    doc.setFillColor(...NAVY);
    doc.rect(marginLeft, y, contentWidth, 7, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);

    let x = marginLeft;
    for (const c of cols) {
      const textX = c.align === "right" ? x + c.width - 2 : c.align === "center" ? x + c.width / 2 : x + 2;
      doc.text(c.label, textX, y + 4.8, { align: c.align });
      x += c.width;
    }

    return y + 7;
  };

  const drawDualVerificationBlock = (y: number) => {
    const blockHeight = 44;
    const boxWidth = (contentWidth - 8) / 2;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text("DUAL VERIFICATION & STATUTORY AUDIT SIGN-OFF", marginLeft, y + 5);

    const bY = y + 8;

    // Left Block: Contractor / Site Foreman
    doc.setFillColor(...LIGHT_BG);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(marginLeft, bY, boxWidth, blockHeight, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...NAVY);
    doc.text("1. PREPARED BY CONTRACTOR / FOREMAN", marginLeft + 4, bY + 5.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text("I hereby certify that the above recorded attendance and shift", marginLeft + 4, bY + 10);
    doc.text("hours accurately represent actual site works performed.", marginLeft + 4, bY + 13.5);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_DARK);
    doc.text("Representative Name: _______________________", marginLeft + 4, bY + 22);
    doc.text("Designation: Site Foreman / Timekeeper", marginLeft + 4, bY + 27);
    doc.text("Signature & Stamp: ________________________", marginLeft + 4, bY + 33);
    doc.text("Date: ____ / ____ / 2026", marginLeft + 4, bY + 39);

    // Right Block: Supervising Consultant / Client
    const rightX = marginLeft + boxWidth + 8;
    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(rightX, bY, boxWidth, blockHeight, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...NAVY);
    doc.text("2. VERIFIED & APPROVED BY CONSULTANT / CLIENT", rightX + 4, bY + 5.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text("Performance and site presence verified against daily logs", rightX + 4, bY + 10);
    doc.text("and approved for progress billing / wage disbursement.", rightX + 4, bY + 13.5);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_DARK);
    doc.text("Consultant / Engineer: ______________________", rightX + 4, bY + 22);
    doc.text("Organisation: Client Project Management", rightX + 4, bY + 27);
    doc.text("Authorised Signature: ______________________", rightX + 4, bY + 33);
    doc.text("Date: ____ / ____ / 2026", rightX + 4, bY + 39);

    return bY + blockHeight + 6;
  };

  // Build Pages
  // First, estimate pages
  currentY = 32;
  currentY = drawProjectSummaryBox(currentY);
  currentY = drawTableHeader(currentY);

  const rowHeight = 6;
  const rows = data.workers.length > 0 ? data.workers : [
    {
      employeeId: 0,
      name: "No attendance logs recorded for selected site & month",
      civilId: "-",
      trade: "-",
      manDays: 0,
      verifiedHours: 0,
      overtimeHours: 0,
      totalHours: 0,
      remarks: "Empty",
    },
  ];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;

    // Check if we need a new page (leave 60mm for footer signature block on final page or 15mm on others)
    const spaceNeeded = (i === rows.length - 1) ? 65 : 15;
    if (currentY + rowHeight > pageHeight - spaceNeeded) {
      doc.addPage();
      currentY = 32;
      currentY = drawTableHeader(currentY);
    }

    // Alternating row background
    if (i % 2 === 1) {
      doc.setFillColor(...LIGHT_BG);
      doc.rect(marginLeft, currentY, contentWidth, rowHeight, "F");
    }

    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.15);
    doc.line(marginLeft, currentY + rowHeight, marginLeft + contentWidth, currentY + rowHeight);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_DARK);

    let x = marginLeft;
    const rowValues = [
      { text: row.employeeId > 0 ? String(i + 1) : "-", width: cols[0]!.width, align: cols[0]!.align },
      { text: row.name, width: cols[1]!.width, align: cols[1]!.align },
      { text: row.civilId, width: cols[2]!.width, align: cols[2]!.align },
      { text: row.trade, width: cols[3]!.width, align: cols[3]!.align },
      { text: String(row.manDays), width: cols[4]!.width, align: cols[4]!.align },
      { text: `${row.verifiedHours.toFixed(1)} h`, width: cols[5]!.width, align: cols[5]!.align },
      { text: `${row.overtimeHours.toFixed(1)} h`, width: cols[6]!.width, align: cols[6]!.align },
    ];

    for (const val of rowValues) {
      const textX = val.align === "right" ? x + val.width - 2 : val.align === "center" ? x + val.width / 2 : x + 2;
      doc.text(val.text, textX, currentY + 4.2, { align: val.align });
      x += val.width;
    }

    currentY += rowHeight;
  }

  // Draw Totals row
  doc.setFillColor(...LIGHT_BG);
  doc.rect(marginLeft, currentY, contentWidth, 7, "F");
  doc.setDrawColor(...BORDER);
  doc.line(marginLeft, currentY, marginLeft + contentWidth, currentY);
  doc.line(marginLeft, currentY + 7, marginLeft + contentWidth, currentY + 7);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...NAVY);
  doc.text("TOTALS", marginLeft + 5, currentY + 4.8);

  doc.text(`${data.totalManDays}`, marginLeft + cols[0]!.width + cols[1]!.width + cols[2]!.width + cols[3]!.width + cols[4]!.width - 2, currentY + 4.8, { align: "right" });
  doc.text(`${data.totalVerifiedHours.toFixed(1)} h`, marginLeft + cols[0]!.width + cols[1]!.width + cols[2]!.width + cols[3]!.width + cols[4]!.width + cols[5]!.width - 2, currentY + 4.8, { align: "right" });
  doc.text(`${data.totalOvertimeHours.toFixed(1)} h`, marginLeft + contentWidth - 2, currentY + 4.8, { align: "right" });

  currentY += 12;

  // Dual verification signature blocks
  if (currentY + 50 > pageHeight) {
    doc.addPage();
    currentY = 32;
  }

  drawDualVerificationBlock(currentY);

  // Apply header & footer to each page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawHeader(p, totalPages);

    // Footer note
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text(
      "Nexuspay Verified Site Performance & Attendance Log (Annexure A) — Confirmed strictly for operational and payroll audits.",
      pageWidth / 2,
      pageHeight - 6,
      { align: "center" },
    );
  }

  const blob = doc.output("blob");
  const fileName = `Annexure_A_${data.siteName.replace(/[^a-zA-Z0-9_-]/g, "_")}_${data.month}.pdf`;

  // Trigger download in browser
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return blob;
}
