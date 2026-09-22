import { useMemo, useState } from "react";
import { FileDown, CheckSquare, Square, Search } from "lucide-react";
import {
  MONTHS,
  employeeRows,
  fmt,
  getCarryForward,
  lineBalance,
  monthLabel,
  outstandingAdvance,
  toNum,
  type Employee,
  type PayrollBatch,
} from "@/lib/payroll";
import { downloadSlips, type SlipInput } from "@/lib/slip-pdf";
import { btnGold, btnOutline, card, input, select } from "./ui";

interface Props {
  employees: Employee[];
  batches: PayrollBatch[];
  notify: (msg: string, tone?: "ok" | "warn") => void;
}

export function SlipsTab({ employees, batches, notify }: Props) {
  const [month, setMonth] = useState(MONTHS[0]!);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const empById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const rows = useMemo(() => {
    const out: Array<{ employee: Employee; row: ReturnType<typeof employeeRows>[number] }> = [];
    batches
      .filter((b) => b.month === month)
      .forEach((b) => {
        b.lines.forEach((l) => {
          const employee = empById.get(Number(l.employee_id));
          if (!employee) return;
          out.push({
            employee,
            row: {
              ...l,
              month: b.month,
              site: b.site,
              batchForeman: b.foreman,
              batchId: b.id,
            },
          });
        });
      });
    return out
      .filter((r) => r.employee.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.employee.name.localeCompare(b.employee.name));
  }, [batches, month, empById, search]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.employee.id));

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.employee.id)));

  const download = async () => {
    const picked = rows.filter((r) => selected.has(r.employee.id));
    if (!picked.length) {
      notify("Select at least one employee to generate slips.", "warn");
      return;
    }
    const slips: SlipInput[] = picked.map(({ employee, row }) => ({
      employee,
      month,
      row,
      carriedForward: getCarryForward(employee.id, month, batches),
      outstandingAdvance: outstandingAdvance(employee.id, batches),
    }));
    try {
      await downloadSlips(slips);
      notify(`${slips.length} salary slip(s) downloaded.`);
    } catch (error) {
      console.error("Unable to generate salary slips.", error);
      notify("Unable to generate salary slips. Please try again.", "warn");
    }
  };

  return (
    <div className="space-y-4">
      <div className={card + " flex flex-col gap-3 p-4 lg:flex-row lg:items-end"}>
        <div className="lg:w-64">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Payroll month
          </label>
          <select
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setSelected(new Set());
            }}
            className={select}
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </div>
        <div className="relative flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee…"
            className={input + " pl-9"}
          />
        </div>
        <button onClick={toggleAll} disabled={!rows.length} className={btnOutline}>
          {allSelected ? <CheckSquare size={15} /> : <Square size={15} />}
          {allSelected ? "Clear all" : "Select all"}
        </button>
        <button onClick={download} className={btnGold}>
          <FileDown size={16} /> Download {selected.size || ""} slip{selected.size === 1 ? "" : "s"}
        </button>
      </div>

      <div className={card + " overflow-hidden"}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border bg-navy-soft text-left text-[11px] font-bold uppercase tracking-wide text-slate-600">
                <th className="w-10 px-4 py-3" />
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Trade</th>
                <th className="px-4 py-3">Site / Foreman</th>
                <th className="px-4 py-3 text-right">Hours</th>
                <th className="px-4 py-3 text-right">Net (OMR)</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    No payroll lines for {monthLabel(month)}.
                  </td>
                </tr>
              ) : (
                rows.map(({ employee, row }) => {
                  const checked = selected.has(employee.id);
                  return (
                    <tr
                      key={`${row.batchId}-${employee.id}`}
                      onClick={() => toggle(employee.id)}
                      className={`cursor-pointer border-b border-border last:border-0 ${
                        checked ? "bg-gold/10" : "hover:bg-navy-soft/50"
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <span className={checked ? "text-gold-dark" : "text-slate-400"}>
                          {checked ? <CheckSquare size={17} /> : <Square size={17} />}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-foreground">{employee.name}</td>
                      <td className="px-4 py-2.5 text-slate-600">{employee.trade}</td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {row.site || "—"} / {row.foreman || row.batchForeman || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right">{fmt(toNum(row.hours))}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-money">
                        {fmt(toNum(row.net_salary))}
                      </td>
                      <td className="px-4 py-2.5 text-right">{fmt(toNum(row.paid))}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">
                        {fmt(lineBalance(row))}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
