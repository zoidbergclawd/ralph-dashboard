import { NextResponse } from "next/server";

export async function GET(): Promise<Response> {
  return NextResponse.json(
    {
      ok: true,
      service: "ralph-dashboard",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
