import { useEffect, useMemo, useState } from "react";
import { HardHat, Plus, Save, Trash2, X, Lock, Pencil } from "lucide-react";
import {
  MONTHS,
  computeNet,
  fmt,
  advanceCarryForward,
  lineGross,
  lockedEmployeeIds,
  monthLabel,
  toNum,
  type AdvanceTx,
  type Employee,
  type PayrollBatch,
  type PayrollLine,
} from "@/lib/payroll";
import { btnGold, btnIcon, btnOutline, btnPrimary, card, input, inputSm, select } from "./ui";

interface Props {
  employees: Employee[];
  batches: PayrollBatch[];
  advances: AdvanceTx[];
  onSave: (batch: PayrollBatch) => void;
  onDelete: (id: string) => void;
  saving: boolean;
  notify: (msg: string, tone?: "ok" | "warn") => void;
}

const emptyLine = (): PayrollLine => ({
  employee_id: "",
  foreman: "",
  hours: "",
  rate: "",
  food_deduction: "",
  prev_advance: "",
  new_advance: "",
  other_deduction: "",
  net_salary: 0,
  paid: "",
});

export function PayrollTab({
  employees,
  batches,
  advances,
  onSave,
  onDelete,
  saving,
  notify,
}: Props) {
  const [month, setMonth] = useState(MONTHS[0]!);
  const [draft, setDraft] = useState<PayrollBatch | null>(null);
  const [foremanLine, setForemanLine] = useState<number | null>(null);

  const monthBatches = useMemo(
    () => batches.filter((b) => b.month === month),
    [batches, month],
  );

  const locked = useMemo(
    () => lockedEmployeeIds(batches, month, draft?.id ?? null),
    [batches, month, draft?.id],
  );

  const foremen = useMemo(() => {
    const set = new Set<string>();
    employees.filter((e) => e.trade === "FORMAN").forEach((e) => set.add(e.name));
    batches.forEach((b) => {
      if (b.foreman) set.add(b.foreman);
      b.lines.forEach((l) => l.foreman && set.add(l.foreman));
    });
    return [...set].sort();
  }, [employees, batches]);

  useEffect(() => {
    setDraft(null);
    setForemanLine(null);
  }, [month]);

  const startNew = () =>
    setDraft({ id: "", month, site: "", foreman: "", lines: [emptyLine()] });

  const setLine = (idx: number, patch: Partial<PayrollLine>) => {
    setDraft((d) => {
      if (!d) return d;
      const lines = d.lines.map((l, i) => {
        if (i !== idx) return l;
        const next = { ...l, ...patch };
        next.net_salary = computeNet(next);
        return next;
      });
      return { ...d, lines };
    });
  };

  const pickEmployee = (idx: number, value: string) => {
    if (value && locked.has(value)) {
      notify("This employee is already in another payroll batch for this month.", "warn");
      return;
    }
    if (value && draft?.lines.some((l, i) => i !== idx && String(l.employee_id) === value)) {
      notify("This employee is already on this batch.", "warn");
      return;
    }
    const emp = employees.find((e) => String(e.id) === value);
    setLine(idx, {
      employee_id: value ? Number(value) : "",
      rate: emp ? emp.hourly_rate : "",
      prev_advance: emp ? advanceCarryForward(emp.id, month, batches, advances) : "",
    });
  };

  const totals = draft
    ? draft.lines.reduce(
        (acc, l) => ({
          gross: acc.gross + lineGross(l),
          net: acc.net + toNum(l.net_salary),
          paid: acc.paid + toNum(l.paid),
          balance: acc.balance + toNum(l.net_salary) - toNum(l.paid),
        }),
        { gross: 0, net: 0, paid: 0, balance: 0 },
      )
    : null;

  const save = () => {
    if (!draft) return;
    if (!draft.lines.some((l) => l.employee_id)) {
      notify("Add at least one employee before saving.", "warn");
      return;
    }
    onSave({ ...draft, month });
    setDraft(null);
  };

  return (
    <div className="space-y-4">
      <div className={card + " flex flex-col gap-3 p-4 sm:flex-row sm:items-center"}>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Payroll month
          </label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className={select + " sm:w-64"}
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </div>
        <button onClick={startNew} className={btnGold}>
          <Plus size={16} /> New payroll batch
        </button>
      </div>

      {locked.size > 0 && (
        <p className="flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-medium text-slate-700">
          <Lock size={14} className="text-gold-dark" />
          {locked.size} employee(s) already paid in another batch for {monthLabel(month)} — they are
          blocked here to prevent double payment.
        </p>
      )}

      {draft && (
        <div className={card + " overflow-hidden"}>
          <div className="flex flex-wrap items-end gap-3 border-b border-border bg-navy-soft/60 px-4 py-3">
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Site
              </label>
              <input
                value={draft.site}
                onChange={(e) => setDraft({ ...draft, site: e.target.value })}
                placeholder="Site / project"
                className={input}
              />
            </div>
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Batch foreman (default)
              </label>
              <input
                value={draft.foreman}
                onChange={(e) => setDraft({ ...draft, foreman: e.target.value })}
                placeholder="Foreman name"
                list="foreman-options"
                className={input}
              />
            </div>
            <button onClick={save} disabled={saving} className={btnGold}>
              <Save size={15} /> {saving ? "Saving…" : "Save batch"}
            </button>
            <button onClick={() => setDraft(null)} className={btnOutline}>
              <X size={15} /> Cancel
            </button>
          </div>

          <datalist id="foreman-options">
            {foremen.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-xs">
              <thead>
                <tr className="border-b border-border text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-2 py-2">Foreman</th>
                  <th className="px-2 py-2 text-right">Hours</th>
                  <th className="px-2 py-2 text-right">Rate</th>
                  <th className="px-2 py-2 text-right">Gross</th>
                  <th className="px-2 py-2 text-right">Food</th>
                  <th className="px-2 py-2 text-right">Prev adv.</th>
                  <th className="px-2 py-2 text-right">New adv.</th>
                  <th className="px-2 py-2 text-right">Other ded.</th>
                  <th className="px-2 py-2 text-right">Net</th>
                  <th className="px-2 py-2 text-right">Paid</th>
                  <th className="px-2 py-2 text-right">Balance</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {draft.lines.map((l, idx) => {
                  const carry = l.employee_id
                    ? advanceCarryForward(l.employee_id, month, batches, advances)
                    : 0;
                  return (
                    <tr key={idx} className="border-b border-border align-top last:border-0">
                      <td className="px-3 py-2">
                        <select
                          value={l.employee_id === "" ? "" : String(l.employee_id)}
                          onChange={(e) => pickEmployee(idx, e.target.value)}
                          className={inputSm + " min-w-[190px]"}
                        >
                          <option value="">Select employee…</option>
                          {employees.map((e) => (
                            <option
                              key={e.id}
                              value={e.id}
                              disabled={locked.has(String(e.id))}
                            >
                              {e.name} — {e.trade}
                              {locked.has(String(e.id)) ? " (already paid)" : ""}
                            </option>
                          ))}
                        </select>
                        {l.employee_id !== "" && carry > 0 && (
                          <p className="mt-1 text-[10px] font-semibold text-warn">
                            Carried advance: {fmt(carry)}
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {foremanLine === idx ? (
                          <input
                            autoFocus
                            value={l.foreman}
                            list="foreman-options"
                            onChange={(e) => setLine(idx, { foreman: e.target.value })}
                            onBlur={() => setForemanLine(null)}
                            className={inputSm + " min-w-[120px]"}
                            placeholder="Line foreman"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setForemanLine(idx)}
                            title="Change foreman for this employee"
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:border-gold hover:bg-gold/10"
                          >
                            <HardHat size={13} className="text-gold-dark" />
                            {l.foreman || draft.foreman || "Set"}
                          </button>
                        )}
                      </td>
                      {(
                        [
                          "hours",
                          "rate",
                        ] as const
                      ).map((f) => (
                        <td key={f} className="px-2 py-2">
                          <input
                            type="number"
                            step="0.01"
                            value={l[f] as string}
                            onChange={(e) => setLine(idx, { [f]: e.target.value })}
                            className={inputSm + " w-20 text-right"}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-2 text-right font-semibold text-navy">
                        {fmt(lineGross(l))}
                      </td>
                      {(
                        [
                          "food_deduction",
                          "prev_advance",
                          "new_advance",
                          "other_deduction",
                        ] as const
                      ).map((f) => (
                        <td key={f} className="px-2 py-2">
                          <input
                            type="number"
                            step="0.01"
                            value={l[f] as string}
                            onChange={(e) => setLine(idx, { [f]: e.target.value })}
                            className={inputSm + " w-20 text-right"}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-2 text-right font-bold text-money">
                        {fmt(toNum(l.net_salary))}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={l.paid as string}
                          onChange={(e) => setLine(idx, { paid: e.target.value })}
                          className={inputSm + " w-20 text-right"}
                        />
                      </td>
                      <td className="px-2 py-2 text-right font-semibold">
                        {fmt(toNum(l.net_salary) - toNum(l.paid))}
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          title="Remove line"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              lines: draft.lines.filter((_, i) => i !== idx),
                            })
                          }
                          className={btnIcon + " hover:border-danger hover:text-danger"}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {totals && (
                <tfoot>
                  <tr className="bg-navy-soft/70 font-bold text-navy">
                    <td className="px-3 py-2" colSpan={4}>
                      Totals
                    </td>
                    <td className="px-2 py-2 text-right">{fmt(totals.gross)}</td>
                    <td className="px-2 py-2" colSpan={4} />
                    <td className="px-2 py-2 text-right text-money">{fmt(totals.net)}</td>
                    <td className="px-2 py-2 text-right">{fmt(totals.paid)}</td>
                    <td className="px-2 py-2 text-right">{fmt(totals.balance)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="border-t border-border px-4 py-3">
            <button
              type="button"
              onClick={() => setDraft({ ...draft, lines: [...draft.lines, emptyLine()] })}
              className={btnOutline}
            >
              <Plus size={15} /> Add employee line
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {monthBatches.length === 0 && !draft && (
          <div className={card + " p-8 text-center text-sm text-slate-400"}>
            No payroll batches for {monthLabel(month)} yet.
          </div>
        )}
        {monthBatches.map((b) => {
          const net = b.lines.reduce((s, l) => s + toNum(l.net_salary), 0);
          const paid = b.lines.reduce((s, l) => s + toNum(l.paid), 0);
          return (
            <div key={b.id} className={card + " flex flex-wrap items-center gap-3 p-4"}>
              <div className="flex-1">
                <p className="text-sm font-bold text-navy">{b.site || "Unnamed site"}</p>
                <p className="text-xs text-muted-foreground">
                  Foreman {b.foreman || "—"} · {b.lines.length} employees · {monthLabel(b.month)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase text-slate-500">Net / Paid</p>
                <p className="text-sm font-extrabold text-money">
                  {fmt(net)} / {fmt(paid)}
                </p>
              </div>
              <button onClick={() => setDraft(b)} className={btnPrimary}>
                <Pencil size={14} /> Edit
              </button>
              <button
                onClick={() => onDelete(b.id)}
                className={btnOutline + " hover:border-danger hover:text-danger"}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
