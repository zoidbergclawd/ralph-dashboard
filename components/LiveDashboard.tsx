"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";

import GitPanel from "@/components/GitPanel";
import KanbanBoard from "@/components/KanbanBoard";
import MetricsPanel from "@/components/MetricsPanel";
import ProgressPanel from "@/components/ProgressPanel";
import { useDashboardState } from "@/hooks/use-dashboard-state";

const DEFAULT_ERROR_MESSAGE = "Unable to load dashboard state.";

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

      <ProgressPanel items={data.ralph.items} startedAt={startedAt} />

      <div className="grid gap-6 lg:grid-cols-2">
        <MetricsPanel
          totalLoc={data.metrics.totalLoc}
          fileCount={data.metrics.fileCount}
          testCount={data.metrics.testFileCount}
          coveragePct={coveragePct}
        />
        <GitPanel git={data.git} />
      </div>

      <KanbanBoard items={data.ralph.items} />
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
