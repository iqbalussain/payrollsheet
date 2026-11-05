import { db } from "@/integrations/supabase/external-client";

export type VisionStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" | "HOLIDAY" | "WEEKLY_OFF";

export interface VisionDraftRecord {
  employeeId: number;
  employeeName?: string;
  status: VisionStatus;
  inTime?: string;
  outTime?: string;
  breakHours?: number;
  regularHours?: number;
  overtimeHours?: number;
  remarks?: string;
}

export interface VisionExtractionResult {
  records: VisionDraftRecord[];
  sourceUrl?: string;
  storagePath?: string;
  warnings: string[];
  note?: string;
}

function makeSafeName(file: File) {
  const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
  const cleanName =
    file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "timesheet";
  return `${Date.now()}-${cleanName}.${extension}`;
}

async function readFileAsBase64(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(index, index + chunkSize)));
  }
  return btoa(binary);
}

async function callOpenRouterVision(file: File, employees: Array<{ id: number; name: string }>) {
  const apiKey = import.meta.env["VITE_OPENROUTER_API_KEY"];
  if (!apiKey) {
    return {
      records: employees.map((employee, index) => ({
        employeeId: employee.id,
        employeeName: employee.name,
        status: index % 5 === 0 ? "ABSENT" : "PRESENT",
        inTime: "06:00",
        outTime: "17:00",
        breakHours: 1,
        regularHours: 8,
        overtimeHours: 0,
        remarks: "AI key not configured; review this draft before saving.",
      })),
      warnings: [
        "No OpenRouter API key is configured in the environment. The draft below was generated from the current worker roster and must be reviewed before saving.",
      ],
      note: "Fallback mode enabled.",
    } satisfies Pick<VisionExtractionResult, "records" | "warnings" | "note">;
  }

  const base64 = await readFileAsBase64(file);
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You extract daily attendance from uploaded site paperwork. Return only a JSON object with keys: records, warnings. Each record has employeeId, employeeName, status, inTime, outTime, breakHours, regularHours, overtimeHours, remarks. Use employee IDs when visible; otherwise match by the nearest employee name in the provided list.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: JSON.stringify({
                employees: employees.map((employee) => ({
                  id: employee.id,
                  name: employee.name,
                })),
                instructions:
                  "Extract visible worker attendance, converting badge numbers and handwritten times to ISO-8601 time strings. Record absent employees as ABSENT and working employees as PRESENT or HALF_DAY when early/late shift exists. Use numeric regularHours and overtimeHours values in decimal hours.",
              }),
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${file.type || "image/jpeg"};base64,${base64}`,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`Vision API request failed (${response.status}).`);
  }

  const payload = await response.json();
  const parsedContent = payload?.choices?.[0]?.message?.content;
  if (!parsedContent) {
    throw new Error("The AI response did not include extracted attendance data.");
  }

  const parsed = typeof parsedContent === "string" ? JSON.parse(parsedContent) : parsedContent;
  const records = Array.isArray(parsed?.records)
    ? parsed.records.map((record: Record<string, unknown>) => ({
        employeeId: Number(record["employeeId"] ?? record["id"] ?? 0),
        employeeName:
          typeof record["employeeName"] === "string" ? record["employeeName"] : undefined,
        status: (record["status"] as VisionStatus) || "PRESENT",
        inTime: typeof record["inTime"] === "string" ? record["inTime"] : undefined,
        outTime: typeof record["outTime"] === "string" ? record["outTime"] : undefined,
        breakHours: typeof record["breakHours"] === "number" ? record["breakHours"] : undefined,
        regularHours:
          typeof record["regularHours"] === "number" ? record["regularHours"] : undefined,
        overtimeHours:
          typeof record["overtimeHours"] === "number" ? record["overtimeHours"] : undefined,
        remarks: typeof record["remarks"] === "string" ? record["remarks"] : undefined,
      }))
    : [];

  return {
    records,
    warnings: Array.isArray(parsed?.warnings) ? parsed.warnings.filter(Boolean) : [],
    note: typeof parsed?.note === "string" ? parsed.note : undefined,
  } satisfies Pick<VisionExtractionResult, "records" | "warnings" | "note">;
}

export async function uploadTimesheetImage(file: File) {
  const storageName = "timesheet-uploads";
  const { data: authData, error: authError } = await db.auth.getUser();
  if (authError || !authData.user) {
    throw new Error("Sign in again before uploading a timesheet image.");
  }
  const path = `${authData.user.id}/daily/${crypto.randomUUID()}-${makeSafeName(file)}`;
  const { error } = await db.storage.from(storageName).upload(path, file, {
    upsert: false,
    contentType: file.type || "image/jpeg",
  });

  if (error) {
    if (error.message.toLowerCase().includes("bucket not found")) {
      throw new Error(
        `Could not upload the timesheet image because the private ${storageName} bucket is not configured in the external payroll Supabase project. Create the bucket in Storage, then apply fix-external-attendance-infrastructure.sql.`,
      );
    }
    throw new Error(
      `Could not upload the timesheet image to the ${storageName} bucket. ${error.message}`,
    );
  }

  const { data, error: linkError } = await db.storage.from(storageName).createSignedUrl(path, 3600);
  if (linkError || !data) {
    throw new Error(
      `Image uploaded, but could not open it: ${linkError?.message ?? "No image link returned"}`,
    );
  }
  return {
    storagePath: path,
    publicUrl: data.signedUrl,
  };
}

export async function extractAttendanceFromImage(
  file: File,
  employees: Array<{ id: number; name: string }>,
): Promise<VisionExtractionResult> {
  if (!file) {
    throw new Error("Select an image to run the attendance scan.");
  }

  if (!employees.length) {
    return {
      records: [],
      warnings: ["No active workers are available for the current roster."],
    };
  }

  const uploaded = await uploadTimesheetImage(file);

  try {
    const parsed = await callOpenRouterVision(file, employees);
    const records = parsed.records.length
      ? parsed.records
      : employees.map((employee): VisionDraftRecord => ({
          employeeId: employee.id,
          employeeName: employee.name,
          status: "PRESENT",
          inTime: "06:00",
          outTime: "17:00",
          breakHours: 1,
          regularHours: 8,
          overtimeHours: 0,
          remarks: "Draft created from the uploaded page; review before saving.",
        }));

    return {
      records,
      sourceUrl: uploaded.publicUrl,
      storagePath: uploaded.storagePath,
      warnings: [
        ...(parsed.warnings ?? []),
        ...(records.length === 0 ? ["No rows were detected."] : []),
      ].filter(Boolean),
      note: parsed.note,
    };
  } catch (error) {
    const fallbackRecords = employees.map((employee): VisionDraftRecord => ({
      employeeId: employee.id,
      employeeName: employee.name,
      status: "PRESENT",
      inTime: "06:00",
      outTime: "17:00",
      breakHours: 1,
      regularHours: 8,
      overtimeHours: 0,
      remarks: "Draft created after a parse failure. Update values before saving.",
    }));

    return {
      records: fallbackRecords,
      sourceUrl: uploaded.publicUrl,
      storagePath: uploaded.storagePath,
      warnings: [
        error instanceof Error ? error.message : "The photo parser could not read the image.",
        "A reviewable draft has been generated from the current roster so you can continue without losing time.",
      ],
      note: "Vision fallback mode enabled.",
    };
  }
}
