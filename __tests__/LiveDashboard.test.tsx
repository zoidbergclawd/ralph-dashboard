import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LiveDashboard from "@/components/LiveDashboard";

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: () => null,
  }),
}));

vi.mock("@/hooks/use-dashboard-state", () => ({
  useDashboardState: () => ({
    data: {
      timestamp: "2026-02-06T12:00:00.000Z",
      projectPath: "/tmp/ralph-project",
      ralph: {
        state: {
          current_action: "run",
          started_at: "2026-02-06T11:58:00.000Z",
        },
        items: [{ id: 1, title: "Item 1" }],
      },
      coverage: {
        total: {
          lines: {
            pct: 88,
          },
        },
      },
      git: {
        branch: "main",
        clean: true,
        ahead: 0,
        behind: 0,
      },
      metrics: {
        totalLoc: 1200,
        fileCount: 35,
        testFileCount: 9,
      },
    },
    error: null,
    isPending: false,
    isFetching: false,
    dataUpdatedAt: Date.now(),
  }),
}));

vi.mock("@/components/ControlBar", () => ({
  default: () => <div>ControlBar Stub</div>,
}));

vi.mock("@/components/TerminalView", () => ({
  default: () => <div>TerminalView Stub</div>,
}));

vi.mock("@/components/KanbanBoard", () => ({
  default: () => <div>KanbanBoard Stub</div>,
}));

vi.mock("@/components/ProgressPanel", () => ({
  default: () => <div>ProgressPanel Stub</div>,
}));

vi.mock("@/components/GitPanel", () => ({
  default: () => <div>GitPanel Stub</div>,
}));

vi.mock("@/components/MetricsPanel", () => ({
  default: () => <div>MetricsPanel Stub</div>,
}));

vi.mock("@/components/ActivityLog", () => ({
  default: () => <div>ActivityLog Stub</div>,
}));

vi.mock("@/components/PRDEditor", () => ({
  default: () => <div>PRDEditor Stub</div>,
}));

describe("LiveDashboard", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(),
      },
    });
  });

  it("renders integrated workspace with tab switch between monitor and editor", async () => {
    const user = userEvent.setup();
    render(<LiveDashboard />);

    expect(screen.getByText("Mission Workspace")).toBeInTheDocument();
    expect(screen.getByText("ControlBar Stub")).toBeInTheDocument();
    expect(screen.getByText("TerminalView Stub")).toBeInTheDocument();
    expect(screen.getByText("KanbanBoard Stub")).toBeInTheDocument();
    expect(screen.getByText("ActivityLog Stub")).toBeInTheDocument();
    expect(screen.queryByText("PRDEditor Stub")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Editor" }));

    expect(screen.getByText("ControlBar Stub")).toBeInTheDocument();
    expect(screen.getByText("TerminalView Stub")).toBeInTheDocument();
    expect(screen.getByText("PRDEditor Stub")).toBeInTheDocument();
    expect(screen.queryByText("KanbanBoard Stub")).not.toBeInTheDocument();
    expect(screen.queryByText("ActivityLog Stub")).not.toBeInTheDocument();
  });
});
