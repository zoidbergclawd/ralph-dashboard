import { stat } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { ProcessManagerError, processManager } from "@/lib/process-manager";
import { terminalSocketServer } from "@/lib/terminal-socket-server";

interface ResumeRunPayload {
  projectPath?: unknown;
  path?: unknown;
  flags?: unknown;
}

function normalizeFlags(value: unknown): { ok: true; flags: string[] } | { ok: false; error: string } {
  if (value === undefined) {
    return { ok: true, flags: [] };
  }

  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    return { ok: false, error: "flags must be an array of strings." };
  }

  return { ok: true, flags: [...value] };
}

function resolveProjectPath(request: Request, payload: ResumeRunPayload): string | null {
  const { searchParams } = new URL(request.url);

  const fromQuery = searchParams.get("projectPath") ?? searchParams.get("path");
  const fromBody = typeof payload.projectPath === "string" ? payload.projectPath : typeof payload.path === "string" ? payload.path : null;
  const fromEnv = process.env.RALPH_PROJECT_PATH;
  const selected = fromQuery ?? fromBody ?? fromEnv ?? null;

  if (!selected) {
    return null;
  }

  return path.resolve(selected);
}

async function validateProjectPath(projectPath: string): Promise<string | null> {
  try {
    const target = await stat(projectPath);

    if (!target.isDirectory()) {
      return "Project path is not a directory.";
    }
  } catch {
    return "Project path not found.";
  }

  return null;
}

function toStatusCode(error: ProcessManagerError): number {
  if (error.code === "ALREADY_RUNNING") {
    return 409;
  }

  return 500;
}

export async function POST(request: Request): Promise<Response> {
  let payload: ResumeRunPayload = {};

  try {
    const parsed = (await request.json()) as unknown;

    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      payload = parsed as ResumeRunPayload;
    } else {
      return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
    }
  } catch {
    payload = {};
  }

  const projectPath = resolveProjectPath(request, payload);
  if (!projectPath) {
    return NextResponse.json(
      {
        error: "Missing project path. Provide ?projectPath=/abs/path, payload projectPath, or set RALPH_PROJECT_PATH.",
      },
      { status: 400 },
    );
  }

  const projectError = await validateProjectPath(projectPath);
  if (projectError) {
    return NextResponse.json({ error: projectError }, { status: projectError.includes("not found") ? 404 : 400 });
  }

  const normalizedFlags = normalizeFlags(payload.flags);
  if (!normalizedFlags.ok) {
    return NextResponse.json({ error: normalizedFlags.error }, { status: 400 });
  }

  try {
    const socket = await terminalSocketServer.ensureStarted();
    const processInfo = processManager.resumeRalph({
      cwd: projectPath,
      flags: normalizedFlags.flags,
    });

    return NextResponse.json({ ok: true, process: processInfo, socket });
  } catch (error) {
    if (error instanceof ProcessManagerError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: toStatusCode(error) });
    }

    const message = error instanceof Error ? error.message : "Unexpected process resume error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
