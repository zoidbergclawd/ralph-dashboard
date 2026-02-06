import { promises as fs } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

import type { PRDDocument } from "@/lib/ralph-state";
import { readPRD } from "@/lib/ralph-state";

function resolveProjectPath(request: Request): string | null {
  const { searchParams } = new URL(request.url);

  const fromQuery = searchParams.get("projectPath") ?? searchParams.get("path");
  const fromEnv = process.env.RALPH_PROJECT_PATH;
  const selected = fromQuery ?? fromEnv ?? null;

  if (!selected) {
    return null;
  }

  return path.resolve(selected);
}

async function validateProjectPath(projectPath: string): Promise<string | null> {
  try {
    const target = await fs.stat(projectPath);

    if (!target.isDirectory()) {
      return "Project path is not a directory.";
    }
  } catch {
    return "Project path not found.";
  }

  return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toOptionalString(value: unknown, label: string, errors: string[]): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  errors.push(`${label} must be a string or null.`);
  return null;
}

function validatePRDDocument(input: unknown): { ok: true; data: PRDDocument } | { ok: false; errors: string[] } {
  if (!isObject(input)) {
    return { ok: false, errors: ["PRD payload must be an object."] };
  }

  const errors: string[] = [];
  const project = toOptionalString(input.project, "project", errors);
  const goal = toOptionalString(input.goal, "goal", errors);

  if (!Array.isArray(input.items)) {
    errors.push("items must be an array.");
  }

  const items = Array.isArray(input.items) ? input.items : [];
  const normalizedItems = items
    .map((item, index) => {
      if (!isObject(item)) {
        errors.push(`items[${index}] must be an object.`);
        return null;
      }

      const id = typeof item.id === "number" && Number.isFinite(item.id) ? item.id : null;
      const category = typeof item.category === "string" ? item.category : null;
      const title = typeof item.title === "string" ? item.title : null;
      const description = typeof item.description === "string" ? item.description : null;
      const priority = typeof item.priority === "number" && Number.isFinite(item.priority) ? item.priority : null;
      const passes = typeof item.passes === "boolean" ? item.passes : null;
      const verification = typeof item.verification === "string" ? item.verification : null;

      if (id === null) {
        errors.push(`items[${index}].id must be a number.`);
      }
      if (category === null) {
        errors.push(`items[${index}].category must be a string.`);
      }
      if (title === null) {
        errors.push(`items[${index}].title must be a string.`);
      }
      if (description === null) {
        errors.push(`items[${index}].description must be a string.`);
      }
      if (priority === null) {
        errors.push(`items[${index}].priority must be a number.`);
      }
      if (passes === null) {
        errors.push(`items[${index}].passes must be a boolean.`);
      }
      if (verification === null) {
        errors.push(`items[${index}].verification must be a string.`);
      }

      if (id === null || category === null || title === null || description === null || priority === null || passes === null || verification === null) {
        return null;
      }

      let steps: string[] = [];
      if (item.steps === undefined) {
        steps = [];
      } else if (Array.isArray(item.steps)) {
        steps = item.steps.filter((step): step is string => typeof step === "string");
      } else {
        errors.push(`items[${index}].steps must be an array of strings.`);
      }

      let notes = "";
      if (item.notes === undefined) {
        notes = "";
      } else if (typeof item.notes === "string") {
        notes = item.notes;
      } else {
        errors.push(`items[${index}].notes must be a string.`);
      }

      return {
        id,
        category,
        title,
        description,
        priority,
        passes,
        verification,
        steps,
        notes,
      } satisfies PRDDocument["items"][number];
    })
    .filter((item): item is PRDDocument["items"][number] => item !== null);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      project,
      goal,
      items: normalizedItems,
    },
  };
}

export async function GET(request: Request): Promise<Response> {
  const projectPath = resolveProjectPath(request);

  if (!projectPath) {
    return NextResponse.json(
      {
        error: "Missing project path. Provide ?projectPath=/abs/path or set RALPH_PROJECT_PATH.",
      },
      { status: 400 },
    );
  }

  const projectError = await validateProjectPath(projectPath);
  if (projectError) {
    return NextResponse.json({ error: projectError }, { status: projectError.includes("not found") ? 404 : 400 });
  }

  const result = await readPRD(projectPath);

  if (result.data === null) {
    const status = result.error === "Unable to locate PRD file" ? 404 : 500;
    return NextResponse.json({ error: result.error ?? "Failed to read PRD." }, { status });
  }

  return NextResponse.json({ path: result.path, prd: result.data });
}

export async function POST(request: Request): Promise<Response> {
  const projectPath = resolveProjectPath(request);

  if (!projectPath) {
    return NextResponse.json(
      {
        error: "Missing project path. Provide ?projectPath=/abs/path or set RALPH_PROJECT_PATH.",
      },
      { status: 400 },
    );
  }

  const projectError = await validateProjectPath(projectPath);
  if (projectError) {
    return NextResponse.json({ error: projectError }, { status: projectError.includes("not found") ? 404 : 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const validation = validatePRDDocument(payload);
  if (!validation.ok) {
    return NextResponse.json({ error: "Invalid PRD payload.", details: validation.errors }, { status: 400 });
  }

  const prdPath = path.join(projectPath, "prd.json");
  await fs.writeFile(prdPath, JSON.stringify(validation.data, null, 2), "utf8");

  return NextResponse.json({ ok: true, path: prdPath, prd: validation.data });
}
