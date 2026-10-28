import { addHours, assignmentForDate, syncTimesFromHours } from "@/lib/monthly-entry";
import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
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
type AttendanceEntry = Omit<TimesheetRecord, "id" | "created_at" | "total_hours" | "regular_hours" | "break_hours" | "overtime_hours">;

type AttendanceColumn = "inTime" | "outTime";

const ATTENDANCE_COLUMNS: Array<{ value: AttendanceColumn; label: string }> = [
  { value: "inTime", label: "In time" },
  { value: "outTime", label: "Out time" },
];

interface DayDraft {
  status: AttendanceStatus | "";
  site: string;
  projectId: string;
  foreman: string;
  foremanUserId: string;
  inTime: string;
  outTime: string;
  totalHours: string;
  remarks: string;
}

interface AttendanceSaveError {
  message: string;
  action: string;
  details?: string;
  code?: string;
}

function attendanceSaveError(error: unknown): AttendanceSaveError {
  const value = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const message = typeof value["message"] === "string" ? value["message"] : typeof error === "string" ? error : "The save could not be completed.";
  const code = typeof value["code"] === "string" ? value["code"] : undefined;
  const details = [value["details"], value["hint"]].filter((part): part is string => typeof part === "string" && part.trim().length > 0).join(" · ");
  let action = "Keep this window open and try saving again. If it fails again, share the error details with your payroll administrator.";
  if (code === "23514") action = "Check the reported date: Present/Half day needs valid hours and an Out time after In time. Other statuses must have no shift hours.";
  else if (code === "23503") action = "Reselect the employee, site and foreman; one of the selected records may have been removed or changed.";
  else if (code === "23505") action = "Review this employee’s saved attendance for the reported date and edit the existing entry instead of adding a duplicate.";
  else if (code === "42501" || /permission denied|row-level security/i.test(message)) action = "Ask your payroll administrator to check your attendance-saving permission and project assignment, then retry.";
  else if (code === "PGRST301" || code === "PGRST302" || /jwt.*expired|invalid.*jwt/i.test(message)) action = "Your sign-in has expired. Note your unsaved entries before signing in again, then retry.";
  else if (code === "428C9" || code === "PGRST204") action = "The attendance fields do not match the saved-record format. Share these details with your payroll administrator; changing hours will not fix this.";
  else if (/fetch|network|offline|connection|timeout/i.test(message)) action = "Check your internet connection, then retry. If the previous request reached the server, review saved attendance before making changes.";
  else if (code === "22007" || code === "22008") action = "Check the attendance date and times. Use a valid date and times between 00:00 and 23:59.";
  return { message, action, ...(details ? { details } : {}), ...(code ? { code } : {}) };
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
  const [inH, inM = 0] = inTime.split(":").map(Number);
  const [outH, outM = 0] = outTime.split(":").map(Number);
  if (inH === undefined || outH === undefined) return 0;
  return Math.max(0, (outH * 60 + outM - (inH * 60 + inM)) / 60);
}


function dayFromRecord(entry: TimesheetRecord): DayDraft {
  const inTime = entry.in_time?.slice(0, 5) ?? "";
  const outTime = entry.out_time?.slice(0, 5) ?? "";
  const totalHours =
    entry.total_hours != null
      ? String(entry.total_hours)
      : inTime && outTime
        ? String(Math.max(0, calcDurationHours(inTime, outTime)).toFixed(1))
        : "8";

  return {
    status: entry.status,
    site: entry.site,
    projectId: entry.project_id ?? "",
    foreman: entry.foreman,
    foremanUserId: entry.foreman_user_id ?? "",
    inTime,
    outTime,
    totalHours,
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
    inTime: "06:00",
    outTime: "17:00",
    totalHours: "8",
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
  visibleColumns: { inTime: boolean; outTime: boolean };
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
          className={`${select} min-w-28 px-2 py-1`}
        >
          <option value="">--</option>
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
          className={`${select} min-w-32 px-2 py-1`}
        >
          <option value="">Project</option>
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
          className={`${select} min-w-32 px-2 py-1`}
        >
          <option value="">Foreman</option>
          {foremanOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </td>

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
          className={`${input} w-16 px-1.5 py-1 font-bold text-navy text-right disabled:opacity-50`}
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

  const [empSearch, setEmpSearch] = useState("");
  const [empDropdownOpen, setEmpDropdownOpen] = useState(false);
  const empSearchRef = useRef<HTMLInputElement>(null);
  const empDropdownRef = useRef<HTMLDivElement>(null);

  const [visibleColumns, setVisibleColumns] = useState({
    inTime: false,
    outTime: false,
  });

  const toggleColumn = (col: AttendanceColumn) => {
    setVisibleColumns((prev) => ({ ...prev, [col]: !prev[col] }));
  };

  const [defaultProjectId, setDefaultProjectId] = useState(initialProjectId);
  const [defaultForemanValue, setDefaultForemanValue] = useState("");

  const [singleEmployeeId, setSingleEmployeeId] = useState("");
  const [days, setDays] = useState<Record<number, DayDraft>>({});
  const [saveError, setSaveError] = useState<AttendanceSaveError | null>(null);
  const loadedContext = useRef("");

  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<number>>(new Set());
  const [employeeSearch, setEmployeeSearch] = useState("");

  const [bulkPattern, setBulkPattern] = useState<"6day" | "5day" | "all">("6day");
  const [bulkDailyHours, setBulkDailyHours] = useState("8");
  const [bulkInTime, setBulkInTime] = useState("06:00");
  const [bulkOutTime, setBulkOutTime] = useState("17:00");
  const [bulkWorkingStatus, setBulkWorkingStatus] = useState<AttendanceStatus>("PRESENT");
  const [bulkOffStatus, setBulkOffStatus] = useState<AttendanceStatus>("WEEKLY_OFF");

  const timesheetsQuery = useTimesheetsForMonth(month);
  const timeMode = Boolean(visibleColumns.inTime && visibleColumns.outTime);
  const assignmentsQuery = useQuery({
    queryKey: ["employee_site_assignments", "monthly", singleEmployeeId],
    enabled: Boolean(singleEmployeeId),
    queryFn: async () => {
      const { data, error } = await dbAny
        .from("employee_site_assignments")
        .select("site,foreman,project_id,foreman_user_id,effective_from,effective_to")
        .eq("employee_id", Number(singleEmployeeId));
      if (error) throw error;
      return (data ?? []) as Array<{
        site: string;
        foreman: string;
        project_id: string | null;
        foreman_user_id: string | null;
        effective_from: string;
        effective_to: string | null;
      }>;
    },
  });
  const siteFor = useCallback(
    (day: number) => {
      const date = `${month}-${String(day).padStart(2, "0")}`;
      return assignmentForDate(assignmentsQuery.data, date);
    },
    [assignmentsQuery.data, month],
  );
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

  const totalMonthDays = daysInMonth(month);
  const calendarDays = useMemo(
    () => Array.from({ length: totalMonthDays }, (_, index) => index + 1),
    [totalMonthDays],
  );

  const daysFirstHalf = useMemo(() => calendarDays.filter((d) => d <= 16), [calendarDays]);
  const daysSecondHalf = useMemo(() => calendarDays.filter((d) => d > 16), [calendarDays]);

  const employeesByName = useMemo(
    () => [...employees].sort((a, b) => a.name.localeCompare(b.name)),
    [employees],
  );

  const selectedEmployee = useMemo(
    () => employeesByName.find((e) => String(e.id) === singleEmployeeId),
    [singleEmployeeId, employeesByName],
  );

  const empSearchResults = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    if (!q) return employeesByName;
    return employeesByName.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.id_number && e.id_number.toLowerCase().includes(q)) ||
        (e.trade && e.trade.toLowerCase().includes(q)),
    );
  }, [empSearch, employeesByName]);

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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        empDropdownRef.current &&
        !empDropdownRef.current.contains(e.target as Node) &&
        empSearchRef.current &&
        !empSearchRef.current.contains(e.target as Node)
      ) {
        setEmpDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  useEffect(() => {
    if (initialForeman && foremanOptions.length && !defaultForemanValue) {
      const found = foremanOptions.find((f) => f.name.toLowerCase() === initialForeman.toLowerCase());
      if (found) setDefaultForemanValue(found.value);
    }
  }, [foremanOptions, initialForeman, defaultForemanValue]);

  const resolvedDefaultProject = useMemo(
    () => projects.find((p) => p.id === defaultProjectId),
    [defaultProjectId, projects],
  );
  const resolvedDefaultForeman = useMemo(
    () => foremanOptions.find((f) => f.value === defaultForemanValue),
    [defaultForemanValue, foremanOptions],
  );

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

        const assigned = patch.status && !existing.status ? siteFor(day) : null;
        if (assigned && !next.site) Object.assign(next, assigned);
        if (patch.status && (!next.site || !next.projectId) && resolvedDefaultProject) {
          next.projectId = resolvedDefaultProject.id;
          next.site = resolvedDefaultProject.name;
        }
        if (patch.status && (!next.foreman || !next.foremanUserId) && resolvedDefaultForeman) {
          next.foreman = resolvedDefaultForeman.name;
          next.foremanUserId = resolvedDefaultForeman.userId ?? "";
        }

        if (patch.inTime !== undefined || patch.outTime !== undefined) {
          const inT = patch.inTime !== undefined ? patch.inTime : next.inTime;
          const outT = patch.outTime !== undefined ? patch.outTime : next.outTime;
          if (inT && outT) {
            next.totalHours = String(Math.max(0, calcDurationHours(inT, outT)).toFixed(1));
          }
        } else if (patch.totalHours !== undefined && timeMode) {
          const synced = syncTimesFromHours(next.inTime, patch.totalHours);
          if (synced) Object.assign(next, synced);
        }

        if (patch.status && !worked(patch.status)) {
          next.inTime = "";
          next.outTime = "";
          next.totalHours = "0";
        } else if (patch.status && worked(patch.status)) {
          next.inTime ||= "06:00";
          next.outTime ||= "17:00";
          next.totalHours ||= "8";
        }
        return { ...current, [day]: next };
      });
    };
  }, [resolvedDefaultForeman, resolvedDefaultProject, siteFor, timeMode]);

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
            ? weekday !== 5
            : weekday !== 5 && weekday !== 6;

      if (isWorking) {
        const endMinutes = 6 * 60 + numHours * 60;
        const outTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
        next[day] = {
          status: "PRESENT",
          site,
          projectId,
          foreman,
          foremanUserId,
          inTime: "06:00",
          outTime,
          totalHours: String(numHours),
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
          totalHours: "0",
          remarks: "",
        };
      }
      const assigned = siteFor(day);
      if (assigned) next[day] = { ...next[day], ...assigned };
    }
    setDays(next);
    notify(
      `Generated ${pattern === "6day" ? "6-day" : pattern === "5day" ? "5-day" : "all-day"} schedule (${numHours} hrs/day) for ${month}.`,
    );
  };

  const saveSingle = async () => {
    setSaveError(null);
    if (!singleEmployeeId) {
      setSaveError({ message: "No employee selected.", action: "Search for and select an employee before saving." });
      notify("Select an employee before saving monthly attendance.", "warn");
      return;
    }

    const entries = calendarDays.flatMap((day) => {
      const row = days[day];
      return row?.status ? [{ day, row }] : [];
    });

    if (!entries.length) {
      setSaveError({ message: "No attendance days selected.", action: "Choose an attendance status for at least one day, then save again." });
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

      const [startHour, startMinute = 0] = (row.inTime || "").split(":").map(Number);
      const [endHour, endMinute = 0] = (row.outTime || "").split(":").map(Number);
      if (startHour === undefined || endHour === undefined) return true;

      const start = startHour * 60 + startMinute;
      const end = endHour * 60 + endMinute;
      const shiftHours = (end - start) / 60;

      return (
        !row.inTime ||
        !row.outTime ||
        end <= start ||
        shiftHours <= 0
      );
    });

    if (invalidDays.length) {
      setSaveError({
        message: `Check day(s) ${invalidDays.map(({ day }) => day).join(", ")}.`,
        action: "Select a site and foreman for each marked day (or set defaults above). For working days, enter valid positive hours or an Out time after In time.",
      });
      notify(
        `Check site, foreman, hours/time values for day(s) ${invalidDays.map(({ day }) => day).join(", ")}.`,
        "warn",
      );
      return;
    }

    const rows: AttendanceEntry[] = entries.map(({ day, row }) => {
      const date = `${month}-${String(day).padStart(2, "0")}`;
      const doesWork = worked(row.status);

      let inTime = row.inTime;
      let outTime = row.outTime;

      if (doesWork && manualMode) {
        const durationMinutes = Math.round(Number(row.totalHours || 8) * 60);
        if (visibleColumns.inTime && row.inTime) {
          const [h, m = 0] = row.inTime.split(":").map(Number);
          if (h !== undefined) {
            const endM = h * 60 + m + durationMinutes;
            outTime = `${String(Math.floor(endM / 60)).padStart(2, "0")}:${String(endM % 60).padStart(2, "0")}`;
          }
        } else if (visibleColumns.outTime && row.outTime) {
          const [h, m = 0] = row.outTime.split(":").map(Number);
          if (h !== undefined) {
            const startM = Math.max(0, h * 60 + m - durationMinutes);
            inTime = `${String(Math.floor(startM / 60)).padStart(2, "0")}:${String(Math.floor(startM % 60)).padStart(2, "0")}`;
          }
        } else {
          inTime = "06:00";
          const endM = 6 * 60 + durationMinutes;
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
        remarks: row.remarks.trim() || null,
      };
    });

    try {
      await onSave(rows);
      notify(`${rows.length} attendance record(s) saved for ${month}.`);
      onOpenChange(false);
    } catch (error) {
      const failure = attendanceSaveError(error);
      setSaveError(failure);
      notify(failure.message, "warn");
    }
  };

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

    let inTime = bulkInTime;
    let outTime = bulkOutTime;
    let totalHours = Number(bulkDailyHours) || 8;

    if (worked(bulkWorkingStatus)) {
      if (manualMode) {
        const totalHrs = Number(bulkDailyHours);
        if (!Number.isFinite(totalHrs) || totalHrs <= 0 || totalHrs > 24) {
          notify("Enter a valid daily total hours (e.g. 8).", "warn");
          return;
        }
        totalHours = totalHrs;
        inTime = "06:00";
        const endM = 6 * 60 + Math.round(totalHrs * 60);
        outTime = `${String(Math.floor(endM / 60)).padStart(2, "0")}:${String(endM % 60).padStart(2, "0")}`;
      } else {
        const [startHour, startMinute = 0] = bulkInTime.split(":").map(Number);
        const [endHour, endMinute = 0] = bulkOutTime.split(":").map(Number);
        if (
          startHour === undefined ||
          endHour === undefined ||
          endHour * 60 + endMinute <= startHour * 60 + startMinute
        ) {
          notify("Check that out time is after in time.", "warn");
          return;
        }
        totalHours = ((endHour * 60 + endMinute) - (startHour * 60 + startMinute)) / 60;
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
              ? weekday !== 5
              : weekday !== 5 && weekday !== 6;

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

        {timesheetsQuery.error && (
          <p className="m-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            Could not load monthly attendance: {timesheetsQuery.error.message}
          </p>
        )}

        {entryMode === "single" && (
          <div className="flex min-h-0 flex-1 flex-col">
            {saveError && (
              <div role="alert" className="shrink-0 max-h-40 overflow-y-auto border-b border-danger/30 bg-danger/10 px-4 py-3 text-xs text-danger">
                <p className="font-bold">Attendance save failed{selectedEmployee ? ` · ${selectedEmployee.name} · ${month}` : ""}</p>
                <p className="mt-1 break-words">{saveError.message}</p>
                <p className="mt-1 font-semibold break-words">{saveError.action}</p>
                {(saveError.code || saveError.details) && (
                  <details className="mt-2">
                    <summary className="cursor-pointer font-semibold">Error details</summary>
                    {saveError.code && <p className="mt-1">Code: {saveError.code}</p>}
                    {saveError.details && <p className="mt-1 break-words whitespace-pre-wrap">{saveError.details}</p>}
                  </details>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-white px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <span className="text-xs font-semibold text-slate-700">Select Employee:</span>
                  <div className="relative mt-1 min-w-72">
                    <div className="relative flex items-center">
                      <Search
                        size={13}
                        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        ref={empSearchRef}
                        type="text"
                        value={empSearch}
                        placeholder={
                          selectedEmployee
                            ? `${selectedEmployee.name} (${selectedEmployee.id_number || selectedEmployee.id})`
                            : "Search by name or ID number…"
                        }
                        onFocus={() => {
                          setEmpSearch("");
                          setEmpDropdownOpen(true);
                        }}
                        onChange={(e) => {
                          setEmpSearch(e.target.value);
                          setEmpDropdownOpen(true);
                        }}
                        className={`${input} pl-8 pr-8 text-xs font-normal ${
                          selectedEmployee ? "placeholder:text-navy placeholder:font-semibold" : ""
                        }`}
                        aria-label="Search employee"
                        autoComplete="off"
                      />
                      {selectedEmployee && (
                        <button
                          type="button"
                          onClick={() => {
                            setSingleEmployeeId("");
                            setEmpSearch("");
                            setDays({});
                            loadedContext.current = "";
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-danger"
                          aria-label="Clear employee selection"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    {empDropdownOpen && (
                      <div
                        ref={empDropdownRef}
                        className="absolute left-0 top-full z-50 mt-1 max-h-64 w-full min-w-80 overflow-y-auto rounded-lg border border-border bg-white shadow-lg"
                      >
                        {empSearchResults.length === 0 ? (
                          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                            No employees match "{empSearch}".
                          </p>
                        ) : (
                          empSearchResults.map((emp) => (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() => {
                                setSingleEmployeeId(String(emp.id));
                                setEmpSearch("");
                                setEmpDropdownOpen(false);
                                setDays({});
                                loadedContext.current = "";
                              }}
                              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition hover:bg-navy-soft/60 ${
                                String(emp.id) === singleEmployeeId
                                  ? "bg-navy-soft font-bold text-navy"
                                  : "text-slate-700"
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold">{emp.name}</p>
                                <p className="text-[10px] text-slate-500">
                                  ID: {emp.id_number || emp.id} · {emp.trade}
                                </p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {singleEmployeeId && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500">Quick fill:</span>
                  <button
                    type="button"
                    onClick={() => fillSingleSchedule("6day", "11")}
                    className={`${btnOutline} h-7 rounded px-2 py-0.5 text-[11px]`}
                  >
                    <Sparkles size={12} className="text-amber-600" /> 6-Day 11hrs (Fri off)
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
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="overflow-x-auto rounded-lg border border-border shadow-sm bg-white">
                    <div className="bg-navy-soft px-3 py-2 text-xs font-bold text-navy border-b border-border flex justify-between items-center">
                      <span>Days 1 – 16</span>
                      <span className="text-[10px] text-slate-500">First Half of Month</span>
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-600 border-b border-border">
                        <tr>
                          <th className="px-2 py-2">Day</th>
                          <th className="px-2 py-2">Status</th>
                          <th className="px-2 py-2">Site</th>
                          <th className="px-2 py-2">Foreman</th>
                          {visibleColumns.inTime && <th className="px-2 py-2">In</th>}
                          {visibleColumns.outTime && <th className="px-2 py-2">Out</th>}
                          <th className="px-2 py-2 text-right">{isManualHoursMode ? "Hours" : "Tot"}</th>
                          <th className="px-2 py-2">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {daysFirstHalf.map((day) => {
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

                  <div className="overflow-x-auto rounded-lg border border-border shadow-sm bg-white">
                    <div className="bg-navy-soft px-3 py-2 text-xs font-bold text-navy border-b border-border flex justify-between items-center">
                      <span>Days 17 – {totalMonthDays}</span>
                      <span className="text-[10px] text-slate-500">Second Half of Month</span>
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-600 border-b border-border">
                        <tr>
                          <th className="px-2 py-2">Day</th>
                          <th className="px-2 py-2">Status</th>
                          <th className="px-2 py-2">Site</th>
                          <th className="px-2 py-2">Foreman</th>
                          {visibleColumns.inTime && <th className="px-2 py-2">In</th>}
                          {visibleColumns.outTime && <th className="px-2 py-2">Out</th>}
                          <th className="px-2 py-2 text-right">{isManualHoursMode ? "Hours" : "Tot"}</th>
                          <th className="px-2 py-2">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {daysSecondHalf.map((day) => {
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
                </div>
              )}
            </div>
          </div>
        )}

        {entryMode === "multiple" && (
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-12">
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

            <div className="flex h-full flex-col overflow-y-auto p-5 md:col-span-7">
              <div className="space-y-4">
                <div>
                  <h3 className="font-display text-sm font-bold text-navy">
                    Bulk Attendance Configuration
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    This schedule will be populated for all {selectedEmployeeIds.size} selected employee(s) across all {calendarDays.length} days of {month}.
                  </p>
                </div>

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
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
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
                    </div>
                  )}
                </div>

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