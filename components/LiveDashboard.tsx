"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";

import ActivityLog from "@/components/ActivityLog";
import ControlBar from "@/components/ControlBar";
import GitPanel from "@/components/GitPanel";
import KanbanBoard from "@/components/KanbanBoard";
import MetricsPanel from "@/components/MetricsPanel";
import PRDEditor from "@/components/PRDEditor";
import ProgressPanel from "@/components/ProgressPanel";
import TerminalView, { type TerminalSocketConfig } from "@/components/TerminalView";
import { useDashboardState } from "@/hooks/use-dashboard-state";

const DEFAULT_ERROR_MESSAGE = "Unable to load dashboard state.";
const PROJECT_PATH_STORAGE_KEY = "ralph-dashboard:last-project-path";

function normalizeProjectPath(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readStoredProjectPath(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return normalizeProjectPath(window.localStorage.getItem(PROJECT_PATH_STORAGE_KEY));
}

function persistProjectPath(projectPath: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PROJECT_PATH_STORAGE_KEY, projectPath);
}

function formatLastUpdated(isoTimestamp: string | undefined): string {
  if (!isoTimestamp) {
    return "Never";
  }

  const timestamp = new Date(isoTimestamp);
  if (Number.isNaN(timestamp.getTime())) {
    return "Unknown";
  }

  return timestamp.toLocaleTimeString();
}

function DashboardBody() {
  const searchParams = useSearchParams();
  const urlProjectPath = normalizeProjectPath(searchParams.get("path"));
  const [selectedProjectPath, setSelectedProjectPath] = useState<string | undefined>(urlProjectPath ?? undefined);
  const [socketConfig, setSocketConfig] = useState<TerminalSocketConfig | undefined>(undefined);
  const { data, error, isPending, isFetching, dataUpdatedAt } = useDashboardState(selectedProjectPath);
  const [showUpdated, setShowUpdated] = useState(false);

  useEffect(() => {
    if (urlProjectPath) {
      setSelectedProjectPath(urlProjectPath);
      persistProjectPath(urlProjectPath);
      return;
    }

    const storedPath = readStoredProjectPath();
    if (storedPath) {
      setSelectedProjectPath(storedPath);
      return;
    }

    setSelectedProjectPath(undefined);
  }, [urlProjectPath]);

  useEffect(() => {
    if (!dataUpdatedAt) {
      return;
    }

    setShowUpdated(true);
    const timeout = window.setTimeout(() => setShowUpdated(false), 800);
    return () => window.clearTimeout(timeout);
  }, [dataUpdatedAt]);

  useEffect(() => {
    const resolvedProjectPath = normalizeProjectPath(data?.projectPath);
    if (!resolvedProjectPath) {
      return;
    }

    persistProjectPath(resolvedProjectPath);
  }, [data?.projectPath]);

  const currentProjectPath = data?.projectPath ?? selectedProjectPath ?? "Not configured";

  const header = (
    <header className="rounded-lg border border-border bg-card px-4 py-3 text-card-foreground md:px-5">
      <h2 className="text-lg font-semibold tracking-tight">Run Overview</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Project path: <code className="text-foreground">{currentProjectPath}</code>
      </p>
    </header>
  );

  if (isPending && !data) {
    return (
      <div className="space-y-6">
        {header}
        <section className="rounded-lg border border-border bg-card p-6 text-card-foreground">
          <p className="text-sm text-muted-foreground">Loading live run state...</p>
        </section>
      </div>
    );
  }

  if (error || !data) {
    const message = error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE;

    return (
      <div className="space-y-6">
        {header}
        <section className="rounded-lg border border-red-500/40 bg-red-500/10 p-6 text-card-foreground">
          <p className="text-sm text-red-200">{message}</p>
        </section>
      </div>
    );
  }

  const coveragePct = data.coverage.total?.lines.pct ?? null;
  const startedAt = data.ralph.state?.started_at ?? null;
  const runStatus = data.ralph.state?.current_action ? "running" : "stopped";

  return (
    <div className="space-y-6">
      {header}
      <section className="rounded-lg border border-border bg-card p-4 text-card-foreground md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${isFetching ? "bg-amber-400 animate-pulse" : "bg-green-500"}`} />
            <p className="font-medium">{isFetching ? "Refreshing..." : "Live updates active"}</p>
            {showUpdated ? <p className="text-green-400">Updated just now</p> : null}
          </div>
          <p className="text-muted-foreground">Last updated: {formatLastUpdated(data.timestamp)}</p>
        </div>
      </section>

      <ControlBar
        projectPath={data.projectPath ?? selectedProjectPath}
        initialStatus={runStatus}
        onSocketConfigChange={setSocketConfig}
      />

      <TerminalView socketConfig={socketConfig} />

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <KanbanBoard items={data.ralph.items} />
        </div>

        <aside className="space-y-6 xl:col-span-4">
          <ProgressPanel items={data.ralph.items} startedAt={startedAt} />
          <GitPanel git={data.git} />
          <MetricsPanel
            totalLoc={data.metrics.totalLoc}
            fileCount={data.metrics.fileCount}
            testCount={data.metrics.testFileCount}
            coveragePct={coveragePct}
          />
        </aside>
      </section>

      <PRDEditor projectPath={data.projectPath ?? selectedProjectPath} />

      <ActivityLog state={data.ralph.state} items={data.ralph.items} />
    </div>
  );
}

export default function LiveDashboard() {
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <DashboardBody />
    </QueryClientProvider>
  );
}
