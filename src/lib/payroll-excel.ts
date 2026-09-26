import JSZip from "jszip";

export interface PayrollImportRow {
  rowNumber: number;
  values: Record<string, string>;
}

const SPREADSHEET_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const RELATIONSHIP_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const MAX_IMPORT_SIZE = 10 * 1024 * 1024;
const MAX_IMPORT_ROWS = 5000;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"' && value.length === 0) {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (quoted) throw new Error("The CSV file contains an unclosed quoted value.");
  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function columnIndex(reference: string): number {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase();
  if (!letters) return -1;
  return [...letters].reduce((index, letter) => index * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function parseXml(xml: string, label: string): Document {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.getElementsByTagName("parsererror").length) {
    throw new Error(`The Excel workbook contains invalid ${label} XML.`);
  }
  return document;
}

function resolveWorkbookPath(target: string): string {
  const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== "." && part) parts.push(part);
  }
  return parts.join("/");
}

async function parseXlsx(file: File): Promise<string[][]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer(), { checkCRC32: true });
  const workbookFile = zip.file("xl/workbook.xml");
  const relationshipsFile = zip.file("xl/_rels/workbook.xml.rels");
  if (!workbookFile || !relationshipsFile) {
    throw new Error("This is not a supported Excel workbook. Save it as .xlsx and try again.");
  }

  const workbook = parseXml(await workbookFile.async("text"), "workbook");
  const relationships = parseXml(await relationshipsFile.async("text"), "relationship");
  const firstSheet = workbook.getElementsByTagNameNS(SPREADSHEET_NS, "sheet")[0];
  if (!firstSheet) throw new Error("The Excel workbook does not contain a worksheet.");

  const relationshipId = firstSheet.getAttributeNS(RELATIONSHIP_NS, "id");
  const relationship = [...relationships.getElementsByTagName("Relationship")].find(
    (item) => item.getAttribute("Id") === relationshipId,
  );
  const target = relationship?.getAttribute("Target");
  if (!target) throw new Error("Could not locate the first worksheet in this workbook.");

  const worksheetFile = zip.file(resolveWorkbookPath(target));
  if (!worksheetFile) throw new Error("Could not read the first worksheet in this workbook.");

  const sharedStringsFile = zip.file("xl/sharedStrings.xml");
  const sharedStrings = sharedStringsFile
    ? [
        ...parseXml(await sharedStringsFile.async("text"), "shared strings").getElementsByTagNameNS(
          SPREADSHEET_NS,
          "si",
        ),
      ].map((item) =>
        [...item.getElementsByTagNameNS(SPREADSHEET_NS, "t")]
          .map((text) => text.textContent ?? "")
          .join(""),
      )
    : [];

  const worksheet = parseXml(await worksheetFile.async("text"), "worksheet");
  const worksheetRows = [...worksheet.getElementsByTagNameNS(SPREADSHEET_NS, "row")];
  if (worksheetRows.length > MAX_IMPORT_ROWS + 1) {
    throw new Error(`The worksheet exceeds the ${MAX_IMPORT_ROWS} row import limit.`);
  }

  const rows: string[][] = [];
  worksheetRows.forEach((worksheetRow, index) => {
    const rowNumber = Number(worksheetRow.getAttribute("r")) || index + 1;
    if (rowNumber > MAX_IMPORT_ROWS + 1) {
      throw new Error(`The worksheet exceeds the ${MAX_IMPORT_ROWS} row import limit.`);
    }
    while (rows.length < rowNumber - 1) rows.push([]);
    const cells: string[] = [];
    for (const cell of worksheetRow.getElementsByTagNameNS(SPREADSHEET_NS, "c")) {
      const index = columnIndex(cell.getAttribute("r") ?? "");
      if (index < 0 || index > 100) continue;
      const type = cell.getAttribute("t");
      const value = cell.getElementsByTagNameNS(SPREADSHEET_NS, "v")[0]?.textContent ?? "";
      const text =
        type === "s"
          ? (sharedStrings[Number(value)] ?? "")
          : type === "inlineStr"
            ? (cell.getElementsByTagNameNS(SPREADSHEET_NS, "is")[0]?.textContent ?? "")
            : value;
      cells[index] = text;
    }
    rows.push(cells.map((cell) => cell ?? ""));
  });
  return rows;
}

function rowsToRecords(rows: string[][]): PayrollImportRow[] {
  const headerIndex = rows.findIndex((row) => row.some((cell) => cell.trim()));
  if (headerIndex < 0) throw new Error("The file is empty.");

  const headers = rows[headerIndex]!.map((header) =>
    header
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ""),
  );
  if (!headers.some(Boolean)) throw new Error("The file is missing a header row.");

  return rows.slice(headerIndex + 1).flatMap((row, index) => {
    const values = Object.fromEntries(
      headers.flatMap((header, column) => (header ? [[header, row[column]?.trim() ?? ""]] : [])),
    );
    return Object.values(values).some(Boolean)
      ? [{ rowNumber: headerIndex + index + 2, values }]
      : [];
  });
}

export async function readPayrollImport(file: File): Promise<PayrollImportRow[]> {
  if (file.size > MAX_IMPORT_SIZE) {
    throw new Error("The file is larger than 10 MB. Please split it into smaller files.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv") return rowsToRecords(parseCsv(await file.text()));
  if (extension !== "xlsx") {
    throw new Error("Choose an .xlsx workbook or a .csv file exported from Excel.");
  }
  return rowsToRecords(await parseXlsx(file));
}

export function downloadPayrollImportTemplate() {
  const headers = [
    "Database ID",
    "Employee ID",
    "Emp ID",
    "Employee",
    "Foreman",
    "Hours",
    "Rate",
    "Food Deduction",
    "Previous Advance",
    "New Advance",
    "Other Deduction",
    "Paid",
  ];
  const csv = `${headers.map((header) => `"${header}"`).join(",")}\r\n`;
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "payroll-import-template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}
