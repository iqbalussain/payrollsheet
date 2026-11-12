import { describe, expect, it } from "vitest";
import { lockedEmployeeIds, type PayrollBatch } from "../payroll";

const batch = (id: string, site: string, empId: number) =>
  ({ id, month: "2026-10", site, foreman: "", status: "DRAFT", lines: [{ employee_id: empId }] }) as unknown as PayrollBatch;

describe("site-aware payroll locking", () => {
  it("lets an employee paid at Adam also be added to T61 in the same month", () => {
    expect(lockedEmployeeIds([batch("a", "Adam", 7)], "2026-10", null, "T61").has("7")).toBe(false);
  });
  it("still blocks a second line at the same site", () => {
    expect(lockedEmployeeIds([batch("a", "Adam", 7)], "2026-10", null, " adam ").has("7")).toBe(true);
  });
  it("blocks when an all-sites batch already includes the employee", () => {
    expect(lockedEmployeeIds([batch("a", "Multiple sites", 7)], "2026-10", null, "T61").has("7")).toBe(true);
  });
});
