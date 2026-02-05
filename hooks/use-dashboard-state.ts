"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { CodeMetrics } from "@/lib/code-metrics";
import type { CoverageState } from "@/lib/coverage-state";
import type { GitState } from "@/lib/git-state";
import type { RalphUnifiedView } from "@/lib/ralph-state";

export const DASHBOARD_POLL_INTERVAL_MS = 2000;

export interface DashboardStateResponse {
  projectPath: string;
  timestamp: string;
  ralph: RalphUnifiedView;
  git: GitState;
  metrics: CodeMetrics;
  coverage: CoverageState;
}

async function fetchDashboardState(projectPath?: string): Promise<DashboardStateResponse> {
  const params = new URLSearchParams();
  if (projectPath) {
    params.set("projectPath", projectPath);
  }

  const query = params.toString();
  const url = query.length > 0 ? `/api/state?${query}` : "/api/state";

  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json()) as DashboardStateResponse | { error?: string };

  if (!response.ok) {
    const message = "error" in payload && typeof payload.error === "string" ? payload.error : "Failed to load dashboard state";
    throw new Error(message);
  }

  return payload as DashboardStateResponse;
}

export function useDashboardState(projectPath?: string) {
  return useQuery({
    queryKey: ["dashboard-state", projectPath ?? null],
    queryFn: () => fetchDashboardState(projectPath),
    refetchInterval: DASHBOARD_POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
    placeholderData: keepPreviousData,
    retry: 1,
  });
}
