import { describe, expect, it } from "vitest";

import { parseDiffShortStat, readGitState } from "../lib/git-state";

function createMockRunner(outputs: Record<string, string>, failures: Set<string> = new Set()) {
  return async (args: string[]): Promise<string> => {
    const key = args.join(" ");

    if (failures.has(key)) {
      throw new Error(`command failed: ${key}`);
    }

    if (!(key in outputs)) {
      throw new Error(`missing mock output: ${key}`);
    }

    return outputs[key];
  };
}

describe("parseDiffShortStat", () => {
  it("parses full shortstat output", () => {
    const parsed = parseDiffShortStat(" 4 files changed, 20 insertions(+), 3 deletions(-)");

    expect(parsed).toEqual({
      filesChanged: 4,
      insertions: 20,
      deletions: 3,
    });
  });

  it("handles shortstat lines with missing insertion/deletion values", () => {
    expect(parseDiffShortStat(" 1 file changed, 6 insertions(+)")).toEqual({
      filesChanged: 1,
      insertions: 6,
      deletions: 0,
    });

    expect(parseDiffShortStat(" 2 files changed, 8 deletions(-)")).toEqual({
      filesChanged: 2,
      insertions: 0,
      deletions: 8,
    });
  });
});

describe("readGitState", () => {
  it("collects branch, commit stats, diff stats, and uncommitted summary", async () => {
    const runGitCommand = createMockRunner({
      "rev-parse --abbrev-ref HEAD": "feature/dashboard",
      "rev-list --count HEAD": "42",
      "log --pretty=format:%s -n 3": "feat: add panel\nfix: tune parser\nchore: update tests",
      "rev-parse --verify --quiet main": "abc123",
      "diff --shortstat main...HEAD": " 5 files changed, 30 insertions(+), 10 deletions(-)",
      "diff --shortstat": " 2 files changed, 5 insertions(+), 1 deletion(-)",
      "diff --shortstat --cached": " 1 file changed, 3 insertions(+), 2 deletions(-)",
      "ls-files --others --exclude-standard": "new-file.ts\nnotes.md\n",
    });

    const state = await readGitState("/tmp/project", {
      recentCommitLimit: 3,
      runGitCommand,
    });

    expect(state.error).toBeNull();
    expect(state.branch).toBe("feature/dashboard");
    expect(state.commitCount).toBe(42);
    expect(state.recentCommits).toEqual(["feat: add panel", "fix: tune parser", "chore: update tests"]);
    expect(state.baseBranch).toBe("main");
    expect(state.diffFromBase).toEqual({
      filesChanged: 5,
      insertions: 30,
      deletions: 10,
    });
    expect(state.uncommitted).toEqual({
      staged: { filesChanged: 1, insertions: 3, deletions: 2 },
      unstaged: { filesChanged: 2, insertions: 5, deletions: 1 },
      untrackedFiles: 2,
      total: { filesChanged: 5, insertions: 8, deletions: 3 },
    });
  });

  it("falls back to master when main is not available", async () => {
    const failures = new Set<string>(["rev-parse --verify --quiet main"]);
    const runGitCommand = createMockRunner(
      {
        "rev-parse --abbrev-ref HEAD": "feature/master-base",
        "rev-list --count HEAD": "3",
        "log --pretty=format:%s -n 5": "a\nb\nc",
        "rev-parse --verify --quiet master": "def456",
        "diff --shortstat master...HEAD": " 1 file changed, 2 insertions(+)",
        "diff --shortstat": "",
        "diff --shortstat --cached": "",
        "ls-files --others --exclude-standard": "",
      },
      failures,
    );

    const state = await readGitState("/tmp/project", { runGitCommand });

    expect(state.error).toBeNull();
    expect(state.baseBranch).toBe("master");
    expect(state.diffFromBase).toEqual({
      filesChanged: 1,
      insertions: 2,
      deletions: 0,
    });
  });

  it("returns default state with error when git commands fail", async () => {
    const runGitCommand = createMockRunner({}, new Set<string>(["rev-parse --abbrev-ref HEAD"]));

    const state = await readGitState("/tmp/project", { runGitCommand });

    expect(state.branch).toBeNull();
    expect(state.commitCount).toBe(0);
    expect(state.recentCommits).toEqual([]);
    expect(state.diffFromBase).toEqual({
      filesChanged: 0,
      insertions: 0,
      deletions: 0,
    });
    expect(state.uncommitted.total).toEqual({
      filesChanged: 0,
      insertions: 0,
      deletions: 0,
    });
    expect(state.error).toContain("command failed");
  });
});
