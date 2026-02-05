import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import GitPanel from "@/components/GitPanel";
import type { GitState } from "@/lib/git-state";

const baseGit: Pick<GitState, "branch" | "commitCount" | "recentCommits" | "baseBranch" | "diffFromBase" | "error"> = {
  branch: "feature/git-panel",
  commitCount: 42,
  recentCommits: [
    "feat: add git panel",
    "test: add git panel tests",
    "refactor: tidy panel layout",
    "fix: branch copy state",
    "chore: update styles",
    "docs: note git state panel",
  ],
  baseBranch: "main",
  diffFromBase: {
    filesChanged: 5,
    insertions: 30,
    deletions: 10,
  },
  error: null,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("GitPanel", () => {
  it("renders branch, commit count, diff stats, and only the latest five commit messages", () => {
    render(<GitPanel git={baseGit} />);

    expect(screen.getByText("feature/git-panel")).toBeInTheDocument();
    expect(screen.getByText("42 commits on this branch")).toBeInTheDocument();
    expect(screen.getByText("Diff vs main")).toBeInTheDocument();

    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();

    expect(screen.getByText("feat: add git panel")).toBeInTheDocument();
    expect(screen.getByText("test: add git panel tests")).toBeInTheDocument();
    expect(screen.getByText("refactor: tidy panel layout")).toBeInTheDocument();
    expect(screen.getByText("fix: branch copy state")).toBeInTheDocument();
    expect(screen.getByText("chore: update styles")).toBeInTheDocument();
    expect(screen.queryByText("docs: note git state panel")).not.toBeInTheDocument();
  });

  it("copies the branch name when the copy button is pressed", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(<GitPanel git={baseGit} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy branch name" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("feature/git-panel");
    });

    expect(screen.getByText("Copied.")).toBeInTheDocument();
  });
});
