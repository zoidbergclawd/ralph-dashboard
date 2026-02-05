import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import KanbanBoard from "@/components/KanbanBoard";
import type { UnifiedPRDItem } from "@/lib/ralph-state";

const items: UnifiedPRDItem[] = [
  {
    id: 1,
    category: "setup",
    title: "Backlog Item",
    description: "Backlog description",
    priority: 2,
    passes: false,
    verification: "Backlog verification",
    steps: ["Backlog step"],
    notes: "",
    status: "backlog",
    isCurrent: false,
  },
  {
    id: 2,
    category: "ui",
    title: "Current Item",
    description: "Current description",
    priority: 1,
    passes: false,
    verification: "Current verification",
    steps: ["Current step 1", "Current step 2"],
    notes: "",
    status: "in_progress",
    isCurrent: true,
  },
  {
    id: 3,
    category: "tests",
    title: "Done Item",
    description: "Done description",
    priority: 1,
    passes: true,
    verification: "Done verification",
    steps: ["Done step"],
    notes: "",
    status: "done",
    isCurrent: false,
  },
];

afterEach(() => {
  cleanup();
});

describe("KanbanBoard", () => {
  it("renders items in Backlog, In Progress, and Done columns", () => {
    render(<KanbanBoard items={items} />);

    const backlogColumn = screen.getByTestId("column-backlog");
    const inProgressColumn = screen.getByTestId("column-in_progress");
    const doneColumn = screen.getByTestId("column-done");

    expect(within(backlogColumn).getByText("Backlog Item")).toBeInTheDocument();
    expect(within(inProgressColumn).getByText("Current Item")).toBeInTheDocument();
    expect(within(doneColumn).getByText("Done Item")).toBeInTheDocument();
  });

  it("expands a card to show description, steps, and verification on click", () => {
    render(<KanbanBoard items={items} />);

    expect(screen.queryByText("Current description")).not.toBeInTheDocument();
    expect(screen.queryByText("Verification")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /current item/i }));

    expect(screen.getByText("Current description")).toBeInTheDocument();
    expect(screen.getByText("Steps")).toBeInTheDocument();
    expect(screen.getByText("Current step 1")).toBeInTheDocument();
    expect(screen.getByText("Verification")).toBeInTheDocument();
    expect(screen.getByText("Current verification")).toBeInTheDocument();
  });

  it("applies glow and pulse classes to the current item card", () => {
    render(<KanbanBoard items={items} />);

    const currentCard = screen.getByRole("button", { name: /current item/i });
    expect(currentCard.className).toContain("animate-pulse");
    expect(currentCard.className).toContain("shadow-[0_0_18px_rgba(251,191,36,0.35)]");
  });
});
