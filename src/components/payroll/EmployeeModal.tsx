import { X, Save, Pencil, LoaderCircle } from "lucide-react";
import {
  STATUSES,
  TRADES,
  advanceCarryForward,
  advanceOutstanding,
  employeeRows,
  fmt,
  lineBalance,
  lineGross,
  monthLabel,
  nextPayrollMonth,
  rowTotals,
  toNum,
  type AdvanceTx,
  type Employee,
  type EmployeeStatus,
  type PayrollBatch,
} from "@/lib/payroll";
import { btnGold, btnOutline, btnPrimary, input, select } from "./ui";
import { NewAdvanceValue } from "./NewAdvanceValue";

export type ModalMode = "new" | "view" | "edit" | null;

export interface EmployeeForm {
  id?: number;
  name: string;
  trade: string;
  id_number: string;
  hourly_rate: string | number;
  default_food_deduction: string | number;
  food_deduction_enabled: boolean;
  status: EmployeeStatus;
}

interface Props {
  mode: ModalMode;
  form: EmployeeForm;
  batches: PayrollBatch[];
  advances: AdvanceTx[];
  onChange: (field: keyof EmployeeForm, value: string | boolean) => void;
  onClose: () => void;
  onSubmit: () => void;
  onSwitchToEdit: () => void;
  saving?: boolean;
  defaultFoodDeduction?: number;
  duplicateIdError?: string;
  onDismissDuplicateIdError?: () => void;
}

export function EmployeeModal({
  mode,
  form,
  batches,
  advances,
  onChange,
  onClose,
  onSubmit,
  onSwitchToEdit,
  saving = false,
  defaultFoodDeduction = 0,
  duplicateIdError = "",
  onDismissDuplicateIdError,
}: Props) {
  if (!mode) return null;
  const readOnly = mode === "view";
  const titles = { new: "New Employee", view: "Employee Details", edit: "Edit Employee" };
  const rows = form.id ? employeeRows(batches, form.id) : [];
  const totals = rowTotals(rows);
  const outstanding = form.id ? advanceOutstanding(form.id, batches, advances) : 0;

  const ro = readOnly ? " bg-navy-soft/60 text-slate-600" : "";

  return (
    <div className="mobile-modal fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`mobile-sheet relative my-6 w-full rounded-2xl bg-card shadow-2xl ${readOnly ? "max-w-5xl" : "max-w-md"}`}
      >
        <div className="flex items-center justify-between rounded-t-2xl border-b border-border px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-navy">{titles[mode]}</h2>
            {mode !== "new" && (
              <p className="mt-0.5 text-xs text-muted-foreground">ID #{form.id}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full border border-border p-1.5 text-slate-500 hover:bg-navy-soft"
          >
            <X size={17} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="space-y-4 px-6 py-5"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label
                htmlFor="employee-full-name"
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Full name <span className="text-danger">*</span>
              </label>
              <input
                id="employee-full-name"
                value={form.name}
                readOnly={readOnly}
                onChange={(e) => onChange("name", e.target.value)}
                className={input + ro}
                placeholder="Enter full name"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Trade
              </label>
              {readOnly ? (
                <p className={input + ro}>{form.trade}</p>
              ) : (
                <select
                  value={form.trade}
                  onChange={(e) => onChange("trade", e.target.value)}
                  className={select}
                >
                  {TRADES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label
                htmlFor="employee-id-number"
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                ID number
              </label>
              <input
                id="employee-id-number"
                value={form.id_number}
                readOnly={readOnly}
                onChange={(e) => onChange("id_number", e.target.value)}
                className={input + ro}
                placeholder="Passport / ID"
              />
            </div>
            <div className="sm:col-span-2 rounded-lg border border-border p-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.food_deduction_enabled}
                  disabled={readOnly}
                  onChange={(event) => {
                    onChange("food_deduction_enabled", event.target.checked);
                    onChange(
                      "default_food_deduction",
                      event.target.checked ? String(defaultFoodDeduction) : "0",
                    );
                  }}
                  className="h-4 w-4 rounded accent-navy"
                />
                Food deduction
              </label>
              <label className="mt-2 block text-xs font-semibold text-slate-600">
                Food deduction amount (OMR)
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.default_food_deduction}
                  readOnly={readOnly}
                  disabled={readOnly || !form.food_deduction_enabled}
                  onChange={(event) => onChange("default_food_deduction", event.target.value)}
                  className={`${input} mt-1`}
                />
                <span className="mt-1 block font-normal text-muted-foreground">
                  New employees use the configured default of {fmt(defaultFoodDeduction)} OMR.
                </span>
              </label>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Salary / hour (OMR)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.hourly_rate}
                readOnly={readOnly}
                onChange={(e) => onChange("hourly_rate", e.target.value)}
                className={input + ro}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </label>
              {readOnly ? (
                <p className={input + ro}>{form.status}</p>
              ) : (
                <select
                  value={form.status}
                  onChange={(e) => onChange("status", e.target.value)}
                  className={select}
                >
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {readOnly && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {[
                  { label: "Total hours", value: fmt(totals.hours) },
                  { label: "Total gross salary", value: fmt(totals.gross) },
                  { label: "Food deductions", value: fmt(totals.food) },
                  { label: "Adv deductions", value: fmt(totals.prevAdv) },
                  { label: "New advances", value: fmt(totals.newAdv) },
                  { label: "Other deductions", value: fmt(totals.otherDeduct) },
                  { label: "Total paid", value: fmt(totals.paid) },
                  { label: "Salary balance", value: fmt(totals.balance) },
                  { label: "Outstanding advance", value: fmt(outstanding) },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-lg border border-border bg-navy-soft/40 p-3"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      {s.label}
                    </p>
                    <p className="text-lg font-extrabold text-navy">{s.value}</p>
                  </div>
                ))}
              </div>
              <p className="rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-slate-700">
                Advance outstanding (carries into next month):{" "}
                <strong className="text-warn">{fmt(outstanding)} OMR</strong>
              </p>

              <div className="overflow-hidden rounded-xl border border-border">
                <div className="max-h-[45vh] overflow-auto">
                  <table className="w-full min-w-[860px] text-xs">
                    <thead className="sticky top-0 bg-navy-soft">
                      <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-slate-600">
                        <th className="px-3 py-2">Month</th>
                        <th className="px-3 py-2">Site / Foreman</th>
                        <th className="px-3 py-2 text-right">Hours</th>
                        <th className="px-3 py-2 text-right">Rate</th>
                        <th className="px-3 py-2 text-right">Gross</th>
                        <th className="px-3 py-2 text-right">Food</th>
                        <th className="px-3 py-2 text-right">Adv deduction</th>
                        <th className="px-3 py-2 text-right">New adv.</th>
                        <th className="px-3 py-2 text-right">Outstanding adv.</th>
                        <th className="px-3 py-2 text-right">Other ded.</th>
                        <th className="px-3 py-2 text-right">Net</th>
                        <th className="px-3 py-2 text-right">Paid</th>
                        <th className="px-3 py-2 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={13} className="px-3 py-6 text-center text-slate-400">
                            No payroll recorded for this employee yet.
                          </td>
                        </tr>
                      ) : (
                        rows.map((r) => (
                          <tr
                            key={r.id ?? `${r.batchId}-${r.month}`}
                            className="border-t border-border"
                          >
                            <td className="px-3 py-2 font-medium">{monthLabel(r.month)}</td>
                            <td className="px-3 py-2 text-slate-600">
                              {r.site || "—"} / {r.foreman || r.batchForeman || "—"}
                            </td>
                            <td className="px-3 py-2 text-right">{fmt(toNum(r.hours))}</td>
                            <td className="px-3 py-2 text-right">{fmt(toNum(r.rate))}</td>
                            <td className="px-3 py-2 text-right font-semibold">
                              {fmt(lineGross(r))}
                            </td>
                            <td className="px-3 py-2 text-right text-danger">
                              {fmt(toNum(r.food_deduction))}
                            </td>
                            <td className="px-3 py-2 text-right text-warn">
                              {fmt(toNum(r.prev_advance))}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <NewAdvanceValue value={r.new_advance} />
                            </td>
                            <td className="px-3 py-2 text-right text-warn">
                              {fmt(
                                advanceCarryForward(
                                  form.id!,
                                  nextPayrollMonth(r.month),
                                  batches,
                                  advances,
                                ),
                              )}
                            </td>
                            <td className="px-3 py-2 text-right text-danger">
                              {fmt(toNum(r.other_deduction))}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-money">
                              {fmt(toNum(r.net_salary))}
                            </td>
                            <td className="px-3 py-2 text-right">{fmt(toNum(r.paid))}</td>
                            <td className="px-3 py-2 text-right font-semibold">
                              {fmt(lineBalance(r))}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            {readOnly ? (
              <>
                <button type="button" onClick={onClose} className={btnOutline}>
                  Close
                </button>
                <button type="button" onClick={onSwitchToEdit} className={btnPrimary}>
                  <Pencil size={14} /> Edit
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={onClose} className={btnOutline}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className={btnGold}>
                  {saving ? (
                    <LoaderCircle size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  {saving ? "Saving…" : mode === "new" ? "Create" : "Update"}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
      {duplicateIdError && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="duplicate-employee-id-title"
        >
          <div className="w-full max-w-md rounded-xl border border-danger/30 bg-card p-5 shadow-xl">
            <h3
              id="duplicate-employee-id-title"
              className="font-display text-lg font-bold text-danger"
            >
              Employee ID already exists
            </h3>
            <p className="mt-2 text-sm text-slate-700">{duplicateIdError}</p>
            <button
              type="button"
              onClick={onDismissDuplicateIdError}
              className={`${btnGold} mt-4`}
              autoFocus
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
