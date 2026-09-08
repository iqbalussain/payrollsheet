import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart2,
  CheckCircle2,
  FileDown,
  HardHat,
  History,
  Save,
  Users,
  Banknote,
  AlertTriangle,
} from "lucide-react";

import { EmployeesTab } from "@/components/payroll/EmployeesTab";
import { PayrollTab } from "@/components/payroll/PayrollTab";
import { HistoryTab } from "@/components/payroll/HistoryTab";
import { SlipsTab } from "@/components/payroll/SlipsTab";
import { CostTab } from "@/components/payroll/CostTab";
import { AdvancesTab } from "@/components/payroll/AdvancesTab";
import {
  EmployeeModal,
  type EmployeeForm,
  type ModalMode,
} from "@/components/payroll/EmployeeModal";
import {
  useBatches,
  useDeleteBatch,
  useEmployees,
  useSaveBatch,
  useSaveEmployee,
  useAdvances,
  useSaveAdvance,
  useDeleteAdvance,
} from "@/lib/payroll-data";
import type { AdvanceTx, Employee, EmployeeStatus, PayrollBatch } from "@/lib/payroll";

const TITLE = "Site Payroll Manager — Wages, Advances & Salary Slips";
const DESCRIPTION =
  "Manage site workers, monthly payroll batches, advance carry-forward, cost allocation and downloadable PDF salary slips in one elegant dashboard.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const TABS = [
  { id: "employees", label: "Employees", icon: Users },
  { id: "payroll", label: "Monthly Payroll", icon: Save },
  { id: "advances", label: "Advances", icon: Banknote },
  { id: "history", label: "Employee History", icon: History },
  { id: "slips", label: "Salary Slips", icon: FileDown },
  { id: "cost", label: "Cost Allocation", icon: BarChart2 },
] as const;

type TabId = (typeof TABS)[number]["id"];

const emptyForm: EmployeeForm = {
  name: "",
  trade: "HELPER",
  id_number: "",
  hourly_rate: "",
  status: "Active",
};

function Index() {
  const [tab, setTab] = useState<TabId>("employees");
  const [mode, setMode] = useState<ModalMode>(null);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [toast, setToast] = useState<{ msg: string; tone: "ok" | "warn" } | null>(null);

  const employeesQuery = useEmployees();
  const batchesQuery = useBatches();
  const saveEmployee = useSaveEmployee();
  const saveBatch = useSaveBatch();
  const deleteBatch = useDeleteBatch();
  const advancesQuery = useAdvances();
  const saveAdvance = useSaveAdvance();
  const deleteAdvance = useDeleteAdvance();

  const employees: Employee[] = employeesQuery.data ?? [];
  const batches: PayrollBatch[] = batchesQuery.data ?? [];
  const advances: AdvanceTx[] = advancesQuery.data ?? [];

  const notify = (msg: string, tone: "ok" | "warn" = "ok") => setToast({ msg, tone });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const openFor = (employee: Employee, next: ModalMode) => {
    setForm({
      id: employee.id,
      name: employee.name,
      trade: employee.trade,
      id_number: employee.id_number,
      hourly_rate: employee.hourly_rate,
      status: employee.status,
    });
    setMode(next);
  };

  const submitEmployee = () => {
    if (!form.name.trim()) {
      notify("Employee name is required.", "warn");
      return;
    }
    saveEmployee.mutate(
      {
        ...(form.id ? { id: form.id } : {}),
        name: form.name.trim(),
        trade: form.trade,
        id_number: form.id_number,
        hourly_rate: Number(form.hourly_rate) || 0,
        status: form.status,
      },
      {
        onSuccess: () => {
          notify(`${form.name.trim()} ${form.id ? "updated" : "added"}.`);
          setMode(null);
        },
        onError: (e) => notify((e as Error).message, "warn"),
      },
    );
  };

  const error = employeesQuery.error ?? batchesQuery.error ?? advancesQuery.error;

  return (
    <div className="min-h-screen bg-canvas font-sans text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <header className="mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy shadow-sm">
              <HardHat size={20} className="text-white" />
            </div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-navy">
              Site Payroll Manager
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Add, review and update worker salary records — stored securely in the cloud database.
          </p>
        </header>

        <nav className="mb-5 flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 shadow-sm">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                tab === id
                  ? "bg-navy text-white shadow-sm"
                  : "text-slate-600 hover:bg-navy-soft hover:text-navy"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </nav>

        {error && (
          <p className="mb-4 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
            <AlertTriangle size={15} /> {(error as Error).message}
          </p>
        )}

        {tab === "employees" && (
          <EmployeesTab
            employees={employees}
            batches={batches}
            loading={employeesQuery.isLoading}
            onNew={() => {
              setForm(emptyForm);
              setMode("new");
            }}
            onView={(e) => openFor(e, "view")}
            onEdit={(e) => openFor(e, "edit")}
          />
        )}

        {tab === "payroll" && (
          <PayrollTab
            employees={employees}
            batches={batches}
            advances={advances}
            saving={saveBatch.isPending}
            notify={notify}
            onNewEmployee={() => {
              setForm(emptyForm);
              setMode("new");
            }}
            onSave={(batch) =>
              saveBatch.mutate(batch, {
                onSuccess: () => notify("Payroll batch saved."),
                onError: (e) => notify((e as Error).message, "warn"),
              })
            }
            onDelete={(id) =>
              deleteBatch.mutate(id, {
                onSuccess: () => notify("Payroll batch deleted."),
                onError: (e) => notify((e as Error).message, "warn"),
              })
            }
          />
        )}

        {tab === "advances" && (
          <AdvancesTab
            employees={employees}
            batches={batches}
            advances={advances}
            saving={saveAdvance.isPending}
            notify={notify}
            onSave={(tx, done) =>
              saveAdvance.mutate(tx, {
                onSuccess: () => {
                  notify("Advance saved.");
                  done();
                },
                onError: (e) => notify((e as Error).message, "warn"),
              })
            }
            onDelete={(id) =>
              deleteAdvance.mutate(id, {
                onSuccess: () => notify("Advance deleted."),
                onError: (e) => notify((e as Error).message, "warn"),
              })
            }
          />
        )}
        {tab === "history" && (
          <HistoryTab employees={employees} batches={batches} advances={advances} />
        )}
        {tab === "slips" && (
          <SlipsTab employees={employees} batches={batches} notify={notify} />
        )}
        {tab === "cost" && <CostTab batches={batches} />}
      </div>

      <EmployeeModal
        mode={mode}
        form={form}
        batches={batches}
        onChange={(field, value) => setForm((f) => ({ ...f, [field]: value as EmployeeStatus }))}
        onClose={() => setMode(null)}
        onSubmit={submitEmployee}
        onSwitchToEdit={() => setMode("edit")}
      />

      {toast && (
        <div
          className={`fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg ${
            toast.tone === "warn" ? "bg-danger" : "bg-money"
          }`}
        >
          {toast.tone === "warn" ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
