import React, { useEffect, useMemo, useRef, useState, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CalendarDays,
  CheckSquare,
  Clock,
  Save,
  Search,
  Sparkles,
  Square,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import type { Employee } from "@/lib/payroll";
import { useTimesheetsForMonth, type TimesheetRecord } from "@/lib/payroll-data";
import { useProjects } from "@/lib/management-data";
import { dbAny } from "@/integrations/supabase/external-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { btnGold, btnOutline, btnPrimary, card, input, select } from "./ui";
import { TimeControl } from "./TimeControl";

type AttendanceStatus = TimesheetRecord["status"];
type AttendanceEntry = Omit<TimesheetRecord, "id" | "created_at" | "total_hours" | "regular_hours">;

type AttendanceColumn = "inTime" | "outTime" | "breakHours";

const ATTENDANCE_COLUMNS: Array<{ value: AttendanceColumn; label: string }> = [
  { value: "inTime", label: "In time" },
  { value: "outTime", label: "Out time" },
  { value: "breakHours", label: "Break" },
];

interface DayDraft {
  status: AttendanceStatus | "";
  site: string;
  projectId: string;
  foreman: string;
  foremanUserId: string;
  inTime: string;
  outTime: string;
  breakHours: string;
  totalHours: string;
  overtime: string;
  remarks: string;
}

interface Props {
  employees: Employee[];
  saving: boolean;
  onSave: (rows: AttendanceEntry[]) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  notify: (message: string, tone?: "ok" | "warn") => void;
  initialProjectId?: string;
  initialForeman?: string;
}

const ATTENDANCE_STATUSES: Array<{ value: AttendanceStatus; label: string }> = [
  { value: "PRESENT", label: "Present" },
  { value: "HALF_DAY", label: "Half day" },
  { value: "ABSENT", label: "Absent" },
  { value: "LEAVE", label: "Leave" },
  { value: "HOLIDAY", label: "Holiday" },
  { value: "WEEKLY_OFF", label: "Weekly off" },
];

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year!, monthNumber!, 0).getDate();
}

function dayOfWeek(month: string, day: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year!, monthNumber! - 1, day).getDay();
}

function calcDurationHours(inTime: string, outTime: string) {
  if (!inTime || !outTime) return 0;
  const [inH, inM] = inTime.split(":").map(Number);
  const [outH, outM] = outTime.split(":").map(Number);
  if (inH === undefined || outH === undefined) return 0;
  return Math.max(0, (outH * 60 + outM - (inH * 60 + inM)) / 60);
}

function dayFromRecord(entry: TimesheetRecord): DayDraft {
  const inTime = entry.in_time?.slice(0, 5) ?? "";
  const outTime = entry.out_time?.slice(0, 5) ?? "";
  const breakHours = String(entry.break_hours ?? 0);
  const totalHours =
    entry.total_hours != null
      ? String(entry.total_hours)
      : inTime && outTime
        ? String(Math.max(0, calcDurationHours(inTime, outTime) - Number(breakHours)).toFixed(1))
        : "8";

  return {
    status: entry.status,
    site: entry.site,
    projectId: entry.project_id ?? "",
    foreman: entry.foreman,
    foremanUserId: entry.foreman_user_id ?? "",
    inTime,
    outTime,
    breakHours,
    totalHours,
    overtime: String(entry.overtime_hours ?? 0),
    remarks: entry.remarks ?? "",
  };
}

function emptyDay(): DayDraft {
  return {
    status: "",
    site: "",
    projectId: "",
    foreman: "",
    foremanUserId: "",
    inTime: "08:00",
    outTime: "17:00",
    breakHours: "1",
    totalHours: "8",
    overtime: "0",
    remarks: "",
  };
}

function worked(status: AttendanceStatus | "") {
  return status === "PRESENT" || status === "HALF_DAY";
}

interface MonthDayRowProps {
  day: number;
  month: string;
  row: DayDraft;
  projects: Array<{ id: string; name: string; active: boolean }>;
  foremanOptions: Array<{ value: string; userId: string | null; name: string; label: string }>;
  visibleColumns: { inTime: boolean; outTime: boolean; breakHours: boolean };
  updateDay: (day: number, patch: Partial<DayDraft>) => void;
}

const MonthDayRow = memo(function MonthDayRow({
  day,
  month,
  row,
  projects,
  foremanOptions,
  visibleColumns,
  updateDay,
}: MonthDayRowProps) {
  const isWorked = worked(row.status);
  const weekday = WEEKDAY_NAMES[dayOfWeek(month, day)];
  const isWeekend = weekday === "Fri";
  const manualMode = !visibleColumns.inTime || !visibleColumns.outTime;

  return (
    <tr className={`border-t border-border ${isWeekend ? "bg-amber-50/40" : ""}`}>
      <td className="px-2 py-1.5 font-semibold text-navy whitespace-nowrap">
        <span className="font-bold">{day}</span>
        <span
          className={`ml-1 text-[10px] ${isWeekend ? "text-amber-700 font-bold" : "text-muted-foreground"}`}
        >
          ({weekday})
        </span>
      </td>
      <td className="px-2 py-1.5">
        <select
          value={row.status}
          onChange={(event) =>
            updateDay(day, {
              status: event.target.value as AttendanceStatus | "",
            })
          }
          aria-label={`Day ${day} status`}
          className={`${select} min-w-32 px-2 py-1`}
        >
          <option value="">Not recorded</option>
          {ATTENDANCE_STATUSES.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-1.5">
        <select
          value={
            row.projectId ||
            projects.find((project) => project.name === row.site)?.id ||
            ""
          }
          onChange={(event) => {
            const project = projects.find((item) => item.id === event.target.value);
            updateDay(day, {
              projectId: project?.id ?? "",
              site: project?.name ?? "",
            });
          }}
          aria-label={`Day ${day} site`}
          className={`${select} min-w-36 px-2 py-1`}
        >
          <option value="">Choose project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
              {project.active ? "" : " (completed)"}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-1.5">
        <select
          value={
            row.foremanUserId ||
            foremanOptions.find((option) => option.name === row.foreman)?.value ||
            ""
          }
          onChange={(event) => {
            const option = foremanOptions.find((item) => item.value === event.target.value);
            updateDay(day, {
              foreman: option?.name ?? "",
              foremanUserId: option?.userId ?? "",
            });
          }}
          aria-label={`Day ${day} foreman`}
          className={`${select} min-w-36 px-2 py-1`}
        >
          <option value="">Choose foreman</option>
          {foremanOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </td>

      {/* When In Time is enabled */}
      {visibleColumns.inTime && (
        <td className="px-2 py-1.5">
          <TimeControl
            value={row.inTime}
            disabled={!isWorked}
            onChange={(value) => updateDay(day, { inTime: value })}
            label={`Day ${day} in time`}
          />
        </td>
      )}

      {/* When Out Time is enabled */}
      {visibleColumns.outTime && (
        <td className="px-2 py-1.5">
          <TimeControl
            value={row.outTime}
            disabled={!isWorked}
            onChange={(value) => updateDay(day, { outTime: value })}
            label={`Day ${day} out time`}
          />
        </td>
      )}

      {/* When Break is enabled */}
      {visibleColumns.breakHours && (
        <td className="px-2 py-1.5">
          <input
            type="number"
            min="0"
            step="0.25"
            value={row.breakHours}
            disabled={!isWorked}
            onChange={(event) => updateDay(day, { breakHours: event.target.value })}
            aria-label={`Day ${day} break hours`}
            className={`${input} w-16 px-1.5 py-1 text-right disabled:opacity-50`}
          />
        </td>
      )}

      {/* Total Hours Input - Always editable when manual mode is active, or shows calculated hours */}
      {manualMode ? (
        <td className="px-2 py-1.5">
          <input
            type="number"
            min="0"
            max="24"
            step="0.5"
            value={row.totalHours}
            disabled={!isWorked}
            onChange={(event) =>
              updateDay(day, {
                totalHours: event.target.value,
                status: row.status || "PRESENT",
              })
            }
            aria-label={`Day ${day} total hours`}
            placeholder="8"
            className={`${input} w-20 px-2 py-1 font-bold text-navy text-right disabled:opacity-50`}
          />
        </td>
      ) : (
        <td className="px-2 py-1.5 text-right font-bold text-navy">
          {isWorked ? (Number(row.totalHours) || 0).toFixed(1) : "0"}
        </td>
      )}

      <td className="px-2 py-1.5">
        <input
          type="number"
          min="0"
          step="0.25"
          value={row.overtime}
          disabled={!isWorked}
          onChange={(event) => updateDay(day, { overtime: event.target.value })}
          aria-label={`Day ${day} overtime hours`}
          className={`${input} w-16 px-1.5 py-1 text-right disabled:opacity-50`}
        />
      </td>
      <td className="px-2 py-1.5">
        <input
          value={row.remarks}
          onChange={(event) => updateDay(day, { remarks: event.target.value })}
          aria-label={`Day ${day} remarks`}
          placeholder="Notes"
          className={`${input} attendance-notes-input w-24 px-1.5 py-1`}
        />
      </td>
    </tr>
  );
});

export function MonthlyAttendanceDialog({
  employees,
  saving,
  onSave,
  onOpenChange,
  notify,
  initialProjectId = "",
  initialForeman = "",
}: Props) {
  const [entryMode, setEntryMode] = useState<"single" | "multiple">("single");
  const [month, setMonth] = useState(currentMonth);

  // Column visibility options: In Time, Out Time, Break
  // By default, inTime, outTime, and breakHours are unchecked so users can easily enter total hours directly!
  const [visibleColumns, setVisibleColumns] = useState({
    inTime: false,
    outTime: false,
    breakHours: false,
  });

  const toggleColumn = (col: AttendanceColumn) => {
    setVisibleColumns((prev) => ({ ...prev, [col]: !prev[col] }));
  };

  // Default project and foreman for easy auto-filling
  const [defaultProjectId, setDefaultProjectId] = useState(initialProjectId);
  const [defaultForemanValue, setDefaultForemanValue] = useState("");

  // Single employee state
  const [singleEmployeeId, setSingleEmployeeId] = useState("");
  const [days, setDays] = useState<Record<number, DayDraft>>({});
  const loadedContext = useRef("");

  // Multiple employees state
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<number>>(new Set());
  const [employeeSearch, setEmployeeSearch] = useState("");

  // Bulk schedule options
  const [bulkPattern, setBulkPattern] = useState<"6day" | "5day" | "all">("6day");
  const [bulkDailyHours, setBulkDailyHours] = useState("8");
  const [bulkInTime, setBulkInTime] = useState("08:00");
  const [bulkOutTime, setBulkOutTime] = useState("17:00");
  const [bulkBreakHours, setBulkBreakHours] = useState("1");
  const [bulkOvertimeHours, setBulkOvertimeHours] = useState("0");
  const [bulkWorkingStatus, setBulkWorkingStatus] = useState<AttendanceStatus>("PRESENT");
  const [bulkOffStatus, setBulkOffStatus] = useState<AttendanceStatus>("WEEKLY_OFF");

  const timesheetsQuery = useTimesheetsForMonth(month);
  const projectsQuery = useProjects(true);
  const foremenQuery = useQuery({
    queryKey: ["management", "timesheet-foremen"],
    queryFn: async (): Promise<
      Array<{ user_id: string; full_name: string | null; email: string | null }>
    > => {
      const { data, error } = await dbAny
        .from("users")
        .select("user_id,full_name,email")
        .eq("role", "foreman")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{
        user_id: string;
        full_name: string | null;
        email: string | null;
      }>;
    },
  });

  const calendarDays = useMemo(
    () => Array.from({ length: daysInMonth(month) }, (_, index) => index + 1),
    [month],
  );

  const employeesByName = useMemo(
    () => [...employees].sort((a, b) => a.name.localeCompare(b.name)),
    [employees],
  );

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return employeesByName;
    return employeesByName.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.id_number && e.id_number.toLowerCase().includes(q)) ||
        (e.trade && e.trade.toLowerCase().includes(q)),
    );
  }, [employeeSearch, employeesByName]);

  const projects = projectsQuery.data ?? [];

  const foremanOptions = useMemo(() => {
    const options: Array<{ value: string; userId: string | null; name: string; label: string }> = (
      foremenQuery.data ?? []
    ).map((user) => ({
      value: user.user_id,
      userId: user.user_id,
      name: user.full_name?.trim() || user.email || "Unnamed foreman",
      label: user.email
        ? `${user.full_name?.trim() || user.email} · ${user.email}`
        : user.full_name || "Unnamed foreman",
    }));
    const knownNames = new Set(options.map((option) => option.name.toLowerCase()));
    for (const name of [
      ...(timesheetsQuery.data ?? []).map((entry) => entry.foreman),
      ...employees
        .filter((employee) => employee.trade === "FORMAN")
        .map((employee) => employee.name),
    ]) {
      const normalized = name.trim().toLowerCase();
      if (!normalized || knownNames.has(normalized)) continue;
      knownNames.add(normalized);
      options.push({ value: `legacy:${name}`, userId: null, name, label: name });
    }
    return options;
  }, [employees, foremenQuery.data, timesheetsQuery.data]);

  // Set initial foreman if provided
  useEffect(() => {
    if (initialForeman && foremanOptions.length && !defaultForemanValue) {
      const found = foremanOptions.find((f) => f.name.toLowerCase() === initialForeman.toLowerCase());
      if (found) setDefaultForemanValue(found.value);
    }
  }, [foremanOptions, initialForeman, defaultForemanValue]);

  // Resolve selected default project & foreman
  const resolvedDefaultProject = useMemo(
    () => projects.find((p) => p.id === defaultProjectId),
    [defaultProjectId, projects],
  );
  const resolvedDefaultForeman = useMemo(
    () => foremanOptions.find((f) => f.value === defaultForemanValue),
    [defaultForemanValue, foremanOptions],
  );

  // Load existing timesheets when single employee or month changes
  useEffect(() => {
    if (!singleEmployeeId || timesheetsQuery.isLoading || timesheetsQuery.error) return;
    const context = `${month}:${singleEmployeeId}`;
    if (loadedContext.current === context) return;

    const entries = (timesheetsQuery.data ?? []).filter(
      (entry) => String(entry.employee_id) === singleEmployeeId,
    );
    setDays(
      Object.fromEntries(
        entries.map((entry) => [Number(entry.work_date.slice(-2)), dayFromRecord(entry)]),
      ),
    );
    loadedContext.current = context;
  }, [singleEmployeeId, month, timesheetsQuery.data, timesheetsQuery.error, timesheetsQuery.isLoading]);

  const updateDay = useMemo(() => {
    return (day: number, patch: Partial<DayDraft>) => {
      setDays((current) => {
        const existing = current[day] ?? emptyDay();
        const next = { ...existing, ...patch };

        // Auto-assign default project/foreman if empty
        if (patch.status && (!next.site || !next.projectId) && resolvedDefaultProject) {
          next.projectId = resolvedDefaultProject.id;
          next.site = resolvedDefaultProject.name;
        }
        if (patch.status && (!next.foreman || !next.foremanUserId) && resolvedDefaultForeman) {
          next.foreman = resolvedDefaultForeman.name;
          next.foremanUserId = resolvedDefaultForeman.userId ?? "";
        }

        // When times change, keep totalHours in sync
        if (patch.inTime !== undefined || patch.outTime !== undefined || patch.breakHours !== undefined) {
          const inT = patch.inTime !== undefined ? patch.inTime : next.inTime;
          const outT = patch.outTime !== undefined ? patch.outTime : next.outTime;
          const brk = Number(patch.breakHours !== undefined ? patch.breakHours : next.breakHours) || 0;
          if (inT && outT) {
            next.totalHours = String(Math.max(0, calcDurationHours(inT, outT) - brk).toFixed(1));
          }
        }

        if (patch.status && !worked(patch.status)) {
          next.inTime = "";
          next.outTime = "";
          next.breakHours = "0";
          next.totalHours = "0";
          next.overtime = "0";
        } else if (patch.status && worked(patch.status)) {
          next.inTime ||= "08:00";
          next.outTime ||= "17:00";
          next.breakHours ||= "1";
          next.totalHours ||= "8";
        }
        return { ...current, [day]: next };
      });
    };
  }, [resolvedDefaultForeman, resolvedDefaultProject]);

  // Apply default project & foreman to all days
  const applyDefaultsToAllDays = () => {
    if (!resolvedDefaultProject && !resolvedDefaultForeman) {
      notify("Select a default site/project or foreman first.", "warn");
      return;
    }
    setDays((current) => {
      const next: Record<number, DayDraft> = {};
      for (const day of calendarDays) {
        const item = current[day] ?? emptyDay();
        next[day] = {
          ...item,
          ...(resolvedDefaultProject
            ? { projectId: resolvedDefaultProject.id, site: resolvedDefaultProject.name }
            : {}),
          ...(resolvedDefaultForeman
            ? { foreman: resolvedDefaultForeman.name, foremanUserId: resolvedDefaultForeman.userId ?? "" }
            : {}),
        };
      }
      return next;
    });
    notify("Applied default site and foreman to all days.");
  };

  // Fill single employee schedule
  const fillSingleSchedule = (pattern: "6day" | "5day" | "all", hours = "8") => {
    const site = resolvedDefaultProject?.name ?? "";
    const projectId = resolvedDefaultProject?.id ?? "";
    const foreman = resolvedDefaultForeman?.name ?? "";
    const foremanUserId = resolvedDefaultForeman?.userId ?? "";
    const numHours = Number(hours) || 8;

    const next: Record<number, DayDraft> = {};
    for (const day of calendarDays) {
      const weekday = dayOfWeek(month, day);
      const isWorking =
        pattern === "all"
          ? true
          : pattern === "6day"
            ? weekday !== 5 // Friday off
            : weekday !== 5 && weekday !== 6; // Friday & Saturday off

      if (isWorking) {
        const endMinutes = 8 * 60 + numHours * 60;
        const outTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
        next[day] = {
          status: "PRESENT",
          site,
          projectId,
          foreman,
          foremanUserId,
          inTime: "08:00",
          outTime,
          breakHours: "0",
          totalHours: String(numHours),
          overtime: "0",
          remarks: "",
        };
      } else {
        next[day] = {
          status: "WEEKLY_OFF",
          site,
          projectId,
          foreman,
          foremanUserId,
          inTime: "",
          outTime: "",
          breakHours: "0",
          totalHours: "0",
          overtime: "0",
          remarks: "",
        };
      }
    }
    setDays(next);
    notify(
      `Generated ${pattern === "6day" ? "6-day" : pattern === "5day" ? "5-day" : "all-day"} schedule (${numHours} hrs/day) for ${month}.`,
    );
  };

  // Save handler for Single Employee
  const saveSingle = async () => {
    if (!singleEmployeeId) {
      notify("Select an employee before saving monthly attendance.", "warn");
      return;
    }

    const entries = calendarDays.flatMap((day) => {
      const row = days[day];
      return row?.status ? [{ day, row }] : [];
    });

    if (!entries.length) {
      notify("Record attendance status for at least one day.", "warn");
      return;
    }

    const fallbackSite = resolvedDefaultProject?.name || "";
    const fallbackProjectId = resolvedDefaultProject?.id || null;
    const fallbackForeman = resolvedDefaultForeman?.name || "";
    const fallbackForemanUserId = resolvedDefaultForeman?.userId || null;

    const manualMode = !visibleColumns.inTime || !visibleColumns.outTime;

    const invalidDays = entries.filter(({ row }) => {
      const isWork = worked(row.status);
      const site = row.site.trim() || fallbackSite;
      const foreman = row.foreman.trim() || fallbackForeman;

      if (!site || !foreman) return true;
      if (!isWork) return false;

      if (manualMode) {
        const totalHrs = Number(row.totalHours);
        return !Number.isFinite(totalHrs) || totalHrs <= 0 || totalHrs > 24;
      }

      const [startHour, startMinute] = (row.inTime || "").split(":").map(Number);
      const [endHour, endMinute] = (row.outTime || "").split(":").map(Number);
      if (startHour === undefined || endHour === undefined) return true;

      const start = startHour * 60 + startMinute;
      const end = endHour * 60 + endMinute;
      const breakHours = visibleColumns.breakHours ? Number(row.breakHours) : 0;
      const overtime = Number(row.overtime);
      const shiftHours = (end - start) / 60;

      return (
        !row.inTime ||
        !row.outTime ||
        end <= start ||
        !Number.isFinite(breakHours) ||
        breakHours < 0 ||
        breakHours > shiftHours ||
        !Number.isFinite(overtime) ||
        overtime < 0
      );
    });

    if (invalidDays.length) {
      notify(
        `Check site, foreman, hours/time, and break values for day(s) ${invalidDays.map(({ day }) => day).join(", ")}.`,
        "warn",
      );
      return;
    }

    const rows: AttendanceEntry[] = entries.map(({ day, row }) => {
      const date = `${month}-${String(day).padStart(2, "0")}`;
      const doesWork = worked(row.status);
      const breakHours = visibleColumns.breakHours ? Number(row.breakHours) || 0 : 0;

      let inTime = row.inTime;
      let outTime = row.outTime;

      if (doesWork && manualMode) {
        const durationMinutes = Math.round((Number(row.totalHours || 8) + breakHours) * 60);
        if (visibleColumns.inTime && row.inTime) {
          const [h, m] = row.inTime.split(":").map(Number);
          const endM = h * 60 + m + durationMinutes;
          outTime = `${String(Math.floor(endM / 60)).padStart(2, "0")}:${String(endM % 60).padStart(2, "0")}`;
        } else if (visibleColumns.outTime && row.outTime) {
          const [h, m] = row.outTime.split(":").map(Number);
          const startM = Math.max(0, h * 60 + m - durationMinutes);
          inTime = `${String(Math.floor(startM / 60)).padStart(2, "0")}:${String(startM % 60).padStart(2, "0")}`;
        } else {
          inTime = "08:00";
          const endM = 8 * 60 + durationMinutes;
          outTime = `${String(Math.floor(endM / 60)).padStart(2, "0")}:${String(endM % 60).padStart(2, "0")}`;
        }
      }

      return {
        employee_id: Number(singleEmployeeId),
        site: row.site.trim() || fallbackSite,
        project_id: row.projectId || fallbackProjectId,
        foreman: row.foreman.trim() || fallbackForeman,
        foreman_user_id: row.foremanUserId || fallbackForemanUserId,
        work_date: date,
        status: row.status as AttendanceStatus,
        in_time: doesWork ? inTime : null,
        out_time: doesWork ? outTime : null,
        break_hours: doesWork ? breakHours : 0,
        overtime_hours: doesWork ? Number(row.overtime) || 0 : 0,
        remarks: row.remarks.trim() || null,
      };
    });

    try {
      await onSave(rows);
      notify(`${rows.length} attendance record(s) saved for ${month}.`);
      onOpenChange(false);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not save monthly attendance.", "warn");
    }
  };

  // Save handler for Multiple Employees
  const saveMultiple = async () => {
    if (selectedEmployeeIds.size === 0) {
      notify("Select at least one employee.", "warn");
      return;
    }
    if (!resolvedDefaultProject) {
      notify("Select a Project / Site for multiple employees.", "warn");
      return;
    }
    if (!resolvedDefaultForeman) {
      notify("Select a Foreman for multiple employees.", "warn");
      return;
    }

    const manualMode = !visibleColumns.inTime || !visibleColumns.outTime;
    const breakHours = visibleColumns.breakHours ? Number(bulkBreakHours) || 0 : 0;

    let inTime = bulkInTime;
    let outTime = bulkOutTime;

    if (worked(bulkWorkingStatus)) {
      if (manualMode) {
        const totalHrs = Number(bulkDailyHours);
        if (!Number.isFinite(totalHrs) || totalHrs <= 0 || totalHrs > 24) {
          notify("Enter a valid daily total hours (e.g. 8).", "warn");
          return;
        }
        const durationMinutes = Math.round((totalHrs + breakHours) * 60);
        inTime = "08:00";
        const endM = 8 * 60 + durationMinutes;
        outTime = `${String(Math.floor(endM / 60)).padStart(2, "0")}:${String(endM % 60).padStart(2, "0")}`;
      } else {
        const [startHour, startMinute] = bulkInTime.split(":").map(Number);
        const [endHour, endMinute] = bulkOutTime.split(":").map(Number);
        if (
          startHour === undefined ||
          endHour === undefined ||
          endHour * 60 + endMinute <= startHour * 60 + startMinute
        ) {
          notify("Check that out time is after in time.", "warn");
          return;
        }
      }
    }

    const allRows: AttendanceEntry[] = [];
    const empIds = Array.from(selectedEmployeeIds);

    for (const empId of empIds) {
      for (const day of calendarDays) {
        const weekday = dayOfWeek(month, day);
        const isWorking =
          bulkPattern === "all"
            ? true
            : bulkPattern === "6day"
              ? weekday !== 5 // Friday off
              : weekday !== 5 && weekday !== 6; // Friday & Saturday off

        const status = isWorking ? bulkWorkingStatus : bulkOffStatus;
        const doesWork = worked(status);
        const date = `${month}-${String(day).padStart(2, "0")}`;

        allRows.push({
          employee_id: empId,
          site: resolvedDefaultProject.name,
          project_id: resolvedDefaultProject.id,
          foreman: resolvedDefaultForeman.name,
          foreman_user_id: resolvedDefaultForeman.userId,
          work_date: date,
          status,
          in_time: doesWork ? inTime : null,
          out_time: doesWork ? outTime : null,
          break_hours: doesWork ? breakHours : 0,
          overtime_hours: doesWork ? Number(bulkOvertimeHours) || 0 : 0,
          remarks: null,
        });
      }
    }

    try {
      await onSave(allRows);
      notify(
        `Successfully saved monthly attendance for ${empIds.length} employee(s) (${allRows.length} total records) for ${month}.`,
      );
      onOpenChange(false);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not save monthly attendance.", "warn");
    }
  };

  const toggleSelectAllFiltered = () => {
    const allFilteredIds = filteredEmployees.map((e) => e.id);
    const allSelected = allFilteredIds.every((id) => selectedEmployeeIds.has(id));

    setSelectedEmployeeIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        allFilteredIds.forEach((id) => next.delete(id));
      } else {
        allFilteredIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleEmployeeSelection = (id: number) => {
    setSelectedEmployeeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isManualHoursMode = !visibleColumns.inTime || !visibleColumns.outTime;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="fixed left-[50%] top-[50%] z-[100] flex h-[94vh] max-h-[94vh] w-[98vw] max-w-[98vw] translate-x-[-50%] translate-y-[-50%] flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="border-b border-border bg-white px-5 py-3 pr-12 text-left">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <DialogTitle className="font-display text-xl font-extrabold text-navy">
                Monthly attendance entry
              </DialogTitle>
              <DialogDescription>
                Record monthly attendance for an individual employee or in bulk for multiple employees.
              </DialogDescription>
            </div>
            {/* Mode Toggle */}
            <div className="flex overflow-hidden rounded-lg border border-slate-300 text-xs font-semibold shadow-xs">
              <button
                type="button"
                onClick={() => setEntryMode("single")}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition ${
                  entryMode === "single"
                    ? "bg-navy text-white font-bold"
                    : "bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                <UserCheck size={14} /> Individual Employee
              </button>
              <button
                type="button"
                onClick={() => setEntryMode("multiple")}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition ${
                  entryMode === "multiple"
                    ? "bg-navy text-white font-bold"
                    : "bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Users size={14} /> Multiple Employees (Bulk)
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Global Configuration Bar: Month, Default Project, Default Foreman */}
        <div className="grid grid-cols-1 gap-3 border-b border-border bg-navy-soft/60 px-4 py-2.5 sm:grid-cols-3">
          <label className="text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-1">
              <CalendarDays size={13} className="text-slate-400" />
              Payroll Month
            </span>
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className={`${input} mt-1`}
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-1">
              <Building2 size={13} className="text-slate-400" />
              Site / Project
            </span>
            <select
              value={defaultProjectId}
              onChange={(e) => setDefaultProjectId(e.target.value)}
              className={`${select} mt-1`}
            >
              <option value="">Select project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                  {project.active ? "" : " (completed)"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-1">
              <UserCheck size={13} className="text-slate-400" />
              Foreman
            </span>
            <select
              value={defaultForemanValue}
              onChange={(e) => setDefaultForemanValue(e.target.value)}
              className={`${select} mt-1`}
            >
              <option value="">Select foreman</option>
              {foremanOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* ATTENDANCE COLUMNS OPTION TOOLBAR */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border bg-slate-100/80 px-4 py-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Attendance columns:
            </span>
            {ATTENDANCE_COLUMNS.map(({ value, label }) => (
              <label
                key={value}
                className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={visibleColumns[value]}
                  onChange={() => toggleColumn(value)}
                  className="h-4 w-4 rounded accent-navy"
                />
                {label}
              </label>
            ))}
          </div>
          {isManualHoursMode ? (
            <span className="text-[11px] font-semibold text-emerald-700">
              ✓ Total hours mode active: enter total hours directly for each day.
            </span>
          ) : (
            <span className="text-[11px] font-medium text-slate-500">
              Shift times mode: In/Out times active. Uncheck to enter total hours directly.
            </span>
          )}
        </div>

        {/* Errors display */}
        {timesheetsQuery.error && (
          <p className="m-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            Could not load monthly attendance: {timesheetsQuery.error.message}
          </p>
        )}

        {/* MODE: SINGLE EMPLOYEE */}
        {entryMode === "single" && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-white px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs font-semibold text-slate-700">
                  Select Employee:
                  <select
                    value={singleEmployeeId}
                    onChange={(event) => setSingleEmployeeId(event.target.value)}
                    className={`${select} ml-2 min-w-56 font-normal`}
                  >
                    <option value="">-- Choose Employee --</option>
                    {employeesByName.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} · {employee.trade} ({employee.id_number || employee.id})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {singleEmployeeId && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500">Quick fill:</span>
                  <button
                    type="button"
                    onClick={() => fillSingleSchedule("6day", "8")}
                    className={`${btnOutline} h-7 rounded px-2 py-0.5 text-[11px]`}
                  >
                    <Sparkles size={12} className="text-amber-600" /> 6-Day 8hrs (Fri off)
                  </button>
                  <button
                    type="button"
                    onClick={() => fillSingleSchedule("6day", "10")}
                    className={`${btnOutline} h-7 rounded px-2 py-0.5 text-[11px]`}
                  >
                    <Sparkles size={12} className="text-amber-600" /> 6-Day 10hrs
                  </button>
                  <button
                    type="button"
                    onClick={() => fillSingleSchedule("5day", "8")}
                    className={`${btnOutline} h-7 rounded px-2 py-0.5 text-[11px]`}
                  >
                    <Sparkles size={12} className="text-amber-600" /> 5-Day (Fri-Sat off)
                  </button>
                  <button
                    type="button"
                    onClick={applyDefaultsToAllDays}
                    className={`${btnOutline} h-7 rounded px-2 py-0.5 text-[11px]`}
                  >
                    Set Site & Foreman to All
                  </button>
                  <button
                    type="button"
                    onClick={() => setDays({})}
                    className={`${btnOutline} h-7 rounded px-2 py-0.5 text-[11px] text-danger hover:bg-danger/10`}
                  >
                    <X size={12} /> Clear
                  </button>
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4">
              {!singleEmployeeId ? (
                <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
                  <UserCheck size={36} className="mb-2 text-slate-400" />
                  <p className="text-sm font-semibold">Select an employee from the dropdown above</p>
                  <p className="text-xs text-slate-500">
                    You can inspect and customize their daily attendance for every day of {month}.
                  </p>
                </div>
              ) : timesheetsQuery.isLoading ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  Loading attendance for {month}…
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border shadow-sm">
                  <table className="w-full min-w-[1050px] text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-navy-soft text-[10px] uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-2 py-2">Day</th>
                        <th className="px-2 py-2">Status</th>
                        <th className="px-2 py-2">Site / project</th>
                        <th className="px-2 py-2">Foreman</th>
                        {visibleColumns.inTime && <th className="px-2 py-2">In Time</th>}
                        {visibleColumns.outTime && <th className="px-2 py-2">Out Time</th>}
                        {visibleColumns.breakHours && <th className="px-2 py-2">Break (hrs)</th>}
                        <th className="px-2 py-2 text-right">
                          {isManualHoursMode ? "Total Hours (hrs)" : "Total hrs"}
                        </th>
                        <th className="px-2 py-2">Overtime (hrs)</th>
                        <th className="w-28 px-2 py-2">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calendarDays.map((day) => {
                        const row = days[day] ?? emptyDay();
                        return (
                          <MonthDayRow
                            key={day}
                            day={day}
                            month={month}
                            row={row}
                            projects={projects}
                            foremanOptions={foremanOptions}
                            visibleColumns={visibleColumns}
                            updateDay={updateDay}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODE: MULTIPLE EMPLOYEES */}
        {entryMode === "multiple" && (
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-12">
            {/* Left Column: Employee Multi-select (5 columns) */}
            <div className="flex h-full flex-col border-b border-border md:col-span-5 md:border-b-0 md:border-r">
              <div className="border-b border-border bg-slate-50 p-3">
                <div className="relative">
                  <Search
                    size={13}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    placeholder="Search employee by name, trade, ID…"
                    className={`${input} pl-8 text-xs`}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={toggleSelectAllFiltered}
                    className="flex items-center gap-1 font-semibold text-navy hover:underline cursor-pointer"
                  >
                    <CheckSquare size={13} />
                    {filteredEmployees.every((e) => selectedEmployeeIds.has(e.id))
                      ? "Deselect All Filtered"
                      : "Select All Filtered"}
                  </button>
                  <span className="font-bold text-slate-600">
                    {selectedEmployeeIds.size} of {employees.length} selected
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                <div className="space-y-1">
                  {filteredEmployees.map((emp) => {
                    const isSelected = selectedEmployeeIds.has(emp.id);
                    return (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => toggleEmployeeSelection(emp.id)}
                        className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition cursor-pointer ${
                          isSelected
                            ? "border-navy bg-navy-soft/80 shadow-xs"
                            : "border-border/60 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <span className="text-navy">
                          {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-navy">{emp.name}</p>
                          <p className="text-[10px] text-slate-500">
                            {emp.trade} · ID: {emp.id_number || emp.id}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                  {filteredEmployees.length === 0 && (
                    <p className="p-4 text-center text-xs text-muted-foreground">
                      No employees match "{employeeSearch}".
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Bulk Schedule Configuration (7 columns) */}
            <div className="flex h-full flex-col overflow-y-auto p-5 md:col-span-7">
              <div className="space-y-4">
                <div>
                  <h3 className="font-display text-sm font-bold text-navy">
                    Bulk Attendance Configuration
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    This schedule will be populated for all {selectedEmployeeIds.size} selected employee(s) across all {daysInMonth(month)} days of {month}.
                  </p>
                </div>

                {/* Pattern selection */}
                <div className={`${card} space-y-3 p-4`}>
                  <label className="block text-xs font-bold text-slate-700">
                    Monthly Working Schedule Pattern
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {[
                      { id: "6day", label: "6-Day Work Week", desc: "Sat – Thu (Friday Off)" },
                      { id: "5day", label: "5-Day Work Week", desc: "Sun – Thu (Fri & Sat Off)" },
                      { id: "all", label: "All Days", desc: "Every calendar day" },
                    ].map((pat) => (
                      <button
                        key={pat.id}
                        type="button"
                        onClick={() => setBulkPattern(pat.id as typeof bulkPattern)}
                        className={`rounded-lg border p-3 text-left transition cursor-pointer ${
                          bulkPattern === pat.id
                            ? "border-navy bg-navy text-white shadow-xs"
                            : "border-border bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <p className="text-xs font-bold">{pat.label}</p>
                        <p
                          className={`mt-0.5 text-[10px] ${bulkPattern === pat.id ? "text-slate-200" : "text-muted-foreground"}`}
                        >
                          {pat.desc}
                        </p>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
                    <label className="text-xs font-semibold text-slate-600">
                      Working Days Status
                      <select
                        value={bulkWorkingStatus}
                        onChange={(e) => setBulkWorkingStatus(e.target.value as AttendanceStatus)}
                        className={`${select} mt-1`}
                      >
                        <option value="PRESENT">Present (Full Day)</option>
                        <option value="HALF_DAY">Half Day</option>
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Rest Days Status
                      <select
                        value={bulkOffStatus}
                        onChange={(e) => setBulkOffStatus(e.target.value as AttendanceStatus)}
                        className={`${select} mt-1`}
                      >
                        <option value="WEEKLY_OFF">Weekly Off</option>
                        <option value="ABSENT">Absent</option>
                        <option value="LEAVE">Leave</option>
                        <option value="HOLIDAY">Holiday</option>
                      </select>
                    </label>
                  </div>
                </div>

                {/* Working hours configuration */}
                <div className={`${card} space-y-3 p-4`}>
                  <p className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <Clock size={14} className="text-slate-500" />
                    {isManualHoursMode ? "Daily Total Working Hours" : "Standard Shift Hours"}
                  </p>

                  {isManualHoursMode ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="text-xs text-slate-600">
                        Total Daily Hours
                        <input
                          type="number"
                          min="1"
                          max="24"
                          step="0.5"
                          value={bulkDailyHours}
                          onChange={(e) => setBulkDailyHours(e.target.value)}
                          placeholder="8"
                          className={`${input} mt-1 font-bold text-navy`}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          e.g. 8 hrs, 10 hrs per working day
                        </span>
                      </label>
                      <label className="text-xs text-slate-600">
                        Overtime (hours/day)
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={bulkOvertimeHours}
                          onChange={(e) => setBulkOvertimeHours(e.target.value)}
                          className={`${input} mt-1 text-right`}
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <label className="text-xs text-slate-600">
                        In Time
                        <input
                          type="time"
                          value={bulkInTime}
                          onChange={(e) => setBulkInTime(e.target.value)}
                          className={`${input} mt-1`}
                        />
                      </label>
                      <label className="text-xs text-slate-600">
                        Out Time
                        <input
                          type="time"
                          value={bulkOutTime}
                          onChange={(e) => setBulkOutTime(e.target.value)}
                          className={`${input} mt-1`}
                        />
                      </label>
                      <label className="text-xs text-slate-600">
                        Break (hours)
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={bulkBreakHours}
                          onChange={(e) => setBulkBreakHours(e.target.value)}
                          className={`${input} mt-1 text-right`}
                        />
                      </label>
                      <label className="text-xs text-slate-600">
                        Overtime (hours)
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={bulkOvertimeHours}
                          onChange={(e) => setBulkOvertimeHours(e.target.value)}
                          className={`${input} mt-1 text-right`}
                        />
                      </label>
                    </div>
                  )}
                </div>

                {/* Summary calculation box */}
                {selectedEmployeeIds.size > 0 && resolvedDefaultProject && resolvedDefaultForeman && (
                  <div className="rounded-xl border border-navy/20 bg-navy-soft/60 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-navy">
                      Summary Preview for {month}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                      <div>
                        <span className="text-slate-500">Employees:</span>
                        <p className="font-bold text-navy">{selectedEmployeeIds.size}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Days in Month:</span>
                        <p className="font-bold text-navy">{calendarDays.length}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Site:</span>
                        <p className="truncate font-bold text-navy">{resolvedDefaultProject.name}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Total Entries:</span>
                        <p className="font-extrabold text-navy">
                          {(selectedEmployeeIds.size * calendarDays.length).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="border-t border-border bg-slate-50 px-4 py-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className={btnOutline}
          >
            Cancel
          </button>
          {entryMode === "single" ? (
            <button
              type="button"
              onClick={() => void saveSingle()}
              disabled={
                saving ||
                timesheetsQuery.isLoading ||
                projectsQuery.isLoading ||
                foremenQuery.isLoading ||
                !singleEmployeeId
              }
              className={btnPrimary}
            >
              <Save size={15} /> {saving ? "Saving…" : "Save Individual Attendance"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void saveMultiple()}
              disabled={
                saving ||
                projectsQuery.isLoading ||
                foremenQuery.isLoading ||
                selectedEmployeeIds.size === 0 ||
                !resolvedDefaultProject ||
                !resolvedDefaultForeman
              }
              className={btnGold}
            >
              <Save size={15} />{" "}
              {saving
                ? "Saving…"
                : `Save Attendance for ${selectedEmployeeIds.size} Employee(s)`}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
