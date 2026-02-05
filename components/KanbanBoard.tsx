"use client";

import React from "react";
import { useMemo, useState } from "react";

import type { UnifiedPRDItem } from "@/lib/ralph-state";

interface KanbanBoardProps {
  items: UnifiedPRDItem[];
}

interface KanbanColumn {
  key: "backlog" | "in_progress" | "done";
  title: string;
  items: UnifiedPRDItem[];
}

function getPriorityLabel(priority: number): string {
  if (priority <= 1) {
    return "High";
  }
  if (priority === 2) {
    return "Medium";
  }
  return "Low";
}

export default function KanbanBoard({ items }: KanbanBoardProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const columns = useMemo<KanbanColumn[]>(() => {
    const done = items.filter((item) => item.passes);
    const inProgress = items.filter((item) => !item.passes && item.isCurrent);
    const backlog = items.filter((item) => !item.passes && !item.isCurrent);

    return [
      { key: "backlog", title: "Backlog", items: backlog },
      { key: "in_progress", title: "In Progress", items: inProgress },
      { key: "done", title: "Done", items: done },
    ];
  }, [items]);

  return (
    <section className="rounded-lg border border-border bg-card p-4 text-card-foreground md:p-6">
      <h2 className="text-lg font-semibold">PRD Progress</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {columns.map((column) => (
          <div
            key={column.key}
            data-testid={`column-${column.key}`}
            className="rounded-md border border-border bg-background/60 p-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{column.title}</h3>
              <span className="text-xs text-muted-foreground">{column.items.length}</span>
            </div>

            <div className="mt-3 space-y-2">
              {column.items.length === 0 ? (
                <p className="rounded border border-dashed border-border p-3 text-xs text-muted-foreground">
                  No items
                </p>
              ) : (
                column.items.map((item) => {
                  const isExpanded = expandedId === item.id;
                  const isCurrent = item.isCurrent && !item.passes;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      aria-expanded={isExpanded}
                      className={[
                        "w-full rounded-md border p-3 text-left transition-colors",
                        "border-border bg-card hover:bg-accent/50",
                        isCurrent ? "animate-pulse border-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.35)]" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{item.title}</p>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                          {item.category}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
                        <span className="text-xs text-muted-foreground">
                          P{item.priority} {getPriorityLabel(item.priority)}
                        </span>
                      </div>

                      {isExpanded ? (
                        <div className="mt-3 space-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
                          <p>{item.description}</p>
                          <div>
                            <p className="font-medium text-foreground">Steps</p>
                            {item.steps.length > 0 ? (
                              <ul className="list-disc space-y-1 pl-4">
                                {item.steps.map((step) => (
                                  <li key={step}>{step}</li>
                                ))}
                              </ul>
                            ) : (
                              <p>No steps listed.</p>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Verification</p>
                            <p>{item.verification}</p>
                          </div>
                        </div>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
