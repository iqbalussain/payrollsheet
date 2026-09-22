import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, Share2, Search, X } from "lucide-react";
import { fmt, MONTHS, monthLabel, type Employee, type PayrollBatch } from "@/lib/payroll";
import { allocationTotals, buildAllocationRows, type AllocationRow } from "@/lib/cost-allocation";
import {
  COMPANY_NAME,
  costReportBlob,
  costReportFilename,
  downloadCostReport,
} from "@/lib/cost-pdf";
import { downloadCostExcel } from "@/lib/cost-excel";
import { btnGold, btnOutline, card, input, select } from "./ui";

interface Props {
  open: boolean;
  onClose: () => void;
  batches: PayrollBatch[];
  employees: Employee[];
  month?: string;
  notify?: ((msg: string, tone?: "ok" | "warn") => void) | undefined;
}

export function CostDetailsModal({ open, onClose, batches, employees, month = "", notify }: Props) {
  const [query, setQuery] = useState("");
  const [fMonth, setFMonth] = useState(month);
  const [fSite, setFSite] = useState("");
  const [fForeman, setFForeman] = useState("");
  const [detail, setDetail] = useState<AllocationRow | null>(null);

  const all = useMemo(() => buildAllocationRows(batches, employees), [batches, employees]);

  const sites = useMemo(() => [...new Set(all.map((r) => r.site))].sort(), [all]);
  const foremen = useMemo(() => [...new Set(all.map((r) => r.foreman))].sort(), [all]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter(
      (r) =>
        (!fMonth || r.month === fMonth) &&
        (!fSite || r.site === fSite) &&
        (!fForeman || r.foreman === fForeman) &&
        (!q ||
          r.name.toLowerCase().includes(q) ||
          r.employeeId.toLowerCase().includes(q) ||
          r.site.toLowerCase().includes(q) ||
          r.foreman.toLowerCase().includes(q)),
    );
  }, [all, query, fMonth, fSite, fForeman]);

  const totals = useMemo(() => allocationTotals(rows), [rows]);
  const meta = { month: fMonth, site: fSite, foreman: fForeman };

  if (!open) return null;

  const share = async () => {
    const file = new File([costReportBlob(rows, meta)], costReportFilename(meta), {
      type: "application/pdf",
    });
    const nav = navigator as Navigator & {
      canShare?: (d: { files?: File[] }) => boolean;
      share?: (d: unknown) => Promise<void>;
    };
    const title = `${COMPANY_NAME} — Cost Allocation${fMonth ? ` ${monthLabel(fMonth)}` : ""}`;
    try {
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title, text: title });
        return;
      }
      if (nav.share) {
        await nav.share({ title, text: title });
        return;
      }
    } catch {
      /* user cancelled */
    }
    downloadCostReport(rows, meta);
    notify?.("Sharing isn't supported here — the PDF was downloaded so you can send it.", "warn");
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/45 p-3 sm:p-6">
      <div className={card + " w-full max-w-6xl"}>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <h2 className="mr-auto text-base font-extrabold text-navy">Cost allocation details</h2>
          <button onClick={() => downloadCostReport(rows, meta)} className={btnGold}>
            <Download size={15} /> Download PDF
          </button>
          <button onClick={() => downloadCostExcel(rows, meta)} className={btnOutline}>
            <FileSpreadsheet size={15} /> Download Excel
          </button>
          <button onClick={share} className={btnOutline}>
            <Share2 size={15} /> Share
          </button>
          <button onClick={onClose} className={btnOutline} title="Close">
            <X size={15} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 border-b border-border px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search employee, ID, site…"
              className={input + " pl-8"}
            />
          </div>
          <select value={fMonth} onChange={(e) => setFMonth(e.target.value)} className={select}>
            <option value="">All months</option>
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
          <select value={fSite} onChange={(e) => setFSite(e.target.value)} className={select}>
            <option value="">All sites</option>
            {sites.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select value={fForeman} onChange={(e) => setFForeman(e.target.value)} className={select}>
            <option value="">All foremen</option>
            {foremen.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div className="max-h-[55vh] overflow-auto">
          <table className="hidden w-full min-w-[1000px] text-xs md:table">
            <thead className="sticky top-0 z-10 bg-navy-soft">
              <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-slate-600">
                <th className="px-3 py-2">Emp ID</th>
                <th className="px-3 py-2">Employee</th>
                <th className="px-3 py-2">Trade</th>
                <th className="px-3 py-2">Site</th>
                <th className="px-3 py-2">Foreman</th>
                <th className="px-3 py-2">Month</th>
                <th className="px-3 py-2 text-right">Hrs</th>
                <th className="px-3 py-2 text-right">Basic</th>
                <th className="px-3 py-2 text-right">Food Deduct.</th>
                <th className="px-3 py-2 text-right">Outstanding</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Allocated</th>
                <th className="px-3 py-2 text-right">%</th>
                <th className="px-3 py-2 text-right">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-3 py-10 text-center text-slate-400">
                    No matching records.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.key}
                    onClick={() => setDetail(r)}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-navy-soft/60"
                  >
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-600">
                      {r.employeeId}
                    </td>
                    <td className="px-3 py-2 font-semibold text-navy">{r.name}</td>
                    <td className="px-3 py-2 text-slate-600">{r.trade}</td>
                    <td className="px-3 py-2 text-slate-600">{r.site}</td>
                    <td className="px-3 py-2 text-slate-600">{r.foreman}</td>
                    <td className="px-3 py-2 text-slate-600">{r.month}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.hours)}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.basic)}</td>
                    <td className="px-3 py-2 text-right text-danger">{fmt(r.foodDeduction)}</td>
                    <td className="px-3 py-2 text-right text-warn">{fmt(r.outstanding)}</td>
                    <td className="px-3 py-2 text-right font-bold text-money">{fmt(r.total)}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.allocated)}</td>
                    <td className="px-3 py-2 text-right">{r.allocationPct.toFixed(0)}%</td>
                    <td className="px-3 py-2 text-right font-semibold">{fmt(r.remaining)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="space-y-2 p-3 md:hidden">
            {rows.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">No matching records.</p>
            )}
            {rows.map((r) => (
              <button
                key={r.key}
                onClick={() => setDetail(r)}
                className={card + " w-full p-3 text-left"}
              >
                <p className="text-sm font-bold text-navy">{r.name}</p>
                <p className="text-[11px] text-slate-500">
                  ID {r.employeeId} · {r.site} · {r.foreman} · {r.month}
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                  <span>
                    Total <b className="text-money">{fmt(r.total)}</b>
                  </span>
                  <span>
                    Alloc. <b>{fmt(r.allocated)}</b>
                  </span>
                  <span>
                    Rem. <b>{fmt(r.remaining)}</b>
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 border-t-2 border-slate-200 bg-navy-soft/60 px-4 py-3 text-xs font-bold text-navy">
          <span>Total staff: {totals.staff}</span>
          <span>Total hours: {fmt(totals.hours)}</span>
          <span>Total salary: {fmt(totals.total)} OMR</span>
          <span className="text-money">Total allocated: {fmt(totals.allocated)} OMR</span>
          <span>Remaining: {fmt(totals.remaining)} OMR</span>
        </div>
      </div>

      {detail && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetail(null)}
        >
          <div className={card + " w-full max-w-md p-5"} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold text-navy">{detail.name}</h3>
                <p className="text-xs text-slate-500">
                  {detail.trade} · ID {detail.employeeId}
                </p>
              </div>
              <button onClick={() => setDetail(null)} className={btnOutline}>
                <X size={15} />
              </button>
            </div>
            <dl className="space-y-1 text-sm">
              {(
                [
                  ["Site / project", detail.site],
                  ["Foreman", detail.foreman],
                  ["Month", monthLabel(detail.month)],
                  ["Hours", fmt(detail.hours)],
                  ["Basic salary", fmt(detail.basic)],
                  ["Food deduction", fmt(detail.foodDeduction)],
                  ["Outstanding advance", fmt(detail.outstanding)],
                  ["Total salary", fmt(detail.total)],
                  ["Allocated amount", fmt(detail.allocated)],
                  ["Allocation %", `${detail.allocationPct.toFixed(0)}%`],
                  ["Remaining amount", fmt(detail.remaining)],
                ] as const
              ).map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between border-b border-border py-1 last:border-0"
                >
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="font-semibold text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
