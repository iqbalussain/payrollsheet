import { describe, expect, it } from "vitest";
import { effectiveRateForMonth, effectiveRateOnDate } from "../salary-history";

describe("nullable salary-history effective dates", () => {
  const rows = [
    { employee_id: 1, hourly_rate: 50, effective_from: null },
    { employee_id: 1, hourly_rate: 10, effective_from: "2026-10-01" },
    { employee_id: 1, hourly_rate: 12, effective_from: "2026-10-16" },
    { employee_id: 2, hourly_rate: 99, effective_from: "2026-10-20" },
  ];
  it("ignores undated rows without overriding known rates", () => {
    expect(effectiveRateOnDate(1, "2026-10-10", rows)).toBe(10);
    expect(effectiveRateOnDate(1, "2026-10-20", rows)).toBe(12);
  });
  it("leaves the existing employee-rate fallback available when no date is known", () => {
    expect(effectiveRateOnDate(1, "2026-09-30", rows)).toBeUndefined();
    expect(
      effectiveRateForMonth(1, "2026-10", [
        { employee_id: 1, hourly_rate: 50, effective_from: null },
      ]),
    ).toBeUndefined();
  });
  it("preserves month selection and never takes another employee's rate", () => {
    expect(effectiveRateForMonth(1, "2026-10", rows)).toBe(12);
  });
});
