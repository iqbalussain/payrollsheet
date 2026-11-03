import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Trash2 } from "lucide-react";
import type { Employee, PayrollBatch } from "@/lib/payroll";
import { monthLabel } from "@/lib/payroll";
import { useProjects } from "@/lib/management-data";
import { deletePayrollRecord } from "@/lib/restricted-delete.functions";
import { deleteCachedRows } from "@/lib/payroll-cache";
import { btnOutline, card } from "./ui";

type DeleteRequest =
  { type: "employee"; id: number } | { type: "site"; id: string } | { type: "payroll"; id: string };

interface Props {
  employees: Employee[];
  batches: PayrollBatch[];
  onDeleted: (message: string) => void;
  onError: (message: string) => void;
}

export function DeleteOnlyTab({ employees, batches, onDeleted, onError }: Props) {
  const queryClient = useQueryClient();
  const projectsQuery = useProjects(true);
  const deletion = useMutation({
    mutationFn: async (request: DeleteRequest) => {
      if (request.type === "employee") {
        const result = await deletePayrollRecord({ data: request });
        await deleteCachedRows("employees", [request.id]);
        return result;
      }
      if (request.type === "payroll") {
        const result = await deletePayrollRecord({ data: request });
        await deleteCachedRows("payroll_batches", [request.id]);
        return result;
      }
      return deletePayrollRecord({ data: request });
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries();
      const label =
        result.type === "employee"
          ? "Employee and related payroll/attendance history deleted."
          : result.type === "site"
            ? "Site deleted."
            : "Payroll batch deleted.";
      onDeleted(label);
    },
    onError: (error) =>
      onError(error instanceof Error ? error.message : "The record could not be deleted."),
  });

  const confirmDelete = (request: DeleteRequest, label: string) => {
    const warning =
      request.type === "employee"
        ? "Deleting an employee also permanently removes the employee’s payroll lines, attendance, site assignments, advances and salary history. "
        : request.type === "site"
          ? "Deleting a site removes its manager assignments; historical timesheet and payroll site names are retained. "
          : "Only draft or review payroll batches can be deleted. ";
    if (window.confirm(`${warning}Delete ${label}? This cannot be undone.`)) {
      deletion.mutate(request);
    }
  };

  const deleteButton = (request: DeleteRequest, label: string, disabled = false) => (
    <button
      type="button"
      className={`${btnOutline} text-danger`}
      disabled={deletion.isPending || disabled}
      onClick={() => confirmDelete(request, label)}
    >
      {deletion.isPending &&
      deletion.variables?.type === request.type &&
      deletion.variables.id === request.id ? (
        <LoaderCircle size={14} className="animate-spin" />
      ) : (
        <Trash2 size={14} />
      )}
      Delete
    </button>
  );

  return (
    <section className="space-y-4">
      <header className={`${card} p-4`}>
        <h2 className="font-display text-lg font-extrabold text-navy">Delete records</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This account can delete employees, sites and eligible payroll batches only. Deletions are
          permanent.
        </p>
      </header>

      <section className={`${card} overflow-hidden`}>
        <h3 className="border-b border-border px-4 py-3 font-bold text-navy">
          Payroll batches ({batches.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-2">Month</th>
                <th className="px-4 py-2">Site</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id} className="border-b border-border/70">
                  <td className="px-4 py-2">{monthLabel(batch.month)}</td>
                  <td className="px-4 py-2">{batch.site}</td>
                  <td className="px-4 py-2">{batch.status}</td>
                  <td className="px-4 py-2">
                    {deleteButton(
                      { type: "payroll", id: batch.id },
                      `${monthLabel(batch.month)} payroll for ${batch.site}`,
                      !["DRAFT", "REVIEW"].includes(batch.status),
                    )}
                  </td>
                </tr>
              ))}
              {!batches.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                    No payroll batches found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${card} overflow-hidden`}>
        <h3 className="border-b border-border px-4 py-3 font-bold text-navy">
          Sites ({projectsQuery.data?.length ?? 0})
        </h3>
        {projectsQuery.error && (
          <p role="alert" className="m-4 text-sm text-danger">
            Could not load sites: {projectsQuery.error.message}
          </p>
        )}
        {projectsQuery.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading sites…</p>
        ) : (
          <div className="divide-y divide-border">
            {(projectsQuery.data ?? []).map((project) => (
              <div key={project.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-semibold text-navy">{project.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {project.code || "No code"} · {project.active ? "Active" : "Completed"}
                  </p>
                </div>
                {deleteButton({ type: "site", id: project.id }, `site ${project.name}`)}
              </div>
            ))}
            {!projectsQuery.data?.length && (
              <p className="p-4 text-sm text-muted-foreground">No sites found.</p>
            )}
          </div>
        )}
      </section>

      <section className={`${card} overflow-hidden`}>
        <h3 className="border-b border-border px-4 py-3 font-bold text-navy">
          Employees ({employees.length})
        </h3>
        <div className="divide-y divide-border">
          {employees.map((employee) => (
            <div key={employee.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-semibold text-navy">{employee.name}</p>
                <p className="text-xs text-muted-foreground">
                  Employee #{employee.id} · {employee.id_number || "No ID number"} ·{" "}
                  {employee.trade}
                </p>
              </div>
              {deleteButton({ type: "employee", id: employee.id }, `employee ${employee.name}`)}
            </div>
          ))}
          {!employees.length && (
            <p className="p-4 text-sm text-muted-foreground">No employees found.</p>
          )}
        </div>
      </section>
    </section>
  );
}
