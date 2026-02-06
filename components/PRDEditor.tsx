"use client";

import React, { useEffect, useMemo, useState } from "react";

import type { PRDDocument, PRDItem } from "@/lib/ralph-state";

interface PRDEditorProps {
  projectPath?: string;
}

interface PRDResponse {
  prd: PRDDocument;
}

const EMPTY_DOCUMENT: PRDDocument = {
  project: null,
  goal: null,
  items: [],
};

function createNewItem(existingItems: PRDItem[]): PRDItem {
  const nextId = existingItems.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1;

  return {
    id: nextId,
    category: "ui",
    title: "New item",
    description: "",
    priority: 1,
    passes: false,
    verification: "",
    steps: [],
    notes: "",
  };
}

function moveItem(items: PRDItem[], fromId: number, toId: number): PRDItem[] {
  const fromIndex = items.findIndex((item) => item.id === fromId);
  const toIndex = items.findIndex((item) => item.id === toId);

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return items;
  }

  const updated = [...items];
  const [dragged] = updated.splice(fromIndex, 1);
  updated.splice(toIndex, 0, dragged);
  return updated;
}

function parseSteps(value: string): string[] {
  return value
    .split("\n")
    .map((step) => step.trim())
    .filter((step) => step.length > 0);
}

function toApiUrl(projectPath: string): string {
  return `/api/prd?projectPath=${encodeURIComponent(projectPath)}`;
}

export default function PRDEditor({ projectPath }: PRDEditorProps) {
  const [document, setDocument] = useState<PRDDocument>(EMPTY_DOCUMENT);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [draggingItemId, setDraggingItemId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!projectPath) {
      setDocument(EMPTY_DOCUMENT);
      setSelectedItemId(null);
      setLoadError("Project path is required to edit PRD items.");
      return;
    }

    let isCancelled = false;

    const loadDocument = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetch(toApiUrl(projectPath), { cache: "no-store" });
        const payload = (await response.json()) as PRDResponse | { error?: string };

        if (!response.ok) {
          const message = "error" in payload && typeof payload.error === "string" ? payload.error : "Failed to load PRD.";
          throw new Error(message);
        }

        if (isCancelled) {
          return;
        }

        const loaded = (payload as PRDResponse).prd;
        setDocument({
          project: loaded.project,
          goal: loaded.goal,
          items: loaded.items,
        });
        setSelectedItemId(loaded.items[0]?.id ?? null);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "Failed to load PRD.";
        setLoadError(message);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadDocument();

    return () => {
      isCancelled = true;
    };
  }, [projectPath]);

  const selectedItem = useMemo(
    () => document.items.find((item) => item.id === selectedItemId) ?? null,
    [document.items, selectedItemId],
  );

  const updateSelectedItem = (patch: Partial<PRDItem>) => {
    if (!selectedItemId) {
      return;
    }

    setDocument((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === selectedItemId ? { ...item, ...patch } : item)),
    }));
    setSavedMessage(null);
    setSaveError(null);
  };

  const handleAddItem = () => {
    setDocument((current) => {
      const created = createNewItem(current.items);
      setSelectedItemId(created.id);
      return {
        ...current,
        items: [...current.items, created],
      };
    });
    setSavedMessage(null);
    setSaveError(null);
  };

  const handleDeleteItem = () => {
    if (!selectedItem) {
      return;
    }

    setDocument((current) => {
      const nextItems = current.items.filter((item) => item.id !== selectedItem.id);
      const fallbackItemId = nextItems[0]?.id ?? null;
      setSelectedItemId(fallbackItemId);

      return {
        ...current,
        items: nextItems,
      };
    });
    setSavedMessage(null);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!projectPath) {
      setSaveError("Project path is required to save PRD items.");
      return;
    }

    setIsSaving(true);
    setSavedMessage(null);
    setSaveError(null);

    try {
      const response = await fetch(toApiUrl(projectPath), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(document),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        const message = typeof payload.error === "string" ? payload.error : "Failed to save PRD.";
        throw new Error(message);
      }

      setSavedMessage("Saved PRD changes.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save PRD.";
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDropOnItem = (targetId: number) => {
    if (!draggingItemId) {
      return;
    }

    setDocument((current) => ({
      ...current,
      items: moveItem(current.items, draggingItemId, targetId),
    }));
    setDraggingItemId(null);
    setSavedMessage(null);
    setSaveError(null);
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4 text-card-foreground md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">PRD Editor</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddItem}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
          >
            Add item
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLoading || !projectPath}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>

      {loadError ? <p className="mt-3 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{loadError}</p> : null}
      {saveError ? <p className="mt-3 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{saveError}</p> : null}
      {savedMessage ? <p className="mt-3 rounded-md border border-green-400/40 bg-green-500/10 px-3 py-2 text-sm text-green-200">{savedMessage}</p> : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-border bg-background/60 p-3">
          <p className="text-sm font-medium">Items</p>

          {isLoading ? <p className="mt-3 text-sm text-muted-foreground">Loading PRD...</p> : null}

          {!isLoading && document.items.length === 0 ? (
            <p className="mt-3 rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">No PRD items.</p>
          ) : null}

          <ul className="mt-3 space-y-2">
            {document.items.map((item) => {
              const isSelected = selectedItemId === item.id;

              return (
                <li
                  key={item.id}
                  data-testid={`item-row-${item.id}`}
                  draggable
                  onDragStart={() => setDraggingItemId(item.id)}
                  onDragEnd={() => setDraggingItemId(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleDropOnItem(item.id)}
                  className={[
                    "cursor-grab rounded-md border border-border p-2",
                    isSelected ? "bg-accent" : "bg-card",
                  ].join(" ")}
                >
                  <button type="button" onClick={() => setSelectedItemId(item.id)} className="w-full text-left">
                    <p className="text-sm font-medium">{item.title || "Untitled item"}</p>
                    <p className="text-xs text-muted-foreground">#{item.id} {item.category}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-md border border-border bg-background/60 p-3">
          {selectedItem ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Edit item #{selectedItem.id}</p>
                <button
                  type="button"
                  onClick={handleDeleteItem}
                  className="rounded-md border border-red-300/40 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                >
                  Delete
                </button>
              </div>

              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Title</span>
                <input
                  value={selectedItem.title}
                  onChange={(event) => updateSelectedItem({ title: event.target.value })}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Description</span>
                <textarea
                  value={selectedItem.description}
                  onChange={(event) => updateSelectedItem({ description: event.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Steps (one per line)</span>
                <textarea
                  value={selectedItem.steps.join("\n")}
                  onChange={(event) => updateSelectedItem({ steps: parseSteps(event.target.value) })}
                  rows={5}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                />
              </label>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select an item to edit.</p>
          )}
        </div>
      </div>
    </section>
  );
}
