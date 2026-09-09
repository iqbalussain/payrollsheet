import { useMemo, useState } from "react";
import { List } from "lucide-react";
import { fmt, MONTHS, monthLabel, toNum, type Employee, type PayrollBatch } from "@/lib/payroll";
import { btnGold, card, select } from "./ui";
import { CostDetailsModal } from "./CostDetailsModal";

type GroupBy = "site" | "foreman" | "site+foreman";

interface Props {
  batches: PayrollBatch[];
  employees: Employee[];
  notify?: (msg: string, tone?: "ok" | "warn") => void;
}

export function CostTab({ batches, employees, notify }: Props) {
  const [groupBy, setGroupBy] = useState<GroupBy>("site");
  const [filterMonth, setFilterMonth] = useState("");
  const [listOpen, setListOpen] = useState(false);

  const costRows = useMemo(() => {
    const buckets: Record<
      string,
      { label: string; workers: Set<string>; hours: number; gross: number; food: number; net: number }
    > = {};
    batches
      .filter((b) => !filterMonth || b.month === filterMonth)
      .forEach((b) => {
        b.lines.forEach((l) => {
          if (!l.employee_id) return;
          const foreman = l.foreman || b.foreman || "(No Foreman)";
          const key =
            groupBy === "site"
              ? b.site || "(No Site)"
              : groupBy === "foreman"
                ? foreman
                : `${b.site || "(No Site)"} / ${foreman}`;
          buckets[key] ??= {
            label: key,
            workers: new Set(),
            hours: 0,
            gross: 0,
            food: 0,
            net: 0,
          };
          const bucket = buckets[key];
          bucket.workers.add(String(l.employee_id));
          bucket.hours += toNum(l.hours);
          bucket.gross += toNum(l.hours) * toNum(l.rate);
          bucket.food += toNum(l.food_deduction);
          bucket.net += toNum(l.net_salary);
        });
      });
    return Object.values(buckets)
      .map((b) => ({ ...b, workers: b.workers.size }))
      .sort((a, b) => b.gross - a.gross);
  }, [batches, filterMonth, groupBy]);

  const grand = useMemo(() => {
    const workers = new Set<string>();
    batches
      .filter((b) => !filterMonth || b.month === filterMonth)
      .forEach((b) => b.lines.forEach((l) => l.employee_id && workers.add(String(l.employee_id))));
    return {
      workers: workers.size,
      hours: costRows.reduce((s, r) => s + r.hours, 0),
      gross: costRows.reduce((s, r) => s + r.gross, 0),
      net: costRows.reduce((s, r) => s + r.net, 0),
    };
  }, [batches, costRows, filterMonth]);

  return (
    <div className="space-y-4">
      <div className={card + " flex flex-wrap items-center gap-3 p-4"}>
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className={select + " sm:w-56"}
        >
          <option value="">All months</option>
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <div className="flex overflow-hidden rounded-lg border border-slate-300 text-sm">
          {(
            [
              ["site", "By Site"],
              ["foreman", "By Foreman"],
              ["site+foreman", "Site + Foreman"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setGroupBy(value)}
              className={`px-3 py-2 font-semibold transition-colors ${
                groupBy === value
                  ? "bg-navy text-white"
                  : "bg-card text-slate-600 hover:bg-navy-soft"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => setListOpen(true)} className={btnGold + " ml-auto"}>
          <List size={15} /> View List
        </button>
        <p className="w-full text-xs text-muted-foreground lg:w-auto">
          Cost is allocated per line (hours × rate) — no double counting across foremen or sites.
        </p>
      </div>

      <CostDetailsModal
        open={listOpen}
        onClose={() => setListOpen(false)}
        batches={batches}
        employees={employees}
        month={filterMonth}
        notify={notify}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Unique workers", value: String(grand.workers) },
          { label: "Total hours", value: fmt(grand.hours) },
          { label: "Total gross (OMR)", value: fmt(grand.gross) },
          { label: "Total net salary (OMR)", value: fmt(grand.net), money: true },
        ].map((s) => (
          <div key={s.label} className={card + " p-3.5"}>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {s.label}
            </p>
            <p className={`text-xl font-extrabold ${s.money ? "text-money" : "text-navy"}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className={card + " overflow-hidden"}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-navy-soft text-left text-[11px] font-bold uppercase tracking-wide text-slate-600">
                <th className="px-4 py-3">
                  {groupBy === "site" ? "Site" : groupBy === "foreman" ? "Foreman" : "Site / Foreman"}
                </th>
                <th className="px-4 py-3 text-right">Workers</th>
                <th className="px-4 py-3 text-right">Hours</th>
                <th className="px-4 py-3 text-right">Gross (OMR)</th>
                <th className="px-4 py-3 text-right">Food ded.</th>
                <th className="px-4 py-3 text-right">Net salary (OMR)</th>
                <th className="w-36 px-4 py-3">% of total</th>
              </tr>
            </thead>
            <tbody>
              {costRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    No payroll data for the selected period.
                  </td>
                </tr>
              ) : (
                costRows.map((r) => {
                  const pct = grand.gross > 0 ? (r.gross / grand.gross) * 100 : 0;
                  return (
                    <tr
                      key={r.label}
                      className="border-b border-border last:border-0 hover:bg-navy-soft/50"
                    >
                      <td className="px-4 py-2.5 font-medium text-foreground">{r.label}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{r.workers}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{fmt(r.hours)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-navy">
                        {fmt(r.gross)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-danger">{fmt(r.food)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-money">{fmt(r.net)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-navy-soft">
                            <div
                              className="h-2 rounded-full bg-navy"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-8 text-right text-xs text-slate-500">
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {costRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-navy-soft/70 font-bold text-navy">
                  <td className="px-4 py-2.5">TOTAL</td>
                  <td className="px-4 py-2.5 text-right">{grand.workers}</td>
                  <td className="px-4 py-2.5 text-right">{fmt(grand.hours)}</td>
                  <td className="px-4 py-2.5 text-right">{fmt(grand.gross)}</td>
                  <td />
                  <td className="px-4 py-2.5 text-right text-money">{fmt(grand.net)}</td>
                  <td className="px-4 py-2.5 text-center text-xs text-slate-400">100%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
