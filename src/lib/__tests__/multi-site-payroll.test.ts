import { describe, expect, it } from "vitest";
import { lastActiveSite, proratedFood, siteAdvanceDeduction, siteDayShare } from "../multi-site-payroll";

const entries = [
  ...Array.from({ length: 15 }, (_, i) => ({ work_date: `2026-10-${String(i + 1).padStart(2, "0")}`, site: "A", status: "PRESENT" })),
  ...Array.from({ length: 15 }, (_, i) => ({ work_date: `2026-10-${String(i + 16).padStart(2, "0")}`, site: "B", status: "PRESENT" })),
];

describe("multi-site payroll", () => {
  it("prorates food by site days", () => {
    expect(siteDayShare(entries, "A")).toBe(0.5);
    expect(proratedFood(30, siteDayShare(entries, "A"))).toBe(15);
  });
  it("last active site is the latest attendance date", () => {
    expect(lastActiveSite(entries)).toBe("B");
  });
  it("earlier transfer site gets zero advance deduction", () => {
    expect(siteAdvanceDeduction({ pendingAdvance: 100, grossSitePay: 300, proratedFood: 15, isLastSite: false })).toBe(0);
  });
  it("caps advance at net earnings and leaves remainder", () => {
    expect(siteAdvanceDeduction({ pendingAdvance: 500, grossSitePay: 300, proratedFood: 15, isLastSite: true })).toBe(285);
    expect(siteAdvanceDeduction({ pendingAdvance: 100, grossSitePay: 300, proratedFood: 15, isLastSite: true })).toBe(100);
  });
});
