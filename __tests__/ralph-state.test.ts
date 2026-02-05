import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { getRalphUnifiedView, readPRD, readRalphState } from "../lib/ralph-state";

const tempDirs: string[] = [];

async function makeProjectDir(): Promise<string> {
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "ralph-state-test-"));
  tempDirs.push(projectDir);
  return projectDir;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

describe("readRalphState", () => {
  it("parses state.json and normalizes fields", async () => {
    const projectDir = await makeProjectDir();

    await writeJson(path.join(projectDir, ".ralph", "state.json"), {
      branch: "feature/alpha",
      current_item: 3,
      completed_items: [1, 2, "bad"],
      checkpoints: [
        {
          item_id: 2,
          commit_sha: "abc123",
          timestamp: "2026-02-05T14:34:48.967683",
          files_changed: ["a.ts", 9],
          tests_passed: true,
          route: "fast",
        },
        {
          item_id: "bad",
        },
      ],
      watchdog_timeout: 600,
    });

    const result = await readRalphState(projectDir);

    expect(result.error).toBeNull();
    expect(result.data?.branch).toBe("feature/alpha");
    expect(result.data?.completed_items).toEqual([1, 2]);
    expect(result.data?.checkpoints).toHaveLength(1);
    expect(result.data?.checkpoints[0].files_changed).toEqual(["a.ts"]);
    expect(result.data?.watchdog_timeout).toBe(600);
  });

  it("returns null data and error when state file is missing", async () => {
    const projectDir = await makeProjectDir();

    const result = await readRalphState(projectDir);

    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it("returns null data and error when state file is malformed", async () => {
    const projectDir = await makeProjectDir();
    const statePath = path.join(projectDir, ".ralph", "state.json");
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    await fs.writeFile(statePath, "{ not json", "utf8");

    const result = await readRalphState(projectDir);

    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it("handles partial state objects by defaulting missing fields", async () => {
    const projectDir = await makeProjectDir();

    await writeJson(path.join(projectDir, ".ralph", "state.json"), {
      current_item: 3,
    });

    const result = await readRalphState(projectDir);

    expect(result.error).toBeNull();
    expect(result.data?.current_item).toBe(3);
    expect(result.data?.branch).toBeNull();
    expect(result.data?.completed_items).toEqual([]);
    expect(result.data?.checkpoints).toEqual([]);
  });
});

describe("readPRD", () => {
  it("reads prd.json when available", async () => {
    const projectDir = await makeProjectDir();

    await writeJson(path.join(projectDir, "prd.json"), {
      project: "Ralph Dashboard",
      goal: "Watch Ralph",
      items: [
        {
          id: 3,
          category: "core",
          title: "Reader",
          description: "Read state",
          priority: 1,
          passes: false,
          verification: "Tests pass",
          steps: ["a", 1],
          notes: null,
        },
      ],
    });

    const result = await readPRD(projectDir);

    expect(result.error).toBeNull();
    expect(result.data?.items).toHaveLength(1);
    expect(result.data?.items[0].steps).toEqual(["a"]);
    expect(result.data?.items[0].notes).toBe("");
  });

  it("returns error when PRD file is missing", async () => {
    const projectDir = await makeProjectDir();

    const result = await readPRD(projectDir);

    expect(result.data).toBeNull();
    expect(result.error).toBe("Unable to locate PRD file");
  });

  it("returns parse error for malformed PRD", async () => {
    const projectDir = await makeProjectDir();
    const prdPath = path.join(projectDir, "prd.json");
    await fs.writeFile(prdPath, "{ broken", "utf8");

    const result = await readPRD(projectDir);

    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

describe("getRalphUnifiedView", () => {
  it("merges state and PRD and computes item status", async () => {
    const projectDir = await makeProjectDir();

    await writeJson(path.join(projectDir, ".ralph", "state.json"), {
      current_item: 3,
      completed_items: [1, 2],
      prd_path: "prd.json",
    });

    await writeJson(path.join(projectDir, "prd.json"), {
      project: "Ralph Dashboard",
      goal: "Watch Ralph",
      items: [
        {
          id: 1,
          category: "setup",
          title: "Done",
          description: "done",
          priority: 1,
          passes: false,
          verification: "ok",
          steps: [],
          notes: "",
        },
        {
          id: 3,
          category: "core",
          title: "In progress",
          description: "doing",
          priority: 1,
          passes: false,
          verification: "ok",
          steps: [],
          notes: "",
        },
        {
          id: 4,
          category: "core",
          title: "Todo",
          description: "todo",
          priority: 2,
          passes: false,
          verification: "ok",
          steps: [],
          notes: "",
        },
      ],
    });

    const result = await getRalphUnifiedView(projectDir);

    expect(result.errors.state).toBeNull();
    expect(result.errors.prd).toBeNull();
    expect(result.items.map((item) => [item.id, item.status])).toEqual([
      [1, "done"],
      [3, "in_progress"],
      [4, "backlog"],
    ]);
  });

  it("returns graceful errors when both files are unavailable", async () => {
    const projectDir = await makeProjectDir();

    const result = await getRalphUnifiedView(projectDir);

    expect(result.state).toBeNull();
    expect(result.prd).toBeNull();
    expect(result.items).toEqual([]);
    expect(result.errors.state).toBeTruthy();
    expect(result.errors.prd).toBeTruthy();
  });
});
