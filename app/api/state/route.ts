import { stat } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { readCodeMetrics } from "@/lib/code-metrics";
import { readCoverageState } from "@/lib/coverage-state";
import { readGitState } from "@/lib/git-state";
import { getRalphUnifiedView } from "@/lib/ralph-state";

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

  try {
    const target = await stat(projectPath);

    if (!target.isDirectory()) {
      return NextResponse.json({ error: "Project path is not a directory." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Project path not found." }, { status: 404 });
  }

  try {
    const [ralph, git, metrics, coverage] = await Promise.all([
      getRalphUnifiedView(projectPath),
      readGitState(projectPath),
      readCodeMetrics(projectPath),
      readCoverageState(projectPath),
    ]);

    const fatalStateFailure =
      ralph.state === null &&
      ralph.prd === null &&
      Boolean(ralph.errors.state) &&
      Boolean(ralph.errors.prd) &&
      Boolean(git.error) &&
      Boolean(metrics.error);

    const status = fatalStateFailure ? 500 : 200;

    return NextResponse.json(
      {
        projectPath,
        timestamp: new Date().toISOString(),
        ralph,
        git,
        metrics,
        coverage,
      },
      { status },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
