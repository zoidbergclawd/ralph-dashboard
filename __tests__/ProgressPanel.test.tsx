import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import ProgressPanel from "@/components/ProgressPanel";
import type { UnifiedPRDItem } from "@/lib/ralph-state";

const items: UnifiedPRDItem[] = [
  {
    id: 1,
    category: "setup",
    title: "Done Item A",
    description: "Done A",
    priority: 1,
    passes: true,
    verification: "Done A verification",
    steps: [],
    notes: "",
    status: "done",
    isCurrent: false,
  },
  {
    id: 2,
    category: "api",
    title: "Done Item B",
    description: "Done B",
    priority: 2,
    passes: true,
    verification: "Done B verification",
    steps: [],
    notes: "",
    status: "done",
    isCurrent: false,
  },
  {
    id: 3,
    category: "ui",
    title: "Current Item",
    description: "Current",
    priority: 1,
    passes: false,
    verification: "Current verification",
    steps: [],
    notes: "",
    status: "in_progress",
    isCurrent: true,
  },
  {
    id: 4,
    category: "tests",
    title: "Backlog Item",
    description: "Backlog",
    priority: 2,
    passes: false,
    verification: "Backlog verification",
    steps: [],
    notes: "",
    status: "backlog",
    isCurrent: false,
  },
];

afterEach(() => {
  cleanup();
});

describe("ProgressPanel", () => {
  it("renders completion, progress, elapsed time, average, ETA, and current item", () => {
    render(
      <ProgressPanel
        items={items}
        startedAt="2026-02-05T10:00:00.000Z"
        now={new Date("2026-02-05T11:00:00.000Z")}
      />,
    );

    expect(screen.getByText("2 of 4 items complete")).toBeInTheDocument();
    expect(screen.getByText("50% complete")).toBeInTheDocument();

    const progress = screen.getByRole("progressbar", { name: "Overall progress" });
    expect(progress).toHaveAttribute("aria-valuenow", "50");

    expect(screen.getAllByText("1h 00m")).toHaveLength(2);
    expect(screen.getByText("30m 00s")).toBeInTheDocument();
    expect(screen.getAllByText("Current Item")).toHaveLength(2);
  });

  it("shows N/A values when there is no valid start or no completed items", () => {
    const noDoneItems = items.map((item) => ({ ...item, passes: false }));

    render(<ProgressPanel items={noDoneItems} startedAt={null} now={new Date("2026-02-05T11:00:00.000Z")} />);

    expect(screen.getByText("0 of 4 items complete")).toBeInTheDocument();
    expect(screen.getByText("0% complete")).toBeInTheDocument();

    const naLabels = screen.getAllByText("N/A");
    expect(naLabels).toHaveLength(3);
  });
});
