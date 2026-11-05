import { useMemo, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, Loader2, PencilLine, Upload } from "lucide-react";

import { btnGold, btnOutline, card, input, select } from "@/components/payroll/ui";
import { extractAttendanceFromImage, type VisionDraftRecord } from "@/utils/visionParser";

const VISIBILITY_OPTIONS = [
  { value: "PRESENT", label: "Present" },
  { value: "HALF_DAY", label: "Half day" },
  { value: "ABSENT", label: "Absent" },
  { value: "LEAVE", label: "Leave" },
  { value: "HOLIDAY", label: "Holiday" },
  { value: "WEEKLY_OFF", label: "Weekly off" },
] as const;

interface AttendanceEmployee {
  id: number;
  name: string;
  id_number?: string;
  trade?: string;
}

interface AttendanceViewProps {
  employees: AttendanceEmployee[];
  site: string;
  foreman: string;
  workDate: string;
  onApplyDraft: (rows: VisionDraftRecord[]) => void;
  onSaveDraft: (rows: VisionDraftRecord[]) => Promise<void>;
  notify: (message: string, tone?: "ok" | "warn") => void;
}

export function AttendanceView({
  employees,
  site,
  foreman,
  workDate,
  onApplyDraft,
  onSaveDraft,
  notify,
}: AttendanceViewProps) {
  const [draftRows, setDraftRows] = useState<VisionDraftRecord[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  const scanLabel = useMemo(
    () =>
      site && foreman
        ? `${site} · ${foreman}`
        : workDate
          ? `Daily attendance for ${workDate}`
          : "Daily attendance",
    [foreman, site, workDate],
  );

  const updateRow = (employeeId: number, patch: Partial<VisionDraftRecord>) => {
    setDraftRows((current) =>
      current.map((row) => (row.employeeId === employeeId ? { ...row, ...patch } : row)),
    );
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setWarnings([]);
    setImageUrl(null);
    setIsUploading(true);

    try {
      const parsed = await extractAttendanceFromImage(file, employees);
      setDraftRows(parsed.records);
      setWarnings(parsed.warnings);
      setImageUrl(parsed.sourceUrl ?? null);
      if (parsed.warnings.length) {
        setError("The AI scan finished with warnings. Check each row before saving.");
      }
      notify(
        `Photo scan complete for ${scanLabel}. Review the extracted rows before saving.`,
        "ok",
      );
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "The photo scan could not finish.";
      setError(message);
      notify(message, "warn");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const applyDraftToRoster = () => {
    if (!draftRows.length) {
      setError("Scan a timesheet first to populate the draft rows.");
      return;
    }
    onApplyDraft(draftRows);
    notify(`Applied ${draftRows.length} extracted row(s) to the daily roster.`, "ok");
  };

  const saveDraft = async () => {
    if (!draftRows.length) {
      setError("There are no extracted rows to save.");
      return;
    }
    setIsSaving(true);
    try {
      await onSaveDraft(draftRows);
      notify(`Saved ${draftRows.length} extracted attendance row(s).`, "ok");
      setDraftRows([]);
      setImageUrl(null);
      setWarnings([]);
      setError("");
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "The extracted attendance could not be saved.";
      setError(message);
      notify(message, "warn");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={`${card} space-y-4 border border-navy/10 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-navy/70">
            AI photo scan
          </p>
          <h3 className="mt-1 text-sm font-bold text-navy">Attendance image extraction</h3>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
          <Camera size={12} />
          {scanLabel}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)]">
        <div className="space-y-3">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-navy/30 bg-navy-soft/40 px-4 py-5 text-center transition hover:border-navy/60 hover:bg-navy-soft/60">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
            {isUploading ? (
              <>
                <Loader2 className="h-7 w-7 animate-spin text-navy" />
                <span className="text-sm font-semibold text-navy">Uploading & parsing…</span>
              </>
            ) : (
              <>
                <Upload className="h-7 w-7 text-navy" />
                <span className="text-sm font-semibold text-navy">Upload timesheet photo</span>
                <span className="text-[11px] text-muted-foreground">
                  Mobile-friendly capture or pick an image from your gallery.
                </span>
              </>
            )}
          </label>

          {imageUrl && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <img src={imageUrl} alt="Uploaded timesheet" className="h-52 w-full object-cover" />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {warnings.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
              {warnings.map((warning) => (
                <li key={warning} className="flex items-start gap-2">
                  <PencilLine size={12} className="mt-0.5 shrink-0 text-slate-500" />
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-navy">Extracted preview</h4>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={applyDraftToRoster}
                disabled={!draftRows.length}
                className={`${btnOutline} h-8 rounded-md px-2.5 text-[11px]`}
              >
                Apply to roster
              </button>
              <button
                type="button"
                onClick={() => void saveDraft()}
                disabled={!draftRows.length || isSaving}
                className={`${btnGold} h-8 rounded-md px-2.5 text-[11px]`}
              >
                {isSaving ? "Saving…" : "Confirm bulk save"}
              </button>
            </div>
          </div>

          {draftRows.length ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="max-h-[28rem] overflow-auto">
                <table className="min-w-full border-collapse text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-2 py-2 font-bold">Worker</th>
                      <th className="px-2 py-2 font-bold">Status</th>
                      <th className="px-2 py-2 font-bold">In</th>
                      <th className="px-2 py-2 font-bold">Out</th>
                      <th className="px-2 py-2 font-bold">Break</th>
                      <th className="px-2 py-2 font-bold">Regular</th>
                      <th className="px-2 py-2 font-bold">OT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draftRows.map((row) => {
                      const employee = employees.find((item) => item.id === row.employeeId);
                      return (
                        <tr key={row.employeeId} className="border-t border-slate-200 align-top">
                          <td className="px-2 py-2">
                            <div className="font-semibold text-slate-800">
                              {employee?.name ?? row.employeeName ?? `Worker ${row.employeeId}`}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {employee?.id_number
                                ? `ID ${employee.id_number}`
                                : (employee?.trade ?? "Unassigned")}
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <select
                              value={row.status}
                              className={`${select} h-8 rounded-md px-2 py-1 text-[11px]`}
                              onChange={(event) =>
                                updateRow(row.employeeId, {
                                  status: event.target.value as VisionDraftRecord["status"],
                                })
                              }
                            >
                              {VISIBILITY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="time"
                              value={row.inTime ?? ""}
                              className={`${input} h-8 rounded-md px-2 py-1 text-[11px]`}
                              onChange={(event) =>
                                updateRow(row.employeeId, { inTime: event.target.value })
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="time"
                              value={row.outTime ?? ""}
                              className={`${input} h-8 rounded-md px-2 py-1 text-[11px]`}
                              onChange={(event) =>
                                updateRow(row.employeeId, { outTime: event.target.value })
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.25"
                              value={row.breakHours ?? 0}
                              className={`${input} h-8 rounded-md px-2 py-1 text-[11px]`}
                              onChange={(event) =>
                                updateRow(row.employeeId, {
                                  breakHours: Number(event.target.value) || 0,
                                })
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.25"
                              value={row.regularHours ?? 0}
                              className={`${input} h-8 rounded-md px-2 py-1 text-[11px]`}
                              onChange={(event) =>
                                updateRow(row.employeeId, {
                                  regularHours: Number(event.target.value) || 0,
                                })
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.25"
                              value={row.overtimeHours ?? 0}
                              className={`${input} h-8 rounded-md px-2 py-1 text-[11px]`}
                              onChange={(event) =>
                                updateRow(row.employeeId, {
                                  overtimeHours: Number(event.target.value) || 0,
                                })
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
              No extracted rows yet. Upload a paper timesheet to populate the preview table.
            </div>
          )}
        </div>
      </div>

      {draftRows.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
          <CheckCircle2 size={14} />
          <span>Draft ready for approval. Review and correct any values before saving.</span>
        </div>
      )}
    </div>
  );
}
