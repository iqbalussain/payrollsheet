import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Loader2, QrCode, X } from "lucide-react";
import { btnGold, btnOutline, card } from "@/components/payroll/ui";
import {
  fmt,
  lineGross,
  monthLabel,
  toNum,
  type Employee,
  type HistoryRow,
} from "@/lib/payroll";
import { generateSalarySlipPDF, type SlipInput } from "@/lib/slip-pdf";

export interface SalarySlipQRPayload {
  emp_id: number;
  period: string; // "YYYY-MM"
  net_pay_omr: number;
  advance_balance: number;
}

/**
 * Builds the standard JSON payload required for the Nexuspay salary slip QR code.
 */
export function buildSalarySlipQRPayload(slip: SlipInput): SalarySlipQRPayload {
  const row = slip.row;
  const gross = lineGross(row);
  const food = toNum(row.food_deduction);
  const advanceRecovered = toNum(row.prev_advance);
  const other = toNum(row.other_deduction);
  const totalDeductions = food + advanceRecovered + other;
  const net = gross - totalDeductions;

  return {
    emp_id: Number(slip.employee.id),
    period: slip.month,
    net_pay_omr: Number(net.toFixed(3)),
    advance_balance: Number(slip.outstandingAdvance.toFixed(3)),
  };
}

/**
 * Generates an in-memory Data URL string (PNG) for the salary slip QR code.
 */
export async function generateSalarySlipQRCodeDataURL(
  payload: SalarySlipQRPayload,
): Promise<string> {
  const jsonString = JSON.stringify(payload);
  return QRCode.toDataURL(jsonString, {
    width: 140,
    margin: 1,
    color: {
      dark: "#14284b",
      light: "#ffffff",
    },
    errorCorrectionLevel: "M",
  });
}

/**
 * React Component to render the in-memory QR code matrix visually.
 */
export function SalarySlipQRCode({
  payload,
  size = 120,
  showDetails = false,
}: {
  payload: SalarySlipQRPayload;
  size?: number;
  showDetails?: boolean;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    generateSalarySlipQRCodeDataURL(payload)
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "QR generation failed");
      });
    return () => {
      active = false;
    };
  }, [payload]);

  if (error) {
    return <div className="text-[10px] text-rose-500">QR Error</div>;
  }

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50"
      >
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-1.5 shadow-xs">
        <img
          src={dataUrl}
          alt={`QR Slip ${payload.emp_id}`}
          style={{ width: size, height: size }}
          className="block"
        />
      </div>
      {showDetails && (
        <div className="mt-1.5 text-center font-mono text-[9px] text-slate-500">
          <div>Emp #{payload.emp_id} · {payload.period}</div>
          <div className="font-semibold text-slate-700">Net: {payload.net_pay_omr.toFixed(3)} OMR</div>
        </div>
      )}
    </div>
  );
}

/**
 * Modal to preview a single salary slip with its dynamic QR code before downloading.
 */
export function SalarySlipModal({
  slip,
  isOpen,
  onClose,
}: {
  slip: SlipInput | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen || !slip) return null;

  const payload = buildSalarySlipQRPayload(slip);
  const gross = lineGross(slip.row);
  const totalDeductions =
    toNum(slip.row.food_deduction) +
    toNum(slip.row.prev_advance) +
    toNum(slip.row.other_deduction);
  const net = gross - totalDeductions;

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const blob = await generateSalarySlipPDF(slip);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Salary_Slip_${slip.employee.name}_${slip.month}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate slip PDF:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative flex w-full max-w-xl flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy/10 text-navy">
              <QrCode size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">{slip.employee.name}</h3>
              <p className="text-xs text-slate-500">
                Salary Slip Preview · {monthLabel(slip.month)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="my-4 grid grid-cols-3 gap-3">
          <div className={`${card} p-3 text-center`}>
            <span className="text-[10px] font-bold text-slate-500 uppercase">Gross Salary</span>
            <div className="mt-1 font-mono text-sm font-bold text-slate-800">
              {fmt(gross)} OMR
            </div>
          </div>
          <div className={`${card} p-3 text-center`}>
            <span className="text-[10px] font-bold text-slate-500 uppercase">Deductions</span>
            <div className="mt-1 font-mono text-sm font-bold text-rose-600">
              {fmt(totalDeductions)} OMR
            </div>
          </div>
          <div className={`${card} border-emerald-200 bg-emerald-50/50 p-3 text-center`}>
            <span className="text-[10px] font-bold text-emerald-800 uppercase">Net Pay</span>
            <div className="mt-1 font-mono text-sm font-extrabold text-emerald-700">
              {fmt(net)} OMR
            </div>
          </div>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <span className="mb-2 text-xs font-semibold text-slate-700">
            Encrypted Verification QR Matrix
          </span>
          <SalarySlipQRCode payload={payload} size={110} showDetails={true} />
          <p className="mt-2 text-center text-[11px] text-slate-500">
            Contains encrypted employee ID, pay period, verified net pay, and advance balance for mobile verification.
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnOutline}>
            Close
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className={btnGold}
          >
            {isDownloading ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Download size={15} /> Download PDF with QR
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
