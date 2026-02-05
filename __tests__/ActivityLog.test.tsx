import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import ActivityLog from "@/components/ActivityLog";
import type { RalphState, UnifiedPRDItem } from "@/lib/ralph-state";

const items: UnifiedPRDItem[] = [
  {
    id: 11,
    category: "ui",
    title: "Render board shell",
    description: "Build shell",
    priority: 1,
    passes: true,
    verification: "Renders layout",
    steps: [],
    notes: "",
    status: "done",
    isCurrent: false,
  },
  {
    id: 12,
    category: "ui",
    title: "Activity log panel",
    description: "Build activity log",
    priority: 2,
    passes: false,
    verification: "Component renders activity log correctly",
    steps: [],
    notes: "",
    status: "in_progress",
    isCurrent: true,
  },
  {
    id: 13,
    category: "tests",
    title: "Dashboard tests",
    description: "Add tests",
    priority: 2,
    passes: false,
    verification: "Unit tests pass",
    steps: [],
    notes: "",
    status: "backlog",
    isCurrent: false,
  },
];

function makeState(checkpoints: RalphState["checkpoints"]): RalphState {
  return {
    branch: "main",
    prd_path: "/tmp/prd.json",
    current_item: 12,
    completed_items: [11],
    started_at: "2026-02-05T10:00:00.000Z",
    checkpoints,
    agent: "codex",
    model: "gpt-5",
    auto_push: false,
    pr_url: null,
    base_branch: "main",
    current_action: null,
    action_started_at: null,
    watchdog_timeout: null,
    last_output_at: null,
    watchdog_triggered: false,
  };
}

afterEach(() => {
  cleanup();
});

describe("ActivityLog", () => {
  it("renders timestamp, completed item, and files changed from checkpoints", () => {
    render(
      <ActivityLog
        items={items}
        state={makeState([
          {
            item_id: 12,
            commit_sha: "1111111111111111111111111111111111111111",
            timestamp: "2026-02-05T12:01:00.000Z",
            files_changed: ["components/ActivityLog.tsx", "__tests__/ActivityLog.test.tsx"],
            tests_passed: true,
            route: "",
          },
        ])}
      />,
    );

    expect(screen.getByText("Item #12 completed: Activity log panel")).toBeInTheDocument();
    expect(screen.getByText("2 files changed")).toBeInTheDocument();
    expect(screen.getByText("components/ActivityLog.tsx, __tests__/ActivityLog.test.tsx")).toBeInTheDocument();

    const timestamp = screen.getByText((content, element) => element?.tagName === "TIME" && content.length > 0);
    expect(timestamp).toHaveAttribute("dateTime", "2026-02-05T12:01:00.000Z");
  });

  it("applies success, warning, and failure color coding", () => {
    render(
      <ActivityLog
        items={items}
        state={makeState([
          {
            item_id: 11,
            commit_sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            timestamp: "2026-02-05T12:00:00.000Z",
            files_changed: ["a.ts"],
            tests_passed: true,
            route: "",
          },
          {
            item_id: 12,
            commit_sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            timestamp: "2026-02-05T12:01:00.000Z",
            files_changed: ["b.ts"],
            tests_passed: false,
            route: "",
          },
          {
            item_id: 13,
            commit_sha: "cccccccccccccccccccccccccccccccccccccccc",
            timestamp: "2026-02-05T12:02:00.000Z",
            files_changed: ["c.ts"],
            tests_passed: false,
            route: "test-failure",
          },
        ])}
      />,
    );

    const success = screen.getByTestId("activity-entry-success");
    const warning = screen.getByTestId("activity-entry-warning");
    const failure = screen.getByTestId("activity-entry-failure");

    expect(success.className).toContain("border-green-500/40");
    expect(warning.className).toContain("border-amber-500/40");
    expect(failure.className).toContain("border-red-500/40");
  });

  it("auto-scrolls to latest checkpoint and pauses while hovered", () => {
    const initialState = makeState([
      {
        item_id: 11,
        commit_sha: "dddddddddddddddddddddddddddddddddddddddd",
        timestamp: "2026-02-05T12:00:00.000Z",
        files_changed: ["d.ts"],
        tests_passed: true,
        route: "",
      },
    ]);

    const { rerender } = render(<ActivityLog items={items} state={initialState} />);
    const logList = screen.getByRole("list");

    Object.defineProperty(logList, "scrollHeight", {
      configurable: true,
      value: 500,
    });

    rerender(<ActivityLog items={items} state={makeState([...initialState.checkpoints])} />);
    expect(logList.scrollTop).toBe(500);

    fireEvent.mouseEnter(logList);

    Object.defineProperty(logList, "scrollHeight", {
      configurable: true,
      value: 900,
    });

    rerender(
      <ActivityLog
        items={items}
        state={makeState([
          ...initialState.checkpoints,
          {
            item_id: 12,
            commit_sha: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
            timestamp: "2026-02-05T12:02:00.000Z",
            files_changed: ["e.ts"],
            tests_passed: true,
            route: "",
          },
        ])}
      />,
    );
    expect(logList.scrollTop).toBe(500);

    fireEvent.mouseLeave(logList);
    expect(logList.scrollTop).toBe(900);
  });

  it("shows checkpoints in chronological order", () => {
    render(
      <ActivityLog
        items={items}
        state={makeState([
          {
            item_id: 13,
            commit_sha: "ffffffffffffffffffffffffffffffffffffffff",
            timestamp: "2026-02-05T12:03:00.000Z",
            files_changed: ["f.ts"],
            tests_passed: true,
            route: "",
          },
          {
            item_id: 11,
            commit_sha: "gggggggggggggggggggggggggggggggggggggggg",
            timestamp: "2026-02-05T12:01:00.000Z",
            files_changed: ["g.ts"],
            tests_passed: true,
            route: "",
          },
        ])}
      />,
    );

    const listItems = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(within(listItems[0]).getByText("Item #11 completed: Render board shell")).toBeInTheDocument();
    expect(within(listItems[1]).getByText("Item #13 completed: Dashboard tests")).toBeInTheDocument();
  });
});
