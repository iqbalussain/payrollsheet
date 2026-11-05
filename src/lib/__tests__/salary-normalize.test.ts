import { describe, expect, it } from "vitest";
import {
  effectiveRateOnDate,
  normalizeSalaryHistory,
  salaryHistoryInsert,
} from "../salary-history";

describe("salary history column compatibility", () => {
  it("saves a future rate to effective_from and applies it only from the selected date", () => {
    const payload = salaryHistoryInsert(1, 12, "2026-12-15");
    expect(payload).toEqual({ employee_id: 1, hourly_rate: 12, effective_from: "2026-12-15" });
    const rows = normalizeSalaryHistory([salaryHistoryInsert(1, 10, "2026-10-01"), payload]);
    expect(effectiveRateOnDate(1, "2026-12-14", rows)).toBe(10);
    expect(effectiveRateOnDate(1, "2026-12-15", rows)).toBe(12);
  });
  it("preserves a past effective date without substituting the creation date", () => {
    const payload = salaryHistoryInsert(1, 8, "2026-09-10");
    expect(payload.effective_from).toBe("2026-09-10");
    const rows = normalizeSalaryHistory([{ ...payload, created_at: "2026-11-03T08:36:00Z" }]);
    expect(effectiveRateOnDate(1, "2026-09-09", rows)).toBeUndefined();
    expect(effectiveRateOnDate(1, "2026-09-10", rows)).toBe(8);
  });
  it("uses the canonical date consistently when both date columns exist", () => {
    const rows = normalizeSalaryHistory([
      { employee_id: 1, hourly_rate: 12, effective_from: "2026-12-15", effective_on: "2026-11-03" },
    ]);
    expect(rows[0]?.effective_from).toBe("2026-12-15");
    expect(effectiveRateOnDate(1, "2026-11-03", rows)).toBeUndefined();
    expect(effectiveRateOnDate(1, "2026-12-15", rows)).toBe(12);
  });
  it("uses legacy effective_on dates when effective_from is missing", () => {
    const rows = normalizeSalaryHistory([
      { employee_id: 1, hourly_rate: 2.5, effective_on: "2026-10-01" },
    ]);
    expect(effectiveRateOnDate(1, "2026-10-15", rows)).toBe(2.5);
  });
  it("still ignores undated rows", () => {
    const rows = normalizeSalaryHistory([{ employee_id: 1, hourly_rate: 9 }]);
    expect(effectiveRateOnDate(1, "2026-10-15", rows)).toBeUndefined();
  });
});
