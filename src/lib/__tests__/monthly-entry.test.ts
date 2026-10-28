import { describe, expect, it } from "vitest";
import { assignmentForDate, syncTimesFromHours, type SiteAssignmentRow } from "../monthly-entry";

const siteA: SiteAssignmentRow = { site: "Site A", foreman: "Ali", project_id: "pA", foreman_user_id: "fA", effective_from: "2026-10-01", effective_to: "2026-10-15" };
const siteB: SiteAssignmentRow = { site: "Site B", foreman: "Omar", project_id: "pB", foreman_user_id: "fB", effective_from: "2026-10-16", effective_to: null };

describe("hours-to-time sync", () => {
  it("recalculates Out time from In time + hours", () => {
    expect(syncTimesFromHours("06:00", "10")).toEqual({ inTime: "06:00", outTime: "16:00" });
    expect(syncTimesFromHours("07:30", "8.5")).toEqual({ inTime: "07:30", outTime: "16:00" });
  });
  it("uses 6 AM when In time is empty", () => {
    expect(syncTimesFromHours("", "9")).toEqual({ inTime: "06:00", outTime: "15:00" });
  });
  it("wraps past midnight", () => {
    expect(syncTimesFromHours("20:00", "6")?.outTime).toBe("02:00");
  });
  it("ignores invalid or zero hours", () => {
    expect(syncTimesFromHours("06:00", "abc")).toBeNull();
    expect(syncTimesFromHours("06:00", "0")).toBeNull();
  });
});

describe("site assignment by date", () => {
  it("picks the active site for the date", () => {
    expect(assignmentForDate([siteB], "2026-10-20")).toEqual({ site: "Site B", projectId: "pB", foreman: "Omar", foremanUserId: "fB" });
  });
  it("mid-month transfer: day 10 -> Site A, day 20 -> Site B", () => {
    expect(assignmentForDate([siteA, siteB], "2026-10-10")?.site).toBe("Site A");
    expect(assignmentForDate([siteA, siteB], "2026-10-15")?.site).toBe("Site A");
    expect(assignmentForDate([siteA, siteB], "2026-10-16")?.site).toBe("Site B");
    expect(assignmentForDate([siteA, siteB], "2026-10-20")?.site).toBe("Site B");
  });
  it("no deployment returns null (unassigned) without throwing", () => {
    expect(assignmentForDate([siteA], "2026-10-20")).toBeNull();
    expect(assignmentForDate([], "2026-10-05")).toBeNull();
    expect(assignmentForDate(undefined, "2026-10-05")).toBeNull();
  });
});
