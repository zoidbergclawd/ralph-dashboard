"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";

import GitPanel from "@/components/GitPanel";
import KanbanBoard from "@/components/KanbanBoard";
import MetricsPanel from "@/components/MetricsPanel";
import ProgressPanel from "@/components/ProgressPanel";
import { useDashboardState } from "@/hooks/use-dashboard-state";

const DEFAULT_ERROR_MESSAGE = "Unable to load dashboard state.";
const MAX_ACTIVITY_ENTRIES = 8;

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

function formatActivityTimestamp(isoTimestamp: string | null | undefined): string {
  if (!isoTimestamp) {
    return "Unknown time";
  }

  const timestamp = new Date(isoTimestamp);
  if (Number.isNaN(timestamp.getTime())) {
    return "Unknown time";
  }

  return timestamp.toLocaleString();
}

function DashboardBody() {
  const { data, error, isPending, isFetching, dataUpdatedAt } = useDashboardState();
  const [showUpdated, setShowUpdated] = useState(false);

  useEffect(() => {
    if (!dataUpdatedAt) {
      return;
    }

    setShowUpdated(true);
    const timeout = window.setTimeout(() => setShowUpdated(false), 800);
    return () => window.clearTimeout(timeout);
  }, [dataUpdatedAt]);

  if (isPending && !data) {
    return (
      <section className="rounded-lg border border-border bg-card p-6 text-card-foreground">
        <h2 className="text-lg font-medium">Run Overview</h2>
        <p className="mt-2 text-sm text-muted-foreground">Loading live run state...</p>
      </section>
    );
  }

  if (error || !data) {
    const message = error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE;

    return (
      <section className="rounded-lg border border-red-500/40 bg-red-500/10 p-6 text-card-foreground">
        <h2 className="text-lg font-semibold">Run Overview</h2>
        <p className="mt-2 text-sm text-red-200">{message}</p>
      </section>
    );
  }

  const coveragePct = data.coverage.total?.lines.pct ?? null;
  const startedAt = data.ralph.state?.started_at ?? null;
  const activityItems = [...(data.ralph.state?.checkpoints ?? [])]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, MAX_ACTIVITY_ENTRIES);

  return (
    <div className="space-y-6">
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

      <section className="rounded-lg border border-border bg-card p-4 text-card-foreground md:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Activity Log</h2>
          <p className="text-xs text-muted-foreground">{activityItems.length} recent events</p>
        </div>

        {activityItems.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
            No activity yet. Checkpoints will appear as Ralph progresses through items.
          </p>
        ) : (
          <ol className="mt-4 space-y-2">
            {activityItems.map((checkpoint) => (
              <li key={`${checkpoint.commit_sha}-${checkpoint.timestamp}`} className="rounded-md border border-border bg-background/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">Item #{checkpoint.item_id}</p>
                  <p className="text-xs text-muted-foreground">{formatActivityTimestamp(checkpoint.timestamp)}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Commit <span className="font-mono text-foreground">{checkpoint.commit_sha.slice(0, 8)}</span>
                  {" · "}
                  {checkpoint.tests_passed ? "tests passed" : "tests pending/failed"}
                  {" · "}
                  {checkpoint.files_changed.length} files changed
                </p>
                {checkpoint.route ? <p className="mt-1 text-xs text-muted-foreground">Route: {checkpoint.route}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </section>
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
