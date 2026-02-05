"use client";

import { useMemo, useState } from "react";

export type KanbanItem = {
  id: number;
  title: string;
  category: string;
  priority: number;
  description: string;
  verification: string;
  steps: string[];
  passes?: boolean;
};

type KanbanBoardProps = {
  items: KanbanItem[];
  currentItemId?: number | null;
  className?: string;
};

type ColumnKey = "backlog" | "inProgress" | "done";

type Column = {
  key: ColumnKey;
  title: string;
  items: KanbanItem[];
};

function priorityStyle(priority: number): string {
  if (priority <= 1) return "bg-red-500/15 text-red-300 ring-red-400/50";
  if (priority === 2) return "bg-amber-500/15 text-amber-300 ring-amber-400/50";
  return "bg-emerald-500/15 text-emerald-300 ring-emerald-400/50";
}

function categoryStyle(category: string): string {
  switch (category) {
    case "core":
      return "bg-cyan-500/15 text-cyan-200 ring-cyan-400/40";
    case "ui":
      return "bg-fuchsia-500/15 text-fuchsia-200 ring-fuchsia-400/40";
    case "api":
      return "bg-indigo-500/15 text-indigo-200 ring-indigo-400/40";
    case "setup":
      return "bg-slate-500/20 text-slate-200 ring-slate-400/40";
    default:
      return "bg-zinc-500/20 text-zinc-200 ring-zinc-400/40";
  }
}

export default function KanbanBoard({ items, currentItemId, className }: KanbanBoardProps) {
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());

  const columns = useMemo<Column[]>(() => {
    const backlog: KanbanItem[] = [];
    const inProgress: KanbanItem[] = [];
    const done: KanbanItem[] = [];

    for (const item of items) {
      if (item.passes === true) {
        done.push(item);
      } else if (currentItemId != null && item.id === currentItemId) {
        inProgress.push(item);
      } else {
        backlog.push(item);
      }
    }

    return [
      { key: "backlog", title: "Backlog", items: backlog },
      { key: "inProgress", title: "In Progress", items: inProgress },
      { key: "done", title: "Done", items: done },
    ];
  }, [items, currentItemId]);

  const toggleExpanded = (id: number) => {
    setExpandedCards((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <section className={className} aria-label="PRD Progress Board">
      <div className="grid gap-4 md:grid-cols-3">
        {columns.map((column) => (
          <div key={column.key} className="rounded-xl border border-zinc-700/70 bg-zinc-900/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-200">{column.title}</h2>
              <span className="rounded-full bg-zinc-700/60 px-2 py-0.5 text-xs text-zinc-300">{column.items.length}</span>
            </div>

            <div className="space-y-3">
              {column.items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-700 p-3 text-xs text-zinc-500">
                  No items
                </p>
              ) : (
                column.items.map((item) => {
                  const isExpanded = expandedCards.has(item.id);
                  const isCurrent = currentItemId != null && item.id === currentItemId && item.passes !== true;

                  return (
                    <article
                      key={item.id}
                      className={[
                        "rounded-lg border bg-zinc-950/80 p-3 transition",
                        isCurrent
                          ? "border-emerald-400/70 shadow-[0_0_0_1px_rgba(52,211,153,0.35),0_0_22px_rgba(52,211,153,0.3)] animate-pulse"
                          : "border-zinc-800 hover:border-zinc-700",
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        onClick={() => toggleExpanded(item.id)}
                        aria-expanded={isExpanded}
                        className="w-full text-left"
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span
                            className={[
                              "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1",
                              categoryStyle(item.category),
                            ].join(" ")}
                          >
                            {item.category}
                          </span>
                          <span
                            className={[
                              "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1",
                              priorityStyle(item.priority),
                            ].join(" ")}
                          >
                            P{item.priority}
                          </span>
                          {isCurrent ? (
                            <span className="inline-flex rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-medium text-emerald-200 ring-1 ring-emerald-400/50">
                              Current
                            </span>
                          ) : null}
                        </div>
                        <h3 className="text-sm font-medium text-zinc-100">{item.title}</h3>
                      </button>

                      {isExpanded ? (
                        <div className="mt-3 space-y-3 border-t border-zinc-800 pt-3 text-xs text-zinc-300">
                          <p>{item.description}</p>
                          <div>
                            <p className="mb-1 font-semibold text-zinc-200">Steps</p>
                            <ol className="list-inside list-decimal space-y-1">
                              {item.steps.map((step, index) => (
                                <li key={`${item.id}-step-${index}`}>{step}</li>
                              ))}
                            </ol>
                          </div>
                          <div>
                            <p className="mb-1 font-semibold text-zinc-200">Verification</p>
                            <p>{item.verification}</p>
                          </div>
                        </div>
                      ) : null}
                    </article>
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
