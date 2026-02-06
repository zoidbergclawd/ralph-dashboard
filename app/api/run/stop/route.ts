import { NextResponse } from "next/server";

import { ProcessManagerError, processManager } from "@/lib/process-manager";

interface StopRunPayload {
  pid?: unknown;
  signal?: unknown;
}

function toStatusCode(error: ProcessManagerError): number {
  if (error.code === "NO_ACTIVE_PROCESS") {
    return 404;
  }

  if (error.code === "PID_MISMATCH") {
    return 409;
  }

  return 500;
}

export async function POST(request: Request): Promise<Response> {
  let payload: StopRunPayload = {};

  try {
    const parsed = (await request.json()) as unknown;

    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      payload = parsed as StopRunPayload;
    } else {
      return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
    }
  } catch {
    payload = {};
  }

  if (payload.pid !== undefined && (!Number.isInteger(payload.pid) || Number(payload.pid) <= 0)) {
    return NextResponse.json({ error: "pid must be a positive integer." }, { status: 400 });
  }

  if (payload.signal !== undefined && typeof payload.signal !== "string" && typeof payload.signal !== "number") {
    return NextResponse.json({ error: "signal must be a string or number." }, { status: 400 });
  }

  try {
    const processInfo = processManager.stopProcess({
      pid: payload.pid as number | undefined,
      signal: payload.signal as NodeJS.Signals | number | undefined,
    });

    return NextResponse.json({ ok: true, process: processInfo });
  } catch (error) {
    if (error instanceof ProcessManagerError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: toStatusCode(error) });
    }

    const message = error instanceof Error ? error.message : "Unexpected process stop error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
