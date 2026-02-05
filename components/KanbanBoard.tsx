"use client";

import React from "react";
import { useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";

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
  const allItemsComplete = items.length > 0 && items.every((item) => item.passes);

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
      <LayoutGroup>
        <h2 className="text-lg font-semibold">PRD Progress</h2>
        <AnimatePresence>
          {allItemsComplete ? (
            <motion.div
              key="completion-celebration"
              data-testid="completion-celebration"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="mt-3 flex items-center justify-center gap-2 rounded-md border border-amber-300/70 bg-amber-100/70 px-3 py-2 text-sm font-medium text-amber-900"
            >
              <motion.span
                aria-hidden
                animate={{ rotate: [0, 14, -14, 0], y: [0, -2, 0] }}
                transition={{ duration: 0.8, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY, repeatDelay: 0.2 }}
              >
                🎉
              </motion.span>
              <span>All items complete</span>
              <motion.span
                aria-hidden
                animate={{ rotate: [0, -14, 14, 0], y: [0, -2, 0] }}
                transition={{ duration: 0.8, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY, repeatDelay: 0.2 }}
              >
                🎉
              </motion.span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {columns.map((column) => (
            <motion.div
              key={column.key}
              layout
              data-testid={`column-${column.key}`}
              className="rounded-md border border-border bg-background/60 p-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{column.title}</h3>
                <span className="text-xs text-muted-foreground">{column.items.length}</span>
              </div>

              <div className="mt-3 space-y-2">
                <AnimatePresence initial={false} mode="popLayout">
                  {column.items.length === 0 ? (
                    <motion.p
                      key={`${column.key}-empty`}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="rounded border border-dashed border-border p-3 text-xs text-muted-foreground"
                    >
                      No items
                    </motion.p>
                  ) : (
                    column.items.map((item) => {
                      const isExpanded = expandedId === item.id;
                      const isCurrent = item.isCurrent && !item.passes;

                      return (
                        <motion.button
                          key={item.id}
                          layout
                          layoutId={`kanban-item-${item.id}`}
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                          aria-expanded={isExpanded}
                          initial={{ opacity: 0, y: 10, scale: 0.98 }}
                          animate={
                            isCurrent
                              ? {
                                  opacity: 1,
                                  y: 0,
                                  scale: [1, 1.01, 1],
                                  boxShadow: [
                                    "0 0 0 rgba(251,191,36,0)",
                                    "0 0 18px rgba(251,191,36,0.35)",
                                    "0 0 0 rgba(251,191,36,0)",
                                  ],
                                }
                              : {
                                  opacity: 1,
                                  y: 0,
                                  scale: 1,
                                  boxShadow: "0 0 0 rgba(251,191,36,0)",
                                }
                          }
                          exit={{ opacity: 0, y: -8, scale: 0.98 }}
                          transition={
                            isCurrent
                              ? {
                                  opacity: { duration: 0.2 },
                                  y: { duration: 0.2 },
                                  scale: {
                                    duration: 1.4,
                                    ease: "easeInOut",
                                    repeat: Number.POSITIVE_INFINITY,
                                  },
                                  boxShadow: {
                                    duration: 1.4,
                                    ease: "easeInOut",
                                    repeat: Number.POSITIVE_INFINITY,
                                  },
                                }
                              : { duration: 0.2, ease: "easeOut" }
                          }
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

                          <AnimatePresence initial={false}>
                            {isExpanded ? (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                                className="mt-3 space-y-2 overflow-hidden border-t border-border pt-3 text-xs text-muted-foreground"
                              >
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
                              </motion.div>
                            ) : null}
                          </AnimatePresence>
                        </motion.button>
                      );
                    })
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </div>
      </LayoutGroup>
    </section>
  );
}
