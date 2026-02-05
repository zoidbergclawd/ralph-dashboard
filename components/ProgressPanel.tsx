"use client";

import React, { useMemo } from "react";

import type { UnifiedPRDItem } from "@/lib/ralph-state";

interface ProgressPanelProps {
  items: UnifiedPRDItem[];
  startedAt: string | null;
  now?: Date;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours.toString().padStart(2, "0")}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  }

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export default function ProgressPanel({ items, startedAt, now = new Date() }: ProgressPanelProps) {
  const stats = useMemo(() => {
    const totalItems = items.length;
    const completedItems = items.filter((item) => item.passes).length;
    const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    const currentItem = items.find((item) => item.isCurrent && !item.passes) ?? items.find((item) => item.isCurrent) ?? null;
    const startedAtDate = startedAt ? new Date(startedAt) : null;
    const hasValidStart = startedAtDate !== null && !Number.isNaN(startedAtDate.getTime());
    const elapsedMs = hasValidStart ? Math.max(0, now.getTime() - startedAtDate.getTime()) : null;
    const averagePerItemMs = elapsedMs !== null && completedItems > 0 ? elapsedMs / completedItems : null;
    const remainingItems = Math.max(0, totalItems - completedItems);
    const etaMs = averagePerItemMs !== null ? averagePerItemMs * remainingItems : null;

    return {
      totalItems,
      completedItems,
      progressPercent,
      currentItemTitle: currentItem?.title ?? "No item in progress",
      elapsedLabel: elapsedMs !== null ? formatDuration(elapsedMs) : "N/A",
      averageLabel: averagePerItemMs !== null ? formatDuration(averagePerItemMs) : "N/A",
      etaLabel: etaMs !== null ? formatDuration(etaMs) : "N/A",
    };
  }, [items, now, startedAt]);

  return (
    <section className="rounded-lg border border-border bg-card p-4 text-card-foreground md:p-6">
      <h2 className="text-lg font-semibold">Run Progress</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {stats.completedItems} of {stats.totalItems} items complete
      </p>

      <div className="mt-4">
        <div
          role="progressbar"
          aria-label="Overall progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={stats.progressPercent}
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full bg-primary transition-[width] duration-300"
            style={{ width: `${stats.progressPercent}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{stats.progressPercent}% complete</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-background/50 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Elapsed</p>
          <p className="mt-1 text-sm font-medium">{stats.elapsedLabel}</p>
        </div>
        <div className="rounded-md border border-border bg-background/50 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Avg / item</p>
          <p className="mt-1 text-sm font-medium">{stats.averageLabel}</p>
        </div>
        <div className="rounded-md border border-border bg-background/50 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">ETA</p>
          <p className="mt-1 text-sm font-medium">{stats.etaLabel}</p>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-amber-400/50 bg-amber-400/10 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Current Item</p>
        <p className="mt-1 text-base font-semibold">{stats.currentItemTitle}</p>
      </div>
    </section>
  );
}
