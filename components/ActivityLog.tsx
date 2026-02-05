"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import type { RalphState, UnifiedPRDItem } from "@/lib/ralph-state";

type ActivityLevel = "success" | "warning" | "failure";

interface ActivityEntry {
  id: string;
  timestamp: string | null;
  timestampLabel: string;
  itemCompleted: string;
  filesChanged: string[];
  level: ActivityLevel;
}

interface ActivityLogProps {
  state: RalphState | null;
  items: UnifiedPRDItem[];
}

function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) {
    return "Unknown time";
  }

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown time";
  }

  return parsed.toLocaleString();
}

function getActivityLevel(testsPassed: boolean, route: string): ActivityLevel {
  if (testsPassed) {
    return "success";
  }

  const normalizedRoute = route.toLowerCase();
  if (normalizedRoute.includes("fail") || normalizedRoute.includes("error") || normalizedRoute.includes("abort")) {
    return "failure";
  }

  return "warning";
}

function parseActivityEntries(state: RalphState | null, items: UnifiedPRDItem[]): ActivityEntry[] {
  if (!state) {
    return [];
  }

  const titleById = new Map(items.map((item) => [item.id, item.title]));

  return [...state.checkpoints]
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime())
    .map((checkpoint) => {
      const title = titleById.get(checkpoint.item_id);
      return {
        id: `${checkpoint.commit_sha}-${checkpoint.timestamp}`,
        timestamp: checkpoint.timestamp,
        timestampLabel: formatTimestamp(checkpoint.timestamp),
        itemCompleted: title ? `Item #${checkpoint.item_id} completed: ${title}` : `Item #${checkpoint.item_id} completed`,
        filesChanged: checkpoint.files_changed,
        level: getActivityLevel(checkpoint.tests_passed, checkpoint.route),
      };
    });
}

function levelClasses(level: ActivityLevel): string {
  switch (level) {
    case "success":
      return "border-green-500/40 bg-green-500/10";
    case "warning":
      return "border-amber-500/40 bg-amber-500/10";
    case "failure":
      return "border-red-500/40 bg-red-500/10";
  }
}

export default function ActivityLog({ state, items }: ActivityLogProps) {
  const [pauseAutoScroll, setPauseAutoScroll] = useState(false);
  const scrollContainerRef = useRef<HTMLOListElement | null>(null);
  const entries = useMemo(() => parseActivityEntries(state, items), [state, items]);

  useEffect(() => {
    if (pauseAutoScroll) {
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [entries, pauseAutoScroll]);

  return (
    <section className="rounded-lg border border-border bg-card p-4 text-card-foreground md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Activity Log</h2>
        <p className="text-xs text-muted-foreground">{entries.length} events</p>
      </div>

      {entries.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
          No activity yet. Checkpoints will appear as Ralph progresses through items.
        </p>
      ) : (
        <ol
          ref={scrollContainerRef}
          className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1"
          onMouseEnter={() => setPauseAutoScroll(true)}
          onMouseLeave={() => setPauseAutoScroll(false)}
        >
          {entries.map((entry) => (
            <li key={entry.id} className={`rounded-md border p-3 ${levelClasses(entry.level)}`} data-testid={`activity-entry-${entry.level}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{entry.itemCompleted}</p>
                <time className="text-xs text-muted-foreground" dateTime={entry.timestamp ?? undefined}>
                  {entry.timestampLabel}
                </time>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {entry.filesChanged.length} file{entry.filesChanged.length === 1 ? "" : "s"} changed
              </p>
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{entry.filesChanged.join(", ") || "No file changes recorded"}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
