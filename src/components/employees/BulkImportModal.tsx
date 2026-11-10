import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/external-client";
import { TRADES, type Employee } from "@/lib/payroll";
import { useProjects } from "@/lib/management-data";
import { btnGold, btnOutline, card, input, select } from "@/components/payroll/ui";

const BATCH_SIZE = 50;

export interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  notify: (msg: string, tone?: "ok" | "warn") => void;
  existingEmployees?: Employee[];
}

interface ParsedEmployeeRow {
  rowNumber: number;
  name: string;
  civilId: string;
  trade: string;
  dailyRate: number;
  hourlyRate: number;
  errors: string[];
}

export function BulkImportModal({
  isOpen,
  onClose,
  onSuccess,
  notify,
  existingEmployees = [],
}: BulkImportModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectsQuery = useProjects();

  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedEmployeeRow[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedSiteName, setSelectedSiteName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; percent: number } | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [filterErrorOnly, setFilterErrorOnly] = useState(false);

  const existingCivilIds = useMemo(() => {
    return new Set(
      existingEmployees
        .map((e) => (e.id_number ? String(e.id_number).trim().toLowerCase() : ""))
        .filter(Boolean),
    );
  }, [existingEmployees]);

  const existingNames = useMemo(() => {
    return new Set(existingEmployees.map((e) => e.name.trim().toLowerCase()));
  }, [existingEmployees]);

  const handleDownloadSample = () => {
    const csvContent =
      "name,civil_id,trade,daily_rate\n" +
      "Ahmed Al-Balushi,10293847,CARPENTER,12.50\n" +
      "Muhammad Rasheed,98472615,MASON,11.00\n" +
      "Salim Al-Harthy,83746291,ELECTRICIAN,14.00\n" +
      "Kishore Kumar,74628193,HELPER,9.00\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "nexuspay_bulk_employees_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const normalizeKey = (key: string) => key.trim().toLowerCase().replace(/[\s_-]+/g, "");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportStatus(null);
    setProgress(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          notify("Uploaded CSV file is empty.", "warn");
          return;
        }

        const rows: ParsedEmployeeRow[] = [];
        const seenFileCivilIds = new Set<string>();

        results.data.forEach((rawRow, index) => {
          const rowNum = index + 2; // header is line 1
          const normalizedRow: Record<string, string> = {};
          for (const key of Object.keys(rawRow)) {
            normalizedRow[normalizeKey(key)] = String(rawRow[key] ?? "").trim();
          }

          const name =
            normalizedRow["name"] ||
            normalizedRow["employeename"] ||
            normalizedRow["fullname"] ||
            normalizedRow["workername"] ||
            "";

          const civilId =
            normalizedRow["civilid"] ||
            normalizedRow["idnumber"] ||
            normalizedRow["nationalid"] ||
            normalizedRow["id"] ||
            "";

          const rawTrade =
            normalizedRow["trade"] ||
            normalizedRow["designation"] ||
            normalizedRow["jobtitle"] ||
            normalizedRow["role"] ||
            "";

          const dailyRateStr =
            normalizedRow["dailyrate"] ||
            normalizedRow["rate"] ||
            normalizedRow["dayrate"] ||
            normalizedRow["daily"] ||
            "";

          const hourlyRateStr =
            normalizedRow["hourlyrate"] ||
            normalizedRow["hourrate"] ||
            normalizedRow["hourly"] ||
            "";

          const errors: string[] = [];

          if (!name) {
            errors.push("Missing name");
          } else if (existingNames.has(name.toLowerCase())) {
            // Non-blocking warning or duplicate error
          }

          if (!civilId) {
            errors.push("Missing civil_id");
          } else {
            const cidLower = civilId.toLowerCase();
            if (seenFileCivilIds.has(cidLower)) {
              errors.push("Duplicate civil_id in file");
            } else if (existingCivilIds.has(cidLower)) {
              errors.push("Civil ID already exists in system");
            }
            seenFileCivilIds.add(cidLower);
          }

          if (!rawTrade) {
            errors.push("Missing trade");
          }

          let dailyRate = parseFloat(dailyRateStr);
          let hourlyRate = parseFloat(hourlyRateStr);

          if (!isNaN(dailyRate) && dailyRate > 0) {
            if (isNaN(hourlyRate) || hourlyRate <= 0) {
              hourlyRate = parseFloat((dailyRate / 8).toFixed(3));
            }
          } else if (!isNaN(hourlyRate) && hourlyRate > 0) {
            dailyRate = parseFloat((hourlyRate * 8).toFixed(3));
          } else {
            errors.push("Invalid daily_rate (must be positive number)");
            dailyRate = 0;
            hourlyRate = 0;
          }

          // Matched trade or uppercase formatted
          const matchedTrade =
            TRADES.find((t) => t.toLowerCase() === rawTrade.toLowerCase()) ||
            rawTrade.toUpperCase() ||
            "HELPER";

          rows.push({
            rowNumber: rowNum,
            name,
            civilId,
            trade: matchedTrade,
            dailyRate,
            hourlyRate,
            errors,
          });
        });

        setParsedRows(rows);
      },
      error: (err) => {
        notify(`Failed to parse CSV: ${err.message}`, "warn");
      },
    });
  };

  const { validRows, invalidRows } = useMemo(() => {
    const valid: ParsedEmployeeRow[] = [];
    const invalid: ParsedEmployeeRow[] = [];
    for (const r of parsedRows) {
      if (r.errors.length === 0) valid.push(r);
      else invalid.push(r);
    }
    return { validRows: valid, invalidRows: invalid };
  }, [parsedRows]);

  const displayedRows = useMemo(() => {
    if (filterErrorOnly) return invalidRows;
    return parsedRows;
  }, [filterErrorOnly, invalidRows, parsedRows]);

  const handleCommit = async () => {
    if (validRows.length === 0) {
      notify("No valid rows ready to import.", "warn");
      return;
    }

    setIsProcessing(true);
    setImportStatus(null);

    const totalToImport = validRows.length;
    const totalBatches = Math.ceil(totalToImport / BATCH_SIZE);
    let successfulCount = 0;

    try {
      for (let b = 0; b < totalBatches; b++) {
        const batchSlice = validRows.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
        const currentBatchNum = b + 1;

        setProgress({
          current: Math.min((b + 1) * BATCH_SIZE, totalToImport),
          total: totalToImport,
          percent: Math.round(((b + 1) / totalBatches) * 100),
        });

        // Map to employees table schema
        const employeesPayload = batchSlice.map((row) => ({
          name: row.name,
          trade: row.trade,
          id_number: row.civilId,
          hourly_rate: row.hourlyRate,
          default_food_deduction: 0,
          status: "Active" as const,
        }));

        // Batch insert into employees
        // Note: RLS strictly enforces auth.jwt() ->> 'email' = 'iqbalussain@gmail.com'
        const { error: empError } = await db.from("employees").insert(employeesPayload);

        if (empError) {
          throw new Error(
            empError.message.includes("policy") || empError.code === "42501"
              ? "Access Restricted: Bulk imports require admin privilege (iqbalussain@gmail.com)."
              : `Batch ${currentBatchNum} failed: ${empError.message}`,
          );
        }

        // If site allocation is selected, insert into site_allocations
        if (selectedSiteName) {
          // Group by trade for accurate worker count per trade
          const tradeCounts: Record<string, number> = {};
          batchSlice.forEach((r) => {
            tradeCounts[r.trade] = (tradeCounts[r.trade] || 0) + 1;
          });

          const allocationPayload = Object.entries(tradeCounts).map(([trade, count]) => ({
            site_id: selectedSiteId || null,
            site_name: selectedSiteName,
            trade,
            worker_count: count,
          }));

          const { error: allocError } = await db.from("site_allocations").insert(allocationPayload);
          if (allocError) {
            console.warn("Notice: site_allocations record could not be logged:", allocError.message);
          }
        }

        successfulCount += batchSlice.length;
      }

      // Success
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      await queryClient.invalidateQueries({ queryKey: ["site_allocations"] });
      notify(`Successfully imported ${successfulCount} employee(s) in batches.`, "ok");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to import employee batch.";
      setImportStatus(msg);
      notify(msg, "warn");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Bulk Employee Import Engine</h2>
              <p className="text-xs text-slate-500">
                Parse, validate, and chunk-insert workers into Supabase in 50-row batches
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {/* File Upload & Sample Section */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="col-span-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-6 text-center transition hover:border-amber-500 hover:bg-amber-50/20"
              >
                <Upload className="mb-2 h-8 w-8 text-amber-600" />
                <span className="text-sm font-semibold text-slate-800">
                  {fileName ? fileName : "Click to browse CSV file or drag and drop"}
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  Required columns: name, civil_id, trade, daily_rate
                </span>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Template Download
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  Download standard CSV with preformatted trade headers and rate sample.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadSample}
                className={`${btnOutline} mt-3 w-full justify-center text-xs`}
              >
                <Download size={14} className="mr-1.5" /> Download Sample CSV
              </button>
            </div>
          </div>

          {/* Optional Site Allocation target */}
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs">
            <span className="font-semibold text-slate-700">Optional Site Allocation:</span>
            <select
              value={selectedSiteId}
              onChange={(e) => {
                const pId = e.target.value;
                setSelectedSiteId(pId);
                const proj = projectsQuery.data?.find((p) => p.id === pId);
                setSelectedSiteName(proj ? proj.name : "");
              }}
              className={`${select} h-8 w-60 text-xs`}
            >
              <option value="">No immediate site allocation</option>
              {projectsQuery.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.location ? `(${p.location})` : ""}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-slate-500">
              When selected, batch entries will also log site_allocations.
            </span>
          </div>

          {/* Validation Metrics Banner */}
          {parsedRows.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="text-slate-700">
                  Total Parsed: <strong>{parsedRows.length}</strong>
                </span>
                <span className="flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 size={14} /> Valid Ready: <strong>{validRows.length}</strong>
                </span>
                {invalidRows.length > 0 && (
                  <span className="flex items-center gap-1 text-rose-700">
                    <AlertCircle size={14} /> Errors: <strong>{invalidRows.length}</strong>
                  </span>
                )}
              </div>

              {invalidRows.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterErrorOnly(!filterErrorOnly)}
                  className="text-xs font-medium text-amber-700 underline hover:text-amber-800"
                >
                  {filterErrorOnly ? "Show All Rows" : "Show Error Rows Only"}
                </button>
              )}
            </div>
          )}

          {/* Dry Run Preview Table */}
          {displayedRows.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 font-bold">Line</th>
                      <th className="px-3 py-2 font-bold">Worker Name</th>
                      <th className="px-3 py-2 font-bold">Civil ID</th>
                      <th className="px-3 py-2 font-bold">Trade</th>
                      <th className="px-3 py-2 font-bold">Daily Rate (OMR)</th>
                      <th className="px-3 py-2 font-bold">Hourly Rate</th>
                      <th className="px-3 py-2 font-bold">Validation Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedRows.map((row) => {
                      const hasErr = row.errors.length > 0;
                      return (
                        <tr
                          key={row.rowNumber}
                          className={hasErr ? "bg-rose-50/50 hover:bg-rose-50" : "hover:bg-slate-50"}
                        >
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
                            #{row.rowNumber}
                          </td>
                          <td className={`px-3 py-2 font-medium ${!row.name ? "text-rose-600 font-bold" : "text-slate-800"}`}>
                            {row.name || "Missing Name"}
                          </td>
                          <td className={`px-3 py-2 font-mono ${!row.civilId ? "text-rose-600 font-bold" : "text-slate-700"}`}>
                            {row.civilId || "Missing"}
                          </td>
                          <td className="px-3 py-2">
                            <span className="rounded bg-slate-200 px-1.5 py-0.5 font-medium text-slate-700">
                              {row.trade}
                            </span>
                          </td>
                          <td className={`px-3 py-2 ${row.dailyRate <= 0 ? "text-rose-600 font-bold" : "text-slate-800"}`}>
                            {row.dailyRate > 0 ? `${row.dailyRate.toFixed(2)}` : "Invalid"}
                          </td>
                          <td className="px-3 py-2 text-slate-600 font-mono">
                            {row.hourlyRate > 0 ? `${row.hourlyRate.toFixed(3)}` : "-"}
                          </td>
                          <td className="px-3 py-2">
                            {hasErr ? (
                              <div className="flex flex-wrap gap-1">
                                {row.errors.map((err, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700"
                                  >
                                    <AlertCircle size={10} /> {err}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                                <CheckCircle2 size={11} /> Ready
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Progress / Error Feedback */}
          {progress && (
            <div className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <div className="flex justify-between text-xs font-semibold text-amber-900">
                <span>Chunked Insertion Progress</span>
                <span>
                  {progress.current} of {progress.total} workers ({progress.percent}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-amber-200">
                <div
                  className="h-full bg-amber-600 transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}

          {importStatus && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>{importStatus}</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-4">
          <div className="text-xs text-slate-500">
            {validRows.length > 0 && (
              <span>
                Batch chunks: {Math.ceil(validRows.length / BATCH_SIZE)} ({BATCH_SIZE} rows per batch)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className={`${btnOutline} text-xs`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCommit}
              disabled={isProcessing || validRows.length === 0}
              className={`${btnGold} text-xs`}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={14} className="mr-1.5 animate-spin" />
                  Importing in batches…
                </>
              ) : (
                `Commit ${validRows.length} Valid Worker(s)`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
